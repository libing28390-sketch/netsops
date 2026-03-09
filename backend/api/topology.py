from fastapi import APIRouter, HTTPException, BackgroundTasks
import os
import uuid
import json
import logging
from datetime import datetime
from netmiko import ConnectHandler
from scrapli.driver.core import AsyncIOSXEDriver, AsyncNXOSDriver, AsyncEOSDriver, AsyncJunosDriver
from scrapli_community.huawei.vrp.async_driver import AsyncHuaweiVRPDriver
from scrapli_community.hp.comware.async_driver import AsyncHPComwareDriver
import asyncio
from database import get_db_connection
from drivers.ssh_compat import build_netmiko_compatibility_kwargs

router = APIRouter()
logger = logging.getLogger(__name__)

# Map our platform strings to Netmiko device_type
PLATFORM_MAP = {
    'cisco_ios': 'cisco_ios',
    'cisco_nxos': 'cisco_nxos',
    'juniper_junos': 'juniper_junos',
    'arista_eos': 'arista_eos',
    'fortinet_fortios': 'fortinet',
    'huawei_vrp': 'huawei',
    'h3c_comware': 'hp_comware',
    'ruijie_rgos': 'ruijie_os'
}

# Map our platform strings to Scrapli drivers
SCRAPLI_DRIVERS = {
    'cisco_ios': AsyncIOSXEDriver,
    'cisco_nxos': AsyncNXOSDriver,
    'juniper_junos': AsyncJunosDriver,
    'arista_eos': AsyncEOSDriver,
    'huawei_vrp': AsyncHuaweiVRPDriver,
    'h3c_comware': AsyncHPComwareDriver,
}

# 这类平台在实验环境中经常只支持旧 SHA1 KEX。
# 为避免后台 LLDP 定时任务不断触发 NO_MATCH，直接走 Netmiko 兼容路径。
SCRAPLI_LEGACY_SSH_SKIP_PLATFORMS = frozenset({
    'cisco_ios',
})

# LLDP commands per platform
LLDP_COMMANDS = {
    'cisco_ios': 'show lldp neighbors',
    'cisco_nxos': 'show lldp neighbors',
    'juniper_junos': 'show lldp neighbors',
    'arista_eos': 'show lldp neighbors',
    'huawei_vrp': 'display lldp neighbor brief',
    'h3c_comware': 'display lldp neighbor brief',
}

async def discover_lldp_neighbors(device_id: str):
    conn = get_db_connection()
    try:
        device = conn.execute('SELECT * FROM devices WHERE id = ?', (device_id,)).fetchone()
        if not device:
            return
        
        device_dict = dict(device)
        platform = device_dict.get('platform', 'cisco_ios')
        
        # Try Scrapli first for speed, unless the platform is known to be legacy-SSH-sensitive.
        driver_class = SCRAPLI_DRIVERS.get(platform)
        if platform in SCRAPLI_LEGACY_SSH_SKIP_PLATFORMS:
            logger.info(
                f"Skipping Scrapli LLDP discovery for {device_dict['hostname']} "
                f"({platform}) and using Netmiko compatibility path directly"
            )
            driver_class = None

        if driver_class:
            scrapli_device = {
                'host': device_dict.get('ip_address'),
                'auth_username': device_dict.get('username'),
                'auth_password': device_dict.get('password'),
                'auth_strict_key': False,
                'port': 22,
                'transport': 'asyncssh',
                'timeout_socket': 5,
                'timeout_transport': 5,
                'timeout_ops': 10,
            }
            logger.info(f"Attempting Scrapli LLDP discovery for {device_dict['hostname']} ({device_dict.get('ip_address')})")
            try:
                async with driver_class(**scrapli_device) as conn_scrapli:
                    logger.info(f"Scrapli connected to {device_dict['hostname']} for LLDP")
                    command = LLDP_COMMANDS.get(platform, 'show lldp neighbors')
                    response = await conn_scrapli.send_command(command)
                    # Scrapli has built-in textfsm support if ntc-templates is installed
                    neighbors = response.textfsm_parse_output()
                    if neighbors:
                        await process_neighbors(conn, device_id, neighbors)
                        return
            except Exception as e:
                logger.warning(f"Scrapli LLDP discovery failed for {device_dict['hostname']}: {str(e)}, falling back to Netmiko")
                import traceback
                logger.debug(traceback.format_exc())

        # Fallback to Netmiko
        device_type = PLATFORM_MAP.get(platform, 'cisco_ios')
        netmiko_device = {
            'device_type': device_type,
            'host': device_dict.get('ip_address'),
            'username': device_dict.get('username'),
            'password': device_dict.get('password'),
            'port': 22,
            'fast_cli': True,
        }
        netmiko_device.update(build_netmiko_compatibility_kwargs())

        try:
            def _run_discovery():
                with ConnectHandler(**netmiko_device) as net_connect:
                    command = LLDP_COMMANDS.get(platform, 'show lldp neighbors')
                    # use_textfsm=True will use ntc-templates
                    neighbors = net_connect.send_command(command, use_textfsm=True)
                    return neighbors

            neighbors = await asyncio.get_event_loop().run_in_executor(None, _run_discovery)
            
            if isinstance(neighbors, list):
                await process_neighbors(conn, device_id, neighbors)
            else:
                logger.warning(f"LLDP discovery for {device_dict['hostname']} failed to parse with TextFSM")
        except Exception as e:
            logger.error(f"LLDP discovery error for {device_dict['hostname']}: {e}")
    finally:
        conn.close()

async def process_neighbors(conn, device_id, neighbors):
    # Clear old links for this source device
    conn.execute('DELETE FROM links WHERE source_device_id = ?', (device_id,))
    
    for neighbor in neighbors:
        # Neighbor parsing depends on the template, but usually has:
        # 'neighbor', 'local_interface', 'neighbor_interface' or similar
        neighbor_hostname = neighbor.get('neighbor') or neighbor.get('neighbor_id') or neighbor.get('remote_system_name') or neighbor.get('destination_host')
        local_port = neighbor.get('local_interface') or neighbor.get('local_port') or neighbor.get('local_port_id')
        remote_port = neighbor.get('neighbor_interface') or neighbor.get('remote_port') or neighbor.get('port_id')
        
        if not neighbor_hostname:
            continue
            
        # Try to find the target device in our inventory
        # We search by hostname (case-insensitive) or IP if available
        target = conn.execute('SELECT id FROM devices WHERE LOWER(hostname) = LOWER(?)', (neighbor_hostname,)).fetchone()
        
        if target:
            link_id = str(uuid.uuid4())
            conn.execute('''
                INSERT INTO links (id, source_device_id, source_port, target_device_id, target_port, last_seen)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (link_id, device_id, local_port, target['id'], remote_port, datetime.now().isoformat()))
    
    conn.commit()

@router.post("/topology/discover")
async def trigger_discovery(background_tasks: BackgroundTasks):
    conn = get_db_connection()
    try:
        devices = conn.execute('SELECT id FROM devices WHERE status = "online"').fetchall()
    finally:
        conn.close()
    
    for device in devices:
        background_tasks.add_task(discover_lldp_neighbors, device['id'])
        
    return {"status": "Discovery started in background"}

@router.get("/topology/links")
def get_links():
    conn = get_db_connection()
    try:
        links = conn.execute('''
            SELECT l.*, s.hostname as source_hostname, t.hostname as target_hostname 
            FROM links l
            JOIN devices s ON l.source_device_id = s.id
            JOIN devices t ON l.target_device_id = t.id
        ''').fetchall()
        return [dict(l) for l in links]
    finally:
        conn.close()
