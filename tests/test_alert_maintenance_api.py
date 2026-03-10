import database


def _insert_device(conn, *, device_id='dev-1', hostname='core-sw-01', ip_address='192.0.2.10', site='dc-1'):
    conn.execute(
        '''
        INSERT INTO devices (id, hostname, ip_address, platform, status, compliance, site)
        VALUES (?, ?, ?, 'h3c', 'online', 'compliant', ?)
        ''',
        (device_id, hostname, ip_address, site),
    )


def _insert_alert(conn, *, alert_id='alert-1', device_id='dev-1', title='Interface Down', message='xe-0/0/1 down'):
    now = database._utc_now_iso()
    conn.execute(
        '''
        INSERT INTO alert_events (
            id, dedupe_key, source, severity, title, message, device_id, interface_name,
            created_at, resolved_at, workflow_status, note, updated_at
        ) VALUES (?, ?, 'network_monitor', 'major', ?, ?, ?, 'xe-0/0/1', ?, NULL, 'open', '', ?)
        ''',
        (alert_id, f'if_down:{device_id}:xe-0/0/1', title, message, device_id, now, now),
    )


def test_maintenance_preview_create_and_cancel_flow(client, db_conn):
    _insert_device(db_conn)
    _insert_alert(db_conn)
    db_conn.commit()

    preview_response = client.post(
        '/api/alerts/maintenance-windows/preview',
        json={
            'target_ip': '192.0.2.10',
            'title_pattern': 'interface',
            'message_pattern': 'xe-0/0/1',
        },
    )
    assert preview_response.status_code == 200
    preview = preview_response.json()
    assert preview['count'] == 1
    assert preview['items'][0]['title'] == 'Interface Down'

    create_response = client.post(
        '/api/alerts/maintenance-windows',
        json={
            'name': 'Core Switch Maintenance',
            'target_ip': '192.0.2.10',
            'title_pattern': 'interface',
            'message_pattern': 'xe-0/0/1',
            'starts_at': '2026-03-10T10:00:00Z',
            'ends_at': '2026-03-10T11:00:00Z',
            'notify_user_ids': [],
            'reason': 'planned circuit migration',
            'created_by': 'pytest',
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created['name'] == 'Core Switch Maintenance'
    assert created['last_match_count'] == 1

    alert_row = db_conn.execute(
        'SELECT workflow_status, note FROM alert_events WHERE id = ?',
        ('alert-1',),
    ).fetchone()
    assert alert_row['workflow_status'] == 'suppressed'
    assert 'Core Switch Maintenance' in alert_row['note']

    list_response = client.get('/api/alerts/maintenance-windows')
    assert list_response.status_code == 200
    items = list_response.json()['items']
    assert len(items) == 1
    assert items[0]['runtime_status'] in {'scheduled', 'active', 'expired'}

    cancel_response = client.post(
        f"/api/alerts/maintenance-windows/{created['id']}/cancel",
        json={'actor_username': 'pytest'},
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json() == {'success': True}

    cancelled_row = db_conn.execute(
        'SELECT status FROM alert_maintenance_windows WHERE id = ?',
        (created['id'],),
    ).fetchone()
    assert cancelled_row['status'] == 'cancelled'


def test_maintenance_preview_requires_target_ip(client):
    response = client.post(
        '/api/alerts/maintenance-windows/preview',
        json={'target_ip': '', 'title_pattern': 'cpu'},
    )
    assert response.status_code == 400
    assert response.json()['detail'] == 'target_ip is required'


def test_maintenance_window_name_must_be_unique_and_support_delete(client, db_conn):
    _insert_device(db_conn, device_id='dev-2', ip_address='192.0.2.20')
    db_conn.commit()

    payload = {
        'name': 'Unique Maintenance Window',
        'target_ip': '192.0.2.20',
        'title_pattern': 'cpu',
        'message_pattern': 'xe-0/0/1',
        'starts_at': '2026-03-10T10:00:00Z',
        'ends_at': '2026-03-10T11:00:00Z',
        'notify_user_ids': [],
        'reason': 'planned work',
        'created_by': 'pytest',
    }

    create_response = client.post('/api/alerts/maintenance-windows', json=payload)
    assert create_response.status_code == 200
    created = create_response.json()

    duplicate_response = client.post('/api/alerts/maintenance-windows', json=payload)
    assert duplicate_response.status_code == 400
    assert duplicate_response.json()['detail'] == 'name already exists'

    delete_response = client.delete(f"/api/alerts/maintenance-windows/{created['id']}?actor_username=pytest")
    assert delete_response.status_code == 200
    assert delete_response.json() == {'success': True}

    deleted_row = db_conn.execute(
        'SELECT id FROM alert_maintenance_windows WHERE id = ?',
        (created['id'],),
    ).fetchone()
    assert deleted_row is None