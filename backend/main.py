from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.config import settings
from core.logging import setup_logging
from api.health import router as health_router, record_host_resource_snapshot
from api.devices import router as devices_router
from api.jobs import router as jobs_router
from api.templates import router as templates_router
from api.automation import router as automation_router
from api.users import router as users_router
from api.topology import router as topology_router, discover_lldp_neighbors
from api.configs import router as configs_router, run_scheduled_backup, _get_schedule_from_db
from api.playbooks import router as playbooks_router
from services import notification_service
from api.notifications import router as notifications_router
from api.monitoring import router as monitoring_router
from api.audit import router as audit_router
from api.compliance import router as compliance_router
import logging
import os
import sqlite3
import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from urllib import request as urlrequest
from urllib import error as urlerror
from ping3 import ping
from database import DB_PATH, init_db, get_db_connection
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# SNMP Imports removed for stability

# 初始化日志配置
setup_logging()
logger = logging.getLogger(__name__)

# Initialize Database
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──
    logger.info(f"Starting up {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode...")
    seed_data()
    asyncio.create_task(status_monitor())
    record_host_resource_snapshot(sync_alerts=True)
    schedule_cfg = _get_schedule_from_db()
    scheduler.start()
    scheduler.add_job(
        record_host_resource_snapshot,
        'interval',
        minutes=1,
        id='host_resource_sampler',
        name='Host Resource Sampler',
        replace_existing=True,
    )
    reschedule_backup(schedule_cfg)
    # Schedule daily DB maintenance: clean expired sessions, VACUUM
    scheduler.add_job(
        _daily_db_maintenance,
        CronTrigger(hour=3, minute=30),
        id='daily_db_maintenance',
        name='Daily DB Maintenance',
        replace_existing=True,
    )
    logger.info("[Scheduler] APScheduler started")
    yield
    # ── shutdown ──
    scheduler.shutdown(wait=False)
    logger.info("[Scheduler] APScheduler stopped")

app = FastAPI(
    title="NetOps Automation Platform",
    version="1.0.0",
    description="Network Automation Platform API",
    lifespan=lifespan,
)

# ── Rate Limiting ────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restrict to known origins in production; permissive in dev
_cors_origins = ["*"] if os.environ.get("NODE_ENV") == "development" else [
    f"http://localhost:{os.environ.get('PORT', '8003')}",
    f"http://127.0.0.1:{os.environ.get('PORT', '8003')}",
]
# In production, set CORS_ORIGINS env var to a comma-separated list of allowed origins
_env_origins = os.environ.get("CORS_ORIGINS", "").strip()
if _env_origins:
    _cors_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# 注册路由
app.include_router(health_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(automation_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(topology_router, prefix="/api")
app.include_router(configs_router, prefix="/api")
app.include_router(playbooks_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(compliance_router, prefix="/api")

# ── APScheduler ──────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()

def _daily_db_maintenance():
    """Clean expired sessions, vacuum database."""
    conn = get_db_connection()
    try:
        import time
        cutoff = time.time() - 28800  # 8 hours session TTL
        conn.execute('DELETE FROM sessions WHERE created_at < ?', (cutoff,))
        conn.execute('DELETE FROM login_failures WHERE locked_until > 0 AND locked_until < ?', (time.time() - 86400,))
        conn.commit()
    finally:
        conn.close()
    # VACUUM requires its own connection (cannot run inside transaction)
    conn2 = get_db_connection()
    try:
        conn2.execute('VACUUM')
    except Exception as e:
        logger.warning(f"VACUUM failed: {e}")
    finally:
        conn2.close()
    logger.info("[Maintenance] Daily DB maintenance completed")

def reschedule_backup(cfg: dict):
    """Called by configs.py when the user changes the schedule settings."""
    if scheduler.get_job('daily_backup'):
        scheduler.remove_job('daily_backup')
    if cfg.get('enabled', True):
        scheduler.add_job(
            run_scheduled_backup,
            CronTrigger(hour=cfg.get('hour', 2), minute=cfg.get('minute', 0)),
            id='daily_backup',
            name='Daily Config Backup',
            replace_existing=True,
        )
        logger.info(f"[Scheduler] Daily backup scheduled at {cfg['hour']:02d}:{cfg['minute']:02d}")
    else:
        logger.info("[Scheduler] Daily backup disabled")

# Serve static files from dist directory if it exists
if os.path.exists("dist"):
    logger.info("Serving static files from dist directory")
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
else:
    logger.warning("dist directory not found. Frontend will not be served.")

def _db_quick(sql, params=(), fetch=False, fetchall=False):
    """Execute a quick DB operation with its own connection (no long locks)."""
    conn = get_db_connection()
    try:
        if fetchall:
            return conn.execute(sql, params).fetchall()
        elif fetch:
            return conn.execute(sql, params).fetchone()
        else:
            conn.execute(sql, params)
            conn.commit()
    finally:
        conn.close()

def _db_many(sql, rows):
    if not rows:
        return
    conn = get_db_connection()
    try:
        conn.executemany(sql, rows)
        conn.commit()
    finally:
        conn.close()

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

_CST = timezone(timedelta(hours=8))

def _local_now_str() -> str:
    """返回 CST 本地时间字符串，用于通知显示。"""
    return datetime.now(_CST).strftime('%Y-%m-%d %H:%M:%S')

def _send_webhook_notification(payload: dict):
    webhook = (settings.ALERT_NOTIFY_WEBHOOK_URL or '').strip()
    if not webhook:
        return
    data = json.dumps(payload).encode('utf-8')
    req = urlrequest.Request(
        webhook,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlrequest.urlopen(req, timeout=5) as resp:
            if resp.status >= 400:
                logger.warning(f"[Alert] Webhook responded with status {resp.status}")
    except urlerror.URLError as exc:
        logger.warning(f"[Alert] Webhook send failed: {exc}")

def _create_alert_event(dedupe_key: str, severity: str, title: str, message: str, device_id: str, interface_name: str | None = None):
    alert_id = str(uuid.uuid4())
    now_utc = _utc_now_iso()
    now_local = _local_now_str()
    _db_quick('''
        INSERT INTO alert_events (id, dedupe_key, source, severity, title, message, device_id, interface_name, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ''', (alert_id, dedupe_key, 'network_monitor', severity, title, message, device_id, interface_name, now_utc))
    return alert_id, now_local

def _resolve_alert_event(dedupe_key: str):
    now = _utc_now_iso()
    _db_quick('''
        UPDATE alert_events
        SET resolved_at = ?
        WHERE dedupe_key = ? AND resolved_at IS NULL
    ''', (now, dedupe_key))

def _run_telemetry_maintenance():
    # Roll up raw 5s telemetry to 1-minute table and enforce retention windows.
    now = datetime.now(timezone.utc)
    raw_cutoff = (now - timedelta(hours=max(1, settings.TELEMETRY_RAW_RETENTION_HOURS))).replace(microsecond=0).isoformat()
    rollup_cutoff = (now - timedelta(days=max(1, settings.TELEMETRY_ROLLUP_RETENTION_DAYS))).replace(microsecond=0).isoformat()
    recent_window = (now - timedelta(hours=2)).replace(microsecond=0).isoformat()

    _db_quick('''
        INSERT OR REPLACE INTO interface_telemetry_1m (
            ts_minute, device_id, interface_name, samples,
            avg_in_bps, max_in_bps, avg_out_bps, max_out_bps,
            avg_bw_in_pct, max_bw_in_pct, avg_bw_out_pct, max_bw_out_pct,
            in_pkts_sum, out_pkts_sum,
            err_delta_sum, discard_delta_sum
        )
        SELECT
            substr(ts, 1, 16) || ':00+00:00' AS ts_minute,
            device_id,
            interface_name,
            COUNT(*) AS samples,
            AVG(in_bps),
            MAX(in_bps),
            AVG(out_bps),
            MAX(out_bps),
            AVG(bw_in_pct),
            MAX(bw_in_pct),
            AVG(bw_out_pct),
            MAX(bw_out_pct),
            SUM(COALESCE(in_pkts, 0)),
            SUM(COALESCE(out_pkts, 0)),
            SUM(COALESCE(in_errors, 0) + COALESCE(out_errors, 0)),
            SUM(COALESCE(in_discards, 0) + COALESCE(out_discards, 0))
        FROM interface_telemetry_raw
        WHERE ts >= ?
        GROUP BY ts_minute, device_id, interface_name
    ''', (recent_window,))

    _db_quick('DELETE FROM interface_telemetry_raw WHERE ts < ?', (raw_cutoff,))
    _db_quick('DELETE FROM interface_telemetry_1m WHERE ts_minute < ?', (rollup_cutoff,))
    # Keep resolved alerts for one year while preserving open alerts.
    alert_cutoff = (now - timedelta(days=365)).replace(microsecond=0).isoformat()
    _db_quick('DELETE FROM alert_events WHERE resolved_at IS NOT NULL AND resolved_at < ?', (alert_cutoff,))

async def status_monitor():
    from services.snmp_service import collect_device_metrics, collect_interface_data, collect_device_info
    import re as _re
    import time as _time
    # Polling cadence: 5s base cycle for near real-time interface monitoring.
    # Keep slower jobs at equivalent wall-clock intervals via cycle counters.
    monitor_sleep_seconds = 5
    lldp_every_cycles = 60      # ~5 minutes
    intf_every_cycles = 1       # every cycle (~5 seconds)
    info_every_cycles = 120     # ~10 minutes

    # Counter for LLDP discovery (every ~5 minutes)
    # Counter for SNMP interface collection (every ~5 seconds)
    # Counter for device info collection (every ~10 minutes)
    lldp_counter = 0
    intf_counter = 0
    info_counter = 0
    maintenance_counter = 0
    monitor_concurrency = 4
    monitor_batch_size = 20
    sem = asyncio.Semaphore(monitor_concurrency)
    # Store previous interface octets for bandwidth calculation { device_id: { ifname: {in_octets, out_octets, ts} } }
    prev_intf_octets: dict = {}
    # Flap detection: { "device_id:ifname": [timestamp_of_transition, ...] }
    intf_flap_history: dict = {}
    FLAP_WINDOW_SECS = 600   # 10-minute window
    FLAP_THRESHOLD = 4       # >=4 transitions in window = flapping
    # 32-bit / 64-bit counter max values for overflow compensation
    COUNTER32_MAX = 2**32    # 4294967296
    COUNTER64_MAX = 2**64
    # Track currently open alerts to avoid duplicates.
    open_alerts: dict = {}
    # 启动时从数据库恢复未解决的告警，防止重启后丢失恢复通知
    try:
        _open_rows = _db_quick(
            "SELECT dedupe_key, created_at FROM alert_events WHERE resolved_at IS NULL",
            fetchall=True,
        )
        if _open_rows:
            for _row in _open_rows:
                _ts_raw = _row['created_at']
                try:
                    # 转换为本地时间字符串，与新告警格式保持一致
                    _dt = datetime.fromisoformat(_ts_raw).astimezone(_CST)
                    _ts_local = _dt.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    _ts_local = _ts_raw
                open_alerts[_row['dedupe_key']] = _ts_local
            logger.info(f"[Alert] Restored {len(open_alerts)} open alert(s) from database")
    except Exception as _exc:
        logger.warning(f"[Alert] Failed to restore open alerts: {_exc}")
    # Throttle webhook notifications per alert key.
    webhook_last_sent: dict = {}

    def maybe_notify_webhook(dedupe_key: str, severity: str, title: str, message: str,
                               created_at: str, ip_address: str = '', object_name: str = '',
                               status: str = 'active', last_occurrence: str = '',
                               duration_seconds=None, impact_window=None, alert_count=None):
        now_ts = datetime.now(timezone.utc)
        # 恢复通知不受节流限制，且清除节流记录（为下次触发做准备）
        if status == 'resolved':
            webhook_last_sent.pop(dedupe_key, None)
        else:
            last_ts = webhook_last_sent.get(dedupe_key)
            if last_ts and (now_ts - last_ts).total_seconds() < 120:
                return
            webhook_last_sent[dedupe_key] = now_ts

        alert_info = {
            'title':            title,
            'object_name':      object_name or dedupe_key,
            'ip_address':       ip_address,
            'status':           status,
            'severity':         severity,
            'message':          message,
            'first_occurrence': created_at,
            'last_occurrence':  last_occurrence or created_at,
        }
        if duration_seconds is not None:
            alert_info['duration_seconds'] = duration_seconds
        if impact_window is not None:
            alert_info['impact_window'] = impact_window
        if alert_count is not None:
            alert_info['alert_count'] = alert_count

        # 1. 全局 webhook（.env 配置，纯文字兼容）
        if (settings.ALERT_NOTIFY_WEBHOOK_URL or '').strip():
            plain = (
                f"[{severity.upper()}] {title}\n"
                f"对象: {object_name}  IP: {ip_address}\n"
                f"{message}\n"
                f"时间: {created_at}"
            )
            payload = {"msgtype": "text", "text": {"content": plain}}
            asyncio.create_task(asyncio.to_thread(_send_webhook_notification, payload))

        # 2. 遍历所有已启用 notification_channels 的用户
        def _dispatch_user_channels():
            try:
                rows = _db_quick(
                    "SELECT notification_channels, preferred_language FROM users WHERE notification_channels IS NOT NULL AND notification_channels != '{}'",
                    fetchall=True,
                )
                if not rows:
                    return
                for row in rows:
                    try:
                        channels = json.loads(row['notification_channels'] or '{}')
                    except Exception:
                        continue
                    if channels:
                        user_lang = row['preferred_language'] if 'preferred_language' in row.keys() else 'zh'
                        user_alert = {**alert_info, 'lang': user_lang or 'zh'}
                        notification_service.send_all_channels(channels, user_alert)
            except Exception as exc:
                logger.warning(f"[Alert] User channel dispatch failed: {exc}")

        asyncio.create_task(asyncio.to_thread(_dispatch_user_channels))

    def set_alert_state(dedupe_key: str, is_active: bool, severity: str, title: str, message: str,
                         device_id: str, interface_name: str | None = None,
                         ip_address: str = '', status: str = ''):
        currently_open = open_alerts.get(dedupe_key)
        if is_active and not currently_open:
            _, created_at = _create_alert_event(dedupe_key, severity, title, message, device_id, interface_name)
            open_alerts[dedupe_key] = created_at  # store first-occurrence time
            object_name = interface_name if interface_name else dedupe_key
            maybe_notify_webhook(
                dedupe_key, severity, title, message,
                created_at=created_at,
                ip_address=ip_address,
                object_name=object_name,
                status=status or 'active',
                last_occurrence=created_at,
            )
        elif (not is_active) and currently_open:
            _resolve_alert_event(dedupe_key)
            open_alerts.pop(dedupe_key, None)
            now_ts = _local_now_str()
            object_name = interface_name if interface_name else dedupe_key
            # 计算持续时长、影响时间窗、告警次数
            try:
                _dur_start = datetime.fromisoformat(currently_open)
                _dur_end   = datetime.now()
                _duration_seconds = max(0, int((_dur_end - _dur_start).total_seconds()))
            except Exception:
                _duration_seconds = None
            _impact_window = (
                f"{currently_open.split(' ')[-1]} → {now_ts.split(' ')[-1]}"
                if ' ' in currently_open and ' ' in now_ts else None
            )
            _count_row = _db_quick(
                "SELECT COUNT(*) AS cnt FROM alert_events WHERE dedupe_key = ?",
                (dedupe_key,), fetch=True,
            )
            _alert_count = _count_row['cnt'] if _count_row else None
            maybe_notify_webhook(
                dedupe_key, severity, title, message,
                created_at=currently_open,
                ip_address=ip_address,
                object_name=object_name,
                status='resolved',
                last_occurrence=now_ts,
                duration_seconds=_duration_seconds,
                impact_window=_impact_window,
                alert_count=_alert_count,
            )

    async def process_device(device, collect_intf: bool, collect_info: bool):
        async with sem:
            ip = device['ip_address']
            dev_id = device['id']

            def mark_offline_and_clear_cache():
                # Keep UI consistent with real reachability: when a device is offline,
                # discard last SNMP snapshot so stale interface rows are not shown.
                _db_quick('''
                    UPDATE devices
                    SET status = ?, interface_data = ?, cpu_usage = ?, memory_usage = ?
                    WHERE id = ?
                ''', ('offline', '[]', 0, 0, dev_id))
                prev_intf_octets.pop(dev_id, None)

            if not ip or ip == '0.0.0.0':
                mark_offline_and_clear_cache()
                return

            # 1. Ping Check
            dev_label = device['hostname'] or ip
            try:
                # ping() is blocking; run it off the event loop to keep API endpoints responsive.
                delay = await asyncio.to_thread(ping, ip, timeout=2)
                new_status = 'online' if delay is not None else 'offline'

                if device['status'] != new_status:
                    if new_status == 'offline':
                        mark_offline_and_clear_cache()
                        set_alert_state(
                            f"dev_offline:{dev_id}", True, 'critical', 'Device Offline',
                            f"{dev_label} ({ip}) 无法连接，Ping 超时",
                            dev_id, ip_address=ip, status='active',
                        )
                    else:
                        _db_quick('UPDATE devices SET status = ? WHERE id = ?', (new_status, dev_id))
                        set_alert_state(
                            f"dev_offline:{dev_id}", False, 'critical', 'Device Offline',
                            f"{dev_label} ({ip}) 已恢复连接",
                            dev_id, ip_address=ip, status='resolved',
                        )
                    logger.info(f"[Status Monitor] Device {ip} status changed to {new_status}")
            except Exception:
                new_status = 'offline'
                if device.get('status') != 'offline':
                    set_alert_state(
                        f"dev_offline:{dev_id}", True, 'critical', 'Device Offline',
                        f"{dev_label} ({ip}) 无法连接，Ping 超时",
                        dev_id, ip_address=ip, status='active',
                    )
                mark_offline_and_clear_cache()

            # 2. SNMP Metrics Collection (only if online)
            if new_status != 'online':
                # Ensure stale telemetry is never shown for offline devices.
                mark_offline_and_clear_cache()
                return

            cpu_history = json.loads(device['cpu_history'] or '[]')
            mem_history = json.loads(device['memory_history'] or '[]')

            snmp_community = device['snmp_community'] or 'public'
            snmp_port = device['snmp_port'] or 161
            platform = device['platform'] or 'cisco_ios'

            # Try real SNMP collection (no DB lock held during await)
            cpu_usage = None
            memory_usage = None
            temp = None
            fan = None
            psu = None
            try:
                metrics = await collect_device_metrics(ip, platform, snmp_community, snmp_port)
                cpu_usage = metrics.get('cpu_usage')
                memory_usage = metrics.get('memory_usage')
                temp = metrics.get('temp')
                fan = metrics.get('fan_status')
                psu = metrics.get('psu_status')
            except Exception as snmp_err:
                logger.debug(f"[SNMP] {ip} metrics failed: {snmp_err}")

            # Only append to history if we got data
            if cpu_usage is not None:
                cpu_history.append(cpu_usage)
                cpu_history = cpu_history[-20:]
            if memory_usage is not None:
                mem_history.append(memory_usage)
                mem_history = mem_history[-20:]

            _db_quick('''
                UPDATE devices 
                SET cpu_usage = ?, memory_usage = ?, cpu_history = ?, memory_history = ?, temp = ?, fan_status = ?, psu_status = ?
                WHERE id = ?
            ''', (cpu_usage, memory_usage, json.dumps(cpu_history), json.dumps(mem_history), temp, fan, psu, dev_id))

            # CPU / 内存阈值告警
            if cpu_usage is not None:
                cpu_key = f"cpu_high:{dev_id}"
                if float(cpu_usage) >= float(settings.ALERT_CPU_THRESHOLD):
                    set_alert_state(
                        cpu_key, True, 'major', 'CPU Usage High',
                        f"{dev_label} CPU 利用率达到 {cpu_usage:.1f}%，超过阈值 {settings.ALERT_CPU_THRESHOLD}%",
                        dev_id, ip_address=ip, status='active',
                    )
                else:
                    set_alert_state(
                        cpu_key, False, 'major', 'CPU Usage High',
                        f"{dev_label} CPU 利用率已恢复（当前 {cpu_usage:.1f}%）",
                        dev_id, ip_address=ip, status='resolved',
                    )
            if memory_usage is not None:
                mem_key = f"mem_high:{dev_id}"
                if float(memory_usage) >= float(settings.ALERT_MEMORY_THRESHOLD):
                    set_alert_state(
                        mem_key, True, 'major', 'Memory Usage High',
                        f"{dev_label} 内存利用率达到 {memory_usage:.1f}%，超过阈值 {settings.ALERT_MEMORY_THRESHOLD}%",
                        dev_id, ip_address=ip, status='active',
                    )
                else:
                    set_alert_state(
                        mem_key, False, 'major', 'Memory Usage High',
                        f"{dev_label} 内存利用率已恢复（当前 {memory_usage:.1f}%）",
                        dev_id, ip_address=ip, status='resolved',
                    )

            # 3. Device info collection (every ~10 minutes)
            if collect_info:
                try:
                    dev_info = await collect_device_info(ip, snmp_community, snmp_port)
                    updates = {}
                    if dev_info.get('sys_name'):
                        updates['sys_name'] = dev_info['sys_name']
                    if dev_info.get('sys_descr'):
                        descr = dev_info['sys_descr']
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
                    if dev_info.get('sys_contact'):
                        updates['sys_contact'] = dev_info['sys_contact']
                    if updates:
                        set_clause = ', '.join(f'{k} = ?' for k in updates)
                        _db_quick(f'UPDATE devices SET {set_clause} WHERE id = ?',
                                  (*updates.values(), dev_id))
                except Exception as info_err:
                    logger.debug(f"[SNMP] {ip} device info collection failed: {info_err}")

            # 4. Interface data collection
            if collect_intf:
                try:
                    now_ts = _time.monotonic()
                    now_iso = _utc_now_iso()
                    intf_data = await collect_interface_data(ip, snmp_community, snmp_port)
                    if intf_data:
                        # Calculate real-time throughput and bandwidth utilization from previous snapshot.
                        prev = prev_intf_octets.get(dev_id, {})
                        cur_snapshot = {}
                        raw_rows = []
                        for iface in intf_data:
                            iname = iface['name']
                            cur_snapshot[iname] = {
                                'in_octets': iface['in_octets'],
                                'out_octets': iface['out_octets'],
                                'in_errors': iface.get('in_errors', 0),
                                'out_errors': iface.get('out_errors', 0),
                                'in_discards': iface.get('in_discards', 0),
                                'out_discards': iface.get('out_discards', 0),
                                'status': iface.get('status', 'unknown'),
                                'ts': now_ts,
                            }

                            # ── Flap detection: track UP↔DOWN transitions ──
                            flap_key = f"{dev_id}:{iname}"
                            prev_status = str(prev.get(iname, {}).get('status', '')).lower()
                            curr_status = str(iface.get('status', '')).lower()
                            if prev_status and prev_status != curr_status and prev_status in ('up', 'down') and curr_status in ('up', 'down'):
                                hist = intf_flap_history.setdefault(flap_key, [])
                                hist.append(now_ts)
                            # Prune old entries outside the window
                            hist = intf_flap_history.get(flap_key, [])
                            cutoff = now_ts - FLAP_WINDOW_SECS
                            hist[:] = [t for t in hist if t > cutoff]
                            iface['flapping'] = len(hist) >= FLAP_THRESHOLD
                            flap_alert_key = f"if_flap:{dev_id}:{iname}"
                            set_alert_state(
                                flap_alert_key, iface['flapping'], 'major', 'Interface Flapping',
                                (
                                    f"{iname} 接口震荡：10 分钟内状态翻转 {len(hist)} 次"
                                    if iface['flapping'] else
                                    f"{iname} 接口震荡已平息"
                                ),
                                dev_id, iname,
                                ip_address=ip,
                                status='active' if iface['flapping'] else 'resolved',
                            )

                            if iname in prev:
                                dt = now_ts - prev[iname]['ts']
                                if dt > 0:
                                    # Counter overflow compensation (32-bit wrap-around)
                                    raw_delta_in = iface['in_octets'] - prev[iname]['in_octets']
                                    raw_delta_out = iface['out_octets'] - prev[iname]['out_octets']
                                    delta_in = raw_delta_in if raw_delta_in >= 0 else raw_delta_in + COUNTER32_MAX
                                    delta_out = raw_delta_out if raw_delta_out >= 0 else raw_delta_out + COUNTER32_MAX
                                    # Sanity: if delta implies >100 Gbps, likely a reset — discard
                                    max_reasonable = 100_000_000_000 * dt / 8  # 100Gbps in bytes
                                    if delta_in > max_reasonable:
                                        delta_in = 0
                                    if delta_out > max_reasonable:
                                        delta_out = 0
                                    in_bps = (delta_in * 8) / dt
                                    out_bps = (delta_out * 8) / dt
                                    iface['in_bps'] = round(in_bps, 1)
                                    iface['out_bps'] = round(out_bps, 1)

                                    speed_bps = iface.get('speed_mbps', 0) * 1_000_000
                                    if speed_bps > 0:
                                        bw_in = round((in_bps / speed_bps) * 100, 1)
                                        bw_out = round((out_bps / speed_bps) * 100, 1)
                                        iface['bw_in_pct'] = min(bw_in, 100.0)
                                        iface['bw_out_pct'] = min(bw_out, 100.0)

                            # Persist high-frequency telemetry for short-term tracing.
                            raw_rows.append((
                                now_iso,
                                dev_id,
                                iname,
                                iface.get('status'),
                                iface.get('speed_mbps', 0),
                                iface.get('in_bps'),
                                iface.get('out_bps'),
                                iface.get('bw_in_pct'),
                                iface.get('bw_out_pct'),
                                iface.get('in_ucast_pkts', 0),
                                iface.get('out_ucast_pkts', 0),
                                iface.get('in_errors', 0),
                                iface.get('out_errors', 0),
                                iface.get('in_discards', 0),
                                iface.get('out_discards', 0),
                            ))

                            # Basic alert rules: interface down / high utilization.
                            # Requirement: only trigger DOWN alert on state transition UP -> DOWN.
                            if settings.ALERT_INTERFACE_DOWN_ENABLED and iface.get('speed_mbps', 0) > 0:
                                prev_status = str(prev.get(iname, {}).get('status', '')).lower()
                                curr_status = str(iface.get('status', '')).lower()
                                down_key = f"if_down:{dev_id}:{iname}"
                                if prev_status == 'up' and curr_status == 'down':
                                    set_alert_state(
                                        down_key, True, 'major', 'Interface Down',
                                        f"{iname} 状态变更：UP → DOWN，请检查端口连接和用线",
                                        dev_id, iname,
                                        ip_address=ip, status='active',
                                    )
                                elif prev_status == 'down' and curr_status == 'up':
                                    set_alert_state(
                                        down_key, False, 'major', 'Interface Down',
                                        f"{iname} 状态恢复：DOWN → UP",
                                        dev_id, iname,
                                        ip_address=ip, status='resolved',
                                    )

                            max_util = max(float(iface.get('bw_in_pct') or 0), float(iface.get('bw_out_pct') or 0))
                            util_active = max_util >= float(settings.ALERT_INTERFACE_UTIL_THRESHOLD)
                            util_key = f"if_util:{dev_id}:{iname}"
                            if util_active:
                                set_alert_state(
                                    util_key, True,
                                    'warning' if max_util < 95 else 'critical',
                                    'Interface Utilization High',
                                    f"{iname} 带宽占用率达到 {max_util:.1f}%，超过阈值 {settings.ALERT_INTERFACE_UTIL_THRESHOLD}%",
                                    dev_id, iname,
                                    ip_address=ip, status='active',
                                )
                            else:
                                set_alert_state(
                                    util_key, False,
                                    'major',
                                    'Interface Utilization High',
                                    f"{iname} 带宽占用率已恢复正常（当前 {max_util:.1f}%）",
                                    dev_id, iname,
                                    ip_address=ip, status='resolved',
                                )

                        prev_intf_octets[dev_id] = cur_snapshot
                        _db_many('''
                            INSERT INTO interface_telemetry_raw (
                                ts, device_id, interface_name, status, speed_mbps,
                                in_bps, out_bps, bw_in_pct, bw_out_pct,
                                in_pkts, out_pkts,
                                in_errors, out_errors, in_discards, out_discards
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', raw_rows)
                        _db_quick('UPDATE devices SET interface_data = ? WHERE id = ?',
                                  (json.dumps(intf_data), dev_id))
                except Exception as intf_err:
                    logger.debug(f"[SNMP] {ip} interface collection failed: {intf_err}")

    while True:
        try:
            if os.path.exists(DB_PATH):
                # Read device list with a short-lived connection
                devices = _db_quick('SELECT * FROM devices', fetchall=True)

                collect_intf = intf_counter == 0
                collect_info = info_counter == 0
                for i in range(0, len(devices), monitor_batch_size):
                    batch = devices[i:i + monitor_batch_size]
                    await asyncio.gather(*(process_device(device, collect_intf, collect_info) for device in batch))
                    # Let API requests run between monitor chunks under high device counts.
                    await asyncio.sleep(0)

                intf_counter = (intf_counter + 1) % intf_every_cycles
                info_counter = (info_counter + 1) % info_every_cycles
                maintenance_counter += 1

                # Every ~60s: aggregate 1m telemetry and enforce retention windows.
                if maintenance_counter >= 12:
                    maintenance_counter = 0
                    _run_telemetry_maintenance()

                # Check if it's time for LLDP discovery
                lldp_counter += 1
                if lldp_counter >= lldp_every_cycles:
                    lldp_counter = 0
                    logger.info("[Status Monitor] Triggering periodic LLDP discovery...")
                    online_devices = _db_quick('SELECT id FROM devices WHERE status = "online"', fetchall=True)
                    for d in online_devices:
                        asyncio.create_task(discover_lldp_neighbors(d['id']))

        except Exception as e:
            logger.error(f"[Status Monitor] Error: {e}")
        
        await asyncio.sleep(monitor_sleep_seconds)

def seed_data():
    if not os.path.exists(DB_PATH):
        return
    conn = get_db_connection()
    
    try:
        # Check if devices table is empty
        count = conn.execute('SELECT COUNT(*) as count FROM devices').fetchone()['count']
        if count == 0:
            import uuid
            conn.execute('INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, cpu_usage, memory_usage, snmp_community, role, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (str(uuid.uuid4()), 'Core-SW-01', '192.168.1.1', 'cisco_ios', 'online', 'compliant', 'admin', 'admin', 12, 45, 'public', 'Core', 'HQ'))
            conn.execute('INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, cpu_usage, memory_usage, snmp_community, role, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (str(uuid.uuid4()), 'Edge-RTR-02', '10.0.0.5', 'juniper_junos', 'online', 'non-compliant', 'admin', 'admin', 28, 62, 'public', 'Edge', 'Branch-A'))
            conn.execute('INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, cpu_usage, memory_usage, snmp_community, role, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (str(uuid.uuid4()), 'Access-SW-01', '10.0.0.10', 'cisco_ios', 'online', 'compliant', 'admin', 'admin', 15, 30, 'public', 'Access', 'HQ'))
            conn.execute('INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, cpu_usage, memory_usage, snmp_community, role, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (str(uuid.uuid4()), 'Access-SW-02', '10.0.0.11', 'cisco_ios', 'online', 'compliant', 'admin', 'admin', 18, 35, 'public', 'Access', 'HQ'))
            conn.execute('INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, username, password, cpu_usage, memory_usage, snmp_community, role, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (str(uuid.uuid4()), 'Mock-Device-01', '127.0.0.1', 'cisco_ios', 'online', 'compliant', 'test', 'test', 5, 20, 'public', 'Test', 'Lab'))
        
        # Check if users table is empty — only insert default admin if no users exist
        count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
        if count == 0:
            import bcrypt as _bcrypt
            _hashed_default = _bcrypt.hashpw('admin'.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')
            conn.execute('INSERT INTO users (id, username, password, role, status, last_login) VALUES (?, ?, ?, ?, ?, ?)',
                         ('1', 'admin', _hashed_default, 'Administrator', 'active', 'Never'))
        
        # Check if templates table is empty
        count = conn.execute('SELECT COUNT(*) as count FROM templates').fetchone()['count']
        if count == 0:
            import uuid
            from datetime import datetime
            now = datetime.now().isoformat()
            templates = [
                (str(uuid.uuid4()), 'Basic SSH Setup', 'cli', 'security', 'Cisco', 'ip domain-name local.net\ncrypto key generate rsa modulus 2048\nip ssh version 2\nline vty 0 4\n transport input ssh\n login local', now),
                (str(uuid.uuid4()), 'Standard ACL', 'cli', 'security', 'Cisco', 'access-list 10 permit 192.168.1.0 0.0.0.255\naccess-list 10 deny any\ninterface GigabitEthernet0/1\n ip access-group 10 in', now),
                (str(uuid.uuid4()), 'BGP Configuration', 'cli', 'routing', 'Cisco', 'router bgp 65000\n bgp router-id 10.0.0.1\n neighbor 10.0.0.2 remote-as 65001\n network 192.168.1.0 mask 255.255.255.0', now),
                (str(uuid.uuid4()), 'OSPF Single Area', 'cli', 'routing', 'Cisco', 'router ospf 1\n router-id 10.0.0.1\n network 10.0.0.0 0.0.0.255 area 0', now),
                (str(uuid.uuid4()), 'VLAN Creation', 'cli', 'switching', 'Cisco', 'vlan 10\n name Users\nvlan 20\n name Servers', now),
                
                (str(uuid.uuid4()), 'Basic SSH Setup', 'cli', 'security', 'Juniper', 'set system services ssh root-login deny\nset system services ssh protocol-version v2', now),
                (str(uuid.uuid4()), 'Firewall Filter (ACL)', 'cli', 'security', 'Juniper', 'set firewall family inet filter PROTECT term 1 from source-address 192.168.1.0/24\nset firewall family inet filter PROTECT term 1 then accept\nset firewall family inet filter PROTECT term 2 then reject', now),
                (str(uuid.uuid4()), 'BGP Configuration', 'cli', 'routing', 'Juniper', 'set routing-options autonomous-system 65000\nset protocols bgp group EXTERNAL type external\nset protocols bgp group EXTERNAL peer-as 65001\nset protocols bgp group EXTERNAL neighbor 10.0.0.2', now),
                (str(uuid.uuid4()), 'OSPF Single Area', 'cli', 'routing', 'Juniper', 'set protocols ospf area 0.0.0.0 interface ge-0/0/0.0', now),
                (str(uuid.uuid4()), 'VLAN Creation', 'cli', 'switching', 'Juniper', 'set vlans USERS vlan-id 10\nset vlans SERVERS vlan-id 20', now),

                (str(uuid.uuid4()), 'Basic SSH Setup', 'cli', 'security', 'Huawei', 'rsa local-key-pair create\nuser-interface vty 0 4\n authentication-mode aaa\n protocol inbound ssh', now),
                (str(uuid.uuid4()), 'Basic ACL', 'cli', 'security', 'Huawei', 'acl number 2000\n rule 5 permit source 192.168.1.0 0.0.0.255\n rule 10 deny', now),
                (str(uuid.uuid4()), 'BGP Configuration', 'cli', 'routing', 'Huawei', 'bgp 65000\n router-id 10.0.0.1\n peer 10.0.0.2 as-number 65001\n ipv4-family unicast\n  network 192.168.1.0 255.255.255.0', now),
                (str(uuid.uuid4()), 'OSPF Single Area', 'cli', 'routing', 'Huawei', 'ospf 1 router-id 10.0.0.1\n area 0.0.0.0\n  network 10.0.0.0 0.0.0.255', now),
                (str(uuid.uuid4()), 'VLAN Creation', 'cli', 'switching', 'Huawei', 'vlan batch 10 20\nvlan 10\n name Users\nvlan 20\n name Servers', now),

                (str(uuid.uuid4()), 'Basic SSH Setup', 'cli', 'security', 'Arista', 'management ssh\n server-port 22\n no shutdown', now),
                (str(uuid.uuid4()), 'Standard ACL', 'cli', 'security', 'Arista', 'ip access-list standard PROTECT\n permit 192.168.1.0/24\n deny any', now),
                (str(uuid.uuid4()), 'BGP Configuration', 'cli', 'routing', 'Arista', 'router bgp 65000\n router-id 10.0.0.1\n neighbor 10.0.0.2 remote-as 65001\n network 192.168.1.0/24', now),
                (str(uuid.uuid4()), 'OSPF Single Area', 'cli', 'routing', 'Arista', 'router ospf 1\n router-id 10.0.0.1\n network 10.0.0.0/24 area 0.0.0.0', now),
                (str(uuid.uuid4()), 'VLAN Creation', 'cli', 'switching', 'Arista', 'vlan 10\n name Users\nvlan 20\n name Servers', now)
            ]
            conn.executemany('INSERT INTO templates (id, name, type, category, vendor, content, last_used) VALUES (?, ?, ?, ?, ?, ?, ?)', templates)

        conn.commit()
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8003"))
    uvicorn.run(app, host="0.0.0.0", port=port)
