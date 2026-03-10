import json
import uuid
from datetime import datetime, timezone
from typing import Any

from database import get_db_connection
from services import notification_service


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_runtime_status(row: dict[str, Any], now_iso: str | None = None) -> str:
    status = str(row.get('status') or 'scheduled').lower()
    if status == 'cancelled':
        return 'cancelled'
    now_dt = datetime.fromisoformat((now_iso or utc_now_iso()).replace('Z', '+00:00'))
    start_dt = datetime.fromisoformat(str(row.get('starts_at')).replace('Z', '+00:00'))
    end_dt = datetime.fromisoformat(str(row.get('ends_at')).replace('Z', '+00:00'))
    if now_dt < start_dt:
        return 'scheduled'
    if now_dt > end_dt:
        return 'expired'
    return 'active'


def alert_matches_window(window: dict[str, Any], alert: dict[str, Any]) -> bool:
    target_ip = str(window.get('target_ip') or '').strip()
    alert_ip = str(alert.get('ip_address') or '').strip()
    if not target_ip or not alert_ip or target_ip != alert_ip:
        return False

    title_pattern = str(window.get('title_pattern') or '').strip().lower()
    if title_pattern and title_pattern not in str(alert.get('title') or '').lower():
        return False

    message_pattern = str(window.get('message_pattern') or '').strip().lower()
    if message_pattern and message_pattern not in str(alert.get('message') or '').lower():
        return False

    return True


def list_windows(status: str = 'all') -> list[dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT id, name, target_ip, title_pattern, message_pattern, starts_at, ends_at,
                   notify_user_ids, reason, status, created_by, created_at, updated_at, last_match_count
            FROM alert_maintenance_windows
            ORDER BY starts_at DESC
            '''
        ).fetchall()
        items: list[dict[str, Any]] = []
        now_iso = utc_now_iso()
        for row in rows:
            item = dict(row)
            try:
                item['notify_user_ids'] = json.loads(item.get('notify_user_ids') or '[]')
            except Exception:
                item['notify_user_ids'] = []
            item['runtime_status'] = _normalize_runtime_status(item, now_iso)
            if status != 'all' and item['runtime_status'] != status:
                continue
            items.append(item)
        return items
    finally:
        conn.close()


def list_windows_paginated(
    status: str = 'all',
    search: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    all_items = list_windows(status=status)
    query = str(search or '').strip().lower()
    if query:
        filtered_items = []
        for item in all_items:
            haystack = ' '.join([
                str(item.get('name') or ''),
                str(item.get('target_ip') or ''),
                str(item.get('title_pattern') or ''),
                str(item.get('message_pattern') or ''),
                str(item.get('reason') or ''),
                str(item.get('created_by') or ''),
            ]).lower()
            if query in haystack:
                filtered_items.append(item)
    else:
        filtered_items = all_items

    total = len(filtered_items)
    current_page = max(1, int(page or 1))
    current_page_size = max(1, int(page_size or 20))
    start = (current_page - 1) * current_page_size
    end = start + current_page_size
    return {
        'items': filtered_items[start:end],
        'total': total,
        'page': current_page,
        'page_size': current_page_size,
    }


def find_active_window_for_alert(alert: dict[str, Any], conn=None) -> dict[str, Any] | None:
    owns_conn = conn is None
    conn = conn or get_db_connection()
    try:
        now_iso = utc_now_iso()
        rows = conn.execute(
            '''
            SELECT id, name, target_ip, title_pattern, message_pattern, starts_at, ends_at,
                   notify_user_ids, reason, status, created_by, created_at, updated_at, last_match_count
            FROM alert_maintenance_windows
            WHERE status != 'cancelled' AND starts_at <= ? AND ends_at >= ? AND target_ip = ?
            ORDER BY starts_at DESC
            ''',
            (now_iso, now_iso, str(alert.get('ip_address') or '').strip()),
        ).fetchall()
        for row in rows:
            item = dict(row)
            if alert_matches_window(item, alert):
                return item
        return None
    finally:
        if owns_conn:
            conn.close()


def preview_matches(payload: dict[str, Any]) -> dict[str, Any]:
    conn = get_db_connection()
    try:
        query = '''
        SELECT a.id, a.title, a.message, a.interface_name, a.created_at, d.hostname, d.ip_address, d.site
        FROM alert_events a
        LEFT JOIN devices d ON d.id = a.device_id
        WHERE a.resolved_at IS NULL
          AND COALESCE(d.ip_address, '') = ?
        ORDER BY a.created_at DESC
        '''
        rows = conn.execute(query, (str(payload.get('target_ip') or '').strip(),)).fetchall()
        candidates = []
        for row in rows:
            item = dict(row)
            if alert_matches_window(payload, item):
                candidates.append(item)
        return {
            'count': len(candidates),
            'items': candidates[:20],
        }
    finally:
        conn.close()


def _append_note(existing: str | None, suffix: str) -> str:
    existing_text = str(existing or '').strip()
    if not existing_text:
        return suffix
    if suffix in existing_text:
        return existing_text
    return f"{existing_text}\n{suffix}"


def suppress_existing_alerts(window: dict[str, Any], conn=None) -> int:
    owns_conn = conn is None
    conn = conn or get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT a.id, a.title, a.message, a.note, d.ip_address
            FROM alert_events a
            LEFT JOIN devices d ON d.id = a.device_id
            WHERE a.resolved_at IS NULL AND COALESCE(d.ip_address, '') = ?
            ''',
            (str(window.get('target_ip') or '').strip(),),
        ).fetchall()
        now_iso = utc_now_iso()
        match_count = 0
        for row in rows:
            row_dict = dict(row)
            if not alert_matches_window(window, row_dict):
                continue
            note = _append_note(row_dict.get('note'), f"Suppressed by maintenance window: {window.get('name')}")
            conn.execute(
                "UPDATE alert_events SET workflow_status = 'suppressed', note = ?, updated_at = ? WHERE id = ?",
                (note, now_iso, row_dict['id']),
            )
            match_count += 1
        return match_count
    finally:
        if owns_conn:
            conn.commit()
            conn.close()


def create_window(payload: dict[str, Any]) -> dict[str, Any]:
    now_iso = utc_now_iso()
    window_id = str(uuid.uuid4())
    starts_at = str(payload.get('starts_at') or '').strip()
    ends_at = str(payload.get('ends_at') or '').strip()
    target_ip = str(payload.get('target_ip') or '').strip()
    name = str(payload.get('name') or f'Maintenance {target_ip}').strip()
    if not target_ip:
        raise ValueError('target_ip is required')
    if not starts_at or not ends_at:
        raise ValueError('starts_at and ends_at are required')
    if datetime.fromisoformat(starts_at.replace('Z', '+00:00')) >= datetime.fromisoformat(ends_at.replace('Z', '+00:00')):
        raise ValueError('ends_at must be later than starts_at')
    if not name:
        raise ValueError('name is required')

    window = {
        'id': window_id,
        'name': name,
        'target_ip': target_ip,
        'title_pattern': str(payload.get('title_pattern') or '').strip(),
        'message_pattern': str(payload.get('message_pattern') or '').strip(),
        'starts_at': starts_at,
        'ends_at': ends_at,
        'notify_user_ids': payload.get('notify_user_ids') or [],
        'reason': str(payload.get('reason') or '').strip(),
        'status': 'scheduled',
        'created_by': str(payload.get('created_by') or 'system').strip() or 'system',
        'created_at': now_iso,
        'updated_at': now_iso,
        'last_match_count': 0,
    }

    conn = get_db_connection()
    try:
        existing = conn.execute(
            'SELECT id FROM alert_maintenance_windows WHERE LOWER(name) = LOWER(?) LIMIT 1',
            (window['name'],),
        ).fetchone()
        if existing:
            raise ValueError('name already exists')
        match_count = suppress_existing_alerts(window, conn=conn)
        window['last_match_count'] = match_count
        conn.execute(
            '''
            INSERT INTO alert_maintenance_windows (
                id, name, target_ip, title_pattern, message_pattern, starts_at, ends_at,
                notify_user_ids, reason, status, created_by, created_at, updated_at, last_match_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                window['id'], window['name'], window['target_ip'], window['title_pattern'], window['message_pattern'],
                window['starts_at'], window['ends_at'], json.dumps(window['notify_user_ids']), window['reason'],
                window['status'], window['created_by'], window['created_at'], window['updated_at'], window['last_match_count'],
            ),
        )
        conn.commit()
        return window
    finally:
        conn.close()


def cancel_window(window_id: str) -> None:
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM alert_maintenance_windows WHERE id = ?', (window_id,)).fetchone()
        if not row:
            raise ValueError('Window not found')
        now_iso = utc_now_iso()
        conn.execute("UPDATE alert_maintenance_windows SET status = 'cancelled', updated_at = ? WHERE id = ?", (now_iso, window_id))
        conn.commit()
    finally:
        conn.close()


def delete_window(window_id: str) -> None:
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM alert_maintenance_windows WHERE id = ?', (window_id,)).fetchone()
        if not row:
            raise ValueError('Window not found')
        conn.execute('DELETE FROM alert_maintenance_windows WHERE id = ?', (window_id,))
        conn.commit()
    finally:
        conn.close()


def reopen_expired_suppressed_alerts() -> list[dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT a.id, a.dedupe_key, a.source, a.severity, a.title, a.message, a.device_id,
                   a.interface_name, a.created_at, a.note, d.hostname, d.ip_address, d.site
            FROM alert_events a
            LEFT JOIN devices d ON d.id = a.device_id
            WHERE a.resolved_at IS NULL AND a.workflow_status = 'suppressed'
            ORDER BY a.created_at ASC
            '''
        ).fetchall()
        reopened: list[dict[str, Any]] = []
        now_iso = utc_now_iso()
        for row in rows:
            item = dict(row)
            if find_active_window_for_alert(item, conn=conn):
                continue
            conn.execute(
                "UPDATE alert_events SET workflow_status = 'open', updated_at = ? WHERE id = ?",
                (now_iso, item['id']),
            )
            item['workflow_status'] = 'open'
            reopened.append(item)
        conn.commit()
        return reopened
    finally:
        conn.close()


def notify_contacts(window: dict[str, Any], user_rows: list[dict[str, Any]]) -> None:
    if not user_rows:
        return
    for user in user_rows:
        try:
            channels = json.loads(user.get('notification_channels') or '{}')
        except Exception:
            channels = {}
        if not channels:
            continue
        lang = user.get('preferred_language') or 'zh'
        alert = {
            'title': '告警维护窗通知' if lang == 'zh' else 'Alert Maintenance Window',
            'object_name': window.get('target_ip') or 'maintenance',
            'ip_address': window.get('target_ip') or '',
            'status': 'acknowledged',
            'severity': 'info',
            'message': (
                f"维护窗：{window.get('name')}\n开始：{window.get('starts_at')}\n结束：{window.get('ends_at')}\n"
                f"匹配规则：title contains '{window.get('title_pattern') or '*'}', message contains '{window.get('message_pattern') or '*'}'\n"
                f"原因：{window.get('reason') or '未填写'}\n当前命中：{window.get('last_match_count', 0)}"
                if lang == 'zh' else
                f"Window: {window.get('name')}\nStart: {window.get('starts_at')}\nEnd: {window.get('ends_at')}\n"
                f"Match: title contains '{window.get('title_pattern') or '*'}', message contains '{window.get('message_pattern') or '*'}'\n"
                f"Reason: {window.get('reason') or 'n/a'}\nCurrent matches: {window.get('last_match_count', 0)}"
            ),
            'first_occurrence': window.get('starts_at') or utc_now_iso(),
            'last_occurrence': window.get('ends_at') or utc_now_iso(),
            'lang': lang,
        }
        notification_service.send_all_channels(channels, alert)