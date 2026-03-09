from fastapi import APIRouter, HTTPException, Body, Query
from fastapi.responses import JSONResponse
import os
import uuid
import json
from typing import Optional
from database import get_db_connection
from services.audit_service import log_audit_event
from core.crypto import encrypt_credential, decrypt_credential
from drivers.ssh_compat import build_legacy_ssh_guidance, is_legacy_ssh_negotiation_error

router = APIRouter()

def _normalize_device_row(row):
    item = dict(row)
    try:
        item['config_history'] = json.loads(item.get('config_history', '[]'))
    except Exception:
        item['config_history'] = []

    try:
        item['interface_data'] = json.loads(item.get('interface_data', '[]'))
    except Exception:
        item['interface_data'] = []

    try:
        item['cpu_history'] = json.loads(item.get('cpu_history', '[]'))
    except Exception:
        item['cpu_history'] = []

    try:
        item['memory_history'] = json.loads(item.get('memory_history', '[]'))
    except Exception:
        item['memory_history'] = []

    return item


@router.get("/devices")
def read_devices(
    search: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default='full'),
    sort_key: Optional[str] = Query(default=None),
    sort_direction: Optional[str] = Query(default='asc'),
    page: Optional[int] = Query(default=None, ge=1),
    page_size: Optional[int] = Query(default=None, ge=1, le=200),
):
    conn = get_db_connection()
    try:
        where_clauses = []
        params = []

        if search and search.strip():
            q = f"%{search.strip()}%"
            where_clauses.append('(hostname LIKE ? OR ip_address LIKE ? OR sn LIKE ?)')
            params.extend([q, q, q])

        if platform and platform != 'all':
            where_clauses.append('platform = ?')
            params.append(platform)

        if status and status != 'all':
            where_clauses.append('status = ?')
            params.append(status)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ''

        sortable_columns = {
            'hostname': 'hostname',
            'model': 'model',
            'platform': 'platform',
            'site': 'site',
            'connection_method': 'connection_method',
            'status': 'status',
            'ip_address': 'ip_address',
            'role': 'role',
        }
        order_col = sortable_columns.get(sort_key or '', 'hostname')
        order_dir = 'DESC' if str(sort_direction).lower() == 'desc' else 'ASC'
        select_clause = '*'
        if str(mode).lower() == 'light':
            # Lightweight projection for high-frequency polling.
            select_clause = (
                'id, hostname, ip_address, platform, status, compliance, sn, model, version, '
                'role, site, uptime, connection_method, cpu_usage, memory_usage, temp, '
                'fan_status, psu_status, sys_name, sys_location, sys_contact'
            )

        # Backward-compatible mode: no pagination params -> return array.
        # Safety cap: never return more than 500 rows without explicit pagination.
        if page is None or page_size is None:
            devices = conn.execute(
                f'SELECT {select_clause} FROM devices {where_sql} ORDER BY {order_col} {order_dir} LIMIT 500',
                tuple(params)
            ).fetchall()
            if str(mode).lower() == 'light':
                return [dict(d) for d in devices]
            return [_normalize_device_row(d) for d in devices]

        total_row = conn.execute(
            f'SELECT COUNT(*) AS count FROM devices {where_sql}',
            tuple(params)
        ).fetchone()
        total = int(total_row['count']) if total_row else 0

        offset = (page - 1) * page_size
        devices = conn.execute(
            f'SELECT {select_clause} FROM devices {where_sql} ORDER BY {order_col} {order_dir} LIMIT ? OFFSET ?',
            tuple([*params, page_size, offset])
        ).fetchall()

        return {
            'items': [dict(d) for d in devices] if str(mode).lower() == 'light' else [_normalize_device_row(d) for d in devices],
            'total': total,
            'page': page,
            'page_size': page_size,
        }
    finally:
        conn.close()

@router.post("/devices")
def create_device(device: dict = Body(...)):
    conn = get_db_connection()
    device_id = device.get('id') or str(uuid.uuid4())
    try:
        conn.execute('''
            INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, sn, model, version, role, site, uptime, connection_method, snmp_community, snmp_port)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            device_id,
            device.get('hostname'),
            device.get('ip_address'),
            device.get('platform'),
            device.get('status', 'pending'),
            device.get('compliance', 'unknown'),
            device.get('username'),
            encrypt_credential(device.get('password')),
            device.get('sn', ''),
            device.get('model', ''),
            device.get('version', ''),
            device.get('role', ''),
            device.get('site', ''),
            device.get('uptime', '0d 0h'),
            device.get('connection_method', 'ssh'),
            device.get('snmp_community', 'public'),
            device.get('snmp_port', 161)
        ))
        conn.commit()
        new_device = conn.execute('SELECT * FROM devices WHERE id = ?', (device_id,)).fetchone()
        log_audit_event(
            event_type='DEVICE_CREATE',
            category='inventory',
            severity='medium',
            status='success',
            summary=f"Created device {device.get('hostname')}",
            actor_username=device.get('actor_username') or 'admin',
            actor_role=device.get('actor_role') or 'Administrator',
            target_type='device',
            target_id=device_id,
            target_name=device.get('hostname'),
            device_id=device_id,
            details={'ip_address': device.get('ip_address'), 'platform': device.get('platform')},
        )
        return dict(new_device)
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})
    finally:
        conn.close()

@router.delete("/devices/{device_id}")
def delete_device(device_id: str):
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT hostname FROM devices WHERE id = ?', (device_id,)).fetchone()
        conn.execute('DELETE FROM devices WHERE id = ?', (device_id,))
        conn.commit()
        log_audit_event(
            event_type='DEVICE_DELETE',
            category='inventory',
            severity='high',
            status='success',
            summary=f"Deleted device {row['hostname'] if row else device_id}",
            actor_username='admin',
            actor_role='Administrator',
            target_type='device',
            target_id=device_id,
            target_name=row['hostname'] if row else device_id,
            device_id=device_id,
        )
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})
    finally:
        conn.close()

@router.put("/devices/{device_id}")
def update_device(device_id: str, device: dict = Body(...)):
    conn = get_db_connection()
    try:
        conn.execute('''
            UPDATE devices 
            SET hostname = ?, ip_address = ?, platform = ?, sn = ?, model = ?, version = ?, role = ?, site = ?, connection_method = ?, username = ?, password = ?, current_config = ?, config_history = ?, snmp_community = ?, snmp_port = ?
            WHERE id = ?
        ''', (
            device.get('hostname', ''),
            device.get('ip_address', ''),
            device.get('platform', 'cisco_ios'),
            device.get('sn', ''),
            device.get('model', ''),
            device.get('version', ''),
            device.get('role', 'Unknown'),
            device.get('site', ''),
            device.get('connection_method', 'ssh'),
            device.get('username', ''),
            encrypt_credential(device.get('password', '')),
            device.get('current_config', ''),
            json.dumps(device.get('config_history', [])) if device.get('config_history') else '[]',
            device.get('snmp_community', 'public'),
            device.get('snmp_port', 161),
            device_id
        ))
        conn.commit()
        log_audit_event(
            event_type='DEVICE_UPDATE',
            category='inventory',
            severity='medium',
            status='success',
            summary=f"Updated device {device.get('hostname', device_id)}",
            actor_username=device.get('actor_username') or 'admin',
            actor_role=device.get('actor_role') or 'Administrator',
            target_type='device',
            target_id=device_id,
            target_name=device.get('hostname', device_id),
            device_id=device_id,
            details={'ip_address': device.get('ip_address'), 'platform': device.get('platform')},
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/devices/{device_id}/config")
def update_device_config(device_id: str, payload: dict = Body(...)):
    conn = get_db_connection()
    try:
        conn.execute('UPDATE devices SET current_config = ?, config_history = ? WHERE id = ?',
                     (payload.get('current_config'), json.dumps(payload.get('config_history', [])), device_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})
    finally:
        conn.close()

@router.post("/devices/connect")
def test_device_connection(payload: dict = Body(...)):
    from services.automation_service import AutomationService
    from ping3 import ping
    import logging
    logger = logging.getLogger(__name__)
    
    hostname = payload.get('hostname')
    ip_address = payload.get('ip_address')
    username = payload.get('username')
    password = payload.get('password')
    method = payload.get('method', 'ssh')
    platform = payload.get('platform', 'cisco_ios')
    
    if not ip_address:
        raise HTTPException(status_code=400, detail="IP address is required")
    
    # 默认使用 SSH（22 端口），除非明确指定其他方式
    port = 22
    if method and method.lower() == 'telnet':
        port = 23
    
    logger.info(f"Testing connection to device: {hostname or ip_address} (IP: {ip_address}, Port: {port}, Platform: {platform}, User: {username})")
    
    # 第一步：快速 ICMP ping 测试网络连通性
    try:
        logger.debug(f"Step 1: Ping {ip_address}")
        ping_result = ping(ip_address, timeout=3)
        if ping_result is None or ping_result is False:
            logger.warning(f"ICMP ping failed for {ip_address}")
            raise HTTPException(status_code=400, detail=f"Device {hostname or ip_address} is not reachable (ping failed)")
        logger.debug(f"Step 1: Ping successful ({ping_result*1000:.2f}ms)")
    except Exception as ping_err:
        logger.warning(f"Ping error: {str(ping_err)}")
        # 继续尝试 SSH，有些设备可能禁用 ICMP
        logger.debug("Continuing with SSH test despite ping failure")
    
    # 第二步：SSH 认证测试
    logger.debug(f"Step 2: SSH authentication test")
    device_info = {
        'hostname': hostname,
        'ip_address': ip_address,
        'username': username,
        'password': password,
        'connection_method': method,
        'platform': platform,
        'port': port
    }
    
    try:
        # 使用 netmiko 驱动，除非是本地测试
        driver_type = 'mock' if ip_address in ['127.0.0.1', '0.0.0.0', 'localhost'] else 'netmiko'
        logger.debug(f"Using driver type: {driver_type}")
        service = AutomationService(driver_type=driver_type)
        
        is_connected, error_msg = service.check_connectivity(device_info)
        
        if is_connected:
            logger.info(f"Successfully connected to {hostname or ip_address}")
            return {"status": "success", "message": f"Successfully connected to {hostname or ip_address}"}
        else:
            logger.warning(f"Failed to connect to {hostname or ip_address}: {error_msg}")
            if is_legacy_ssh_negotiation_error(error_msg):
                return JSONResponse(
                    status_code=400,
                    content={
                        "detail": build_legacy_ssh_guidance(error_msg),
                        "output": error_msg,
                        "error_code": "legacy_ssh_algorithms",
                    },
                )
            raise HTTPException(status_code=400, detail=f"Failed to connect to {hostname or ip_address}: {error_msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Connection error for {hostname or ip_address}: {str(e)}", exc_info=True)
        raw_error = str(e)
        if is_legacy_ssh_negotiation_error(raw_error):
            return JSONResponse(
                status_code=500,
                content={
                    "detail": build_legacy_ssh_guidance(raw_error),
                    "output": raw_error,
                    "error_code": "legacy_ssh_algorithms",
                },
            )
        raise HTTPException(status_code=500, detail=f"Connection error: {raw_error}")

@router.post("/devices/import")
def import_devices(payload: dict = Body(...)):
    devices = payload.get('devices', [])
    if not isinstance(devices, list):
        raise HTTPException(status_code=400, detail="Invalid data format")
    
    conn = get_db_connection()
    try:
        for device in devices:
            device_id = device.get('id') or str(uuid.uuid4())
            conn.execute('''
                INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, sn, model, version, role, site, uptime, connection_method) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                device_id,
                device.get('hostname'),
                device.get('ip_address'),
                device.get('platform', 'unknown'),
                device.get('status', 'pending'),
                device.get('compliance', 'unknown'),
                device.get('sn', ''),
                device.get('model', ''),
                device.get('version', ''),
                device.get('role', ''),
                device.get('site', ''),
                device.get('uptime', '0d 0h'),
                device.get('connection_method', 'ssh')
            ))
        conn.commit()
        log_audit_event(
            event_type='DEVICE_IMPORT',
            category='inventory',
            severity='medium',
            status='success',
            summary=f"Imported {len(devices)} device(s)",
            actor_username=payload.get('actor_username') or 'admin',
            actor_role=payload.get('actor_role') or 'Administrator',
            target_type='device_batch',
            target_name=f"{len(devices)} devices",
            details={'count': len(devices)},
        )
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})
    finally:
        conn.close()


@router.post("/devices/{device_id}/snmp-test")
async def snmp_test(device_id: str):
    """Test SNMP connectivity and immediately sync all SNMP data into DB on success."""
    import time, re as _re, json as _json
    conn = get_db_connection()
    try:
        device = conn.execute('SELECT * FROM devices WHERE id = ?', (device_id,)).fetchone()
    finally:
        conn.close()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    ip = device['ip_address']
    community = device['snmp_community'] or 'public'
    port = device['snmp_port'] or 161

    if not ip:
        return {"success": False, "error": "No IP address configured"}

    import asyncio as _aio
    from services.snmp_service import _snmp_get, _snmp_walk, collect_device_info, collect_interface_data, collect_device_metrics

    results = {"success": False, "ip": ip, "community": community, "port": port,
               "sys_name": None, "sys_descr": None, "response_ms": None, "error": None,
               "synced": False}

    start = time.monotonic()
    try:
        # Step 1: 标准 System MIB（sysName + sysDescr）并行查询
        sys_name, sys_descr = await _aio.gather(
            _snmp_get(ip, community, '1.3.6.1.2.1.1.5.0', port, timeout=3),
            _snmp_get(ip, community, '1.3.6.1.2.1.1.1.0', port, timeout=3),
        )
        elapsed = round((time.monotonic() - start) * 1000)
        results['response_ms'] = elapsed

        if sys_name or sys_descr:
            results['success'] = True
            results['sys_name'] = sys_name
            results['sys_descr'] = sys_descr
        else:
            # Step 2: ifName (ifXTable) — 部分设备/SNMP view 不含 system MIB
            if_rows = await _snmp_walk(ip, community, '1.3.6.1.2.1.31.1.1.1.1', port, timeout=3, max_rows=3)
            if not if_rows:
                # Step 3: ifDescr (基础 IF-MIB RFC 1213) — 最广泛兼容
                if_rows = await _snmp_walk(ip, community, '1.3.6.1.2.1.2.2.1.2', port, timeout=3, max_rows=3)
            elapsed = round((time.monotonic() - start) * 1000)
            results['response_ms'] = elapsed
            if if_rows:
                results['success'] = True
                results['sys_descr'] = f"System MIBs not in SNMP view – reachable via IF-MIB ({len(if_rows)} interfaces found)"
            else:
                results['error'] = 'No SNMP response – verify community string, UDP 161 and device SNMP config'
    except Exception as e:
        elapsed = round((time.monotonic() - start) * 1000)
        results['response_ms'] = elapsed
        results['error'] = str(e)

    # ── 测试成功后立即全量同步数据 ──────────────────────────────────────
    if results['success']:
        try:
            platform = device['platform'] or 'cisco_ios'
            dev_info, intf_data, metrics = await _aio.gather(
                collect_device_info(ip, community, port),
                collect_interface_data(ip, community, port),
                collect_device_metrics(ip, platform, community, port),
            )

            updates: dict = {}

            # 设备基础信息
            if dev_info.get('sys_name'):
                updates['sys_name'] = dev_info['sys_name']
                results['sys_name'] = dev_info['sys_name']
            if dev_info.get('sys_descr'):
                descr = dev_info['sys_descr']
                results['sys_descr'] = descr
                if not device['model']:
                    first_line = descr.split('\r\n')[0].split('\n')[0].strip()
                    if first_line:
                        updates['model'] = first_line[:80]
                if not device['version']:
                    ver_match = _re.search(r'[Vv]ersion\s+([\w\.\(\)\-/]+)', descr)
                    if ver_match:
                        updates['version'] = ver_match.group(1)
            if dev_info.get('uptime'):
                updates['uptime'] = dev_info['uptime']
            if dev_info.get('sys_location'):
                updates['sys_location'] = dev_info['sys_location']

            # CPU / 内存
            if metrics.get('cpu_usage') is not None:
                updates['cpu_usage'] = metrics['cpu_usage']
            if metrics.get('memory_usage') is not None:
                updates['memory_usage'] = metrics['memory_usage']
            if metrics.get('temp') is not None:
                updates['temp'] = metrics['temp']
            if metrics.get('fan_status') is not None:
                updates['fan_status'] = metrics['fan_status']
            if metrics.get('psu_status') is not None:
                updates['psu_status'] = metrics['psu_status']

            # 接口数据
            if intf_data:
                updates['interface_data'] = _json.dumps(intf_data)

            if updates:
                conn2 = get_db_connection()
                try:
                    set_clause = ', '.join(f'{k} = ?' for k in updates)
                    conn2.execute(f'UPDATE devices SET {set_clause} WHERE id = ?',
                                  (*updates.values(), device_id))
                    conn2.commit()
                finally:
                    conn2.close()

            results['synced'] = True
        except Exception as sync_err:
            results['sync_error'] = str(sync_err)

    return results
