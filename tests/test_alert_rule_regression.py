from services import alert_rule_service


def test_select_rule_supports_all_scope_match_modes(db_conn):
    rules = [
        alert_rule_service.create_rule(
            {
                'name': 'Exact Site',
                'metric_type': 'cpu',
                'scope_type': 'site',
                'scope_match_mode': 'exact',
                'scope_value': 'dc-1',
                'severity': 'major',
                'threshold': 80,
                'aggregation_mode': 'dedupe_key',
                'notification_repeat_window_seconds': 120,
            }
        ),
        alert_rule_service.create_rule(
            {
                'name': 'Contains Device',
                'metric_type': 'cpu',
                'scope_type': 'device',
                'scope_match_mode': 'contains',
                'scope_value': 'core-switch',
                'severity': 'major',
                'threshold': 81,
                'aggregation_mode': 'dedupe_key',
                'notification_repeat_window_seconds': 120,
            }
        ),
        alert_rule_service.create_rule(
            {
                'name': 'Prefix Device',
                'metric_type': 'cpu',
                'scope_type': 'device',
                'scope_match_mode': 'prefix',
                'scope_value': 'edge-',
                'severity': 'warning',
                'threshold': 82,
                'aggregation_mode': 'dedupe_key',
                'notification_repeat_window_seconds': 120,
            }
        ),
        alert_rule_service.create_rule(
            {
                'name': 'Wildcard Interface',
                'metric_type': 'interface_util',
                'scope_type': 'interface',
                'scope_match_mode': 'glob',
                'scope_value': 'xe-0/*',
                'severity': 'critical',
                'threshold': 90,
                'aggregation_mode': 'dedupe_key',
                'notification_repeat_window_seconds': 120,
            }
        ),
    ]

    selected_site = alert_rule_service.select_rule(
        alert_rule_service.get_runtime_rules(),
        'cpu',
        {
            'site': 'dc-1',
            'hostname': 'aggregation-1',
            'ip_address': '10.0.0.1',
            'device_id': 'dev-site',
            'interface_name': '',
        },
    )
    assert selected_site['name'] == 'Exact Site'

    selected_contains = alert_rule_service.select_rule(
        alert_rule_service.get_runtime_rules(),
        'cpu',
        {
            'site': 'branch-a',
            'hostname': 'branch-core-switch-02',
            'ip_address': '10.0.0.2',
            'device_id': 'dev-contains',
            'interface_name': '',
        },
    )
    assert selected_contains['name'] == 'Contains Device'

    selected_prefix = alert_rule_service.select_rule(
        alert_rule_service.get_runtime_rules(),
        'cpu',
        {
            'site': 'branch-b',
            'hostname': 'edge-router-01',
            'ip_address': '10.0.0.3',
            'device_id': 'dev-prefix',
            'interface_name': '',
        },
    )
    assert selected_prefix['name'] == 'Prefix Device'

    selected_glob = alert_rule_service.select_rule(
        alert_rule_service.get_runtime_rules(),
        'interface_util',
        {
            'site': 'dc-2',
            'hostname': 'core-1',
            'ip_address': '10.0.0.4',
            'device_id': 'dev-glob',
            'interface_name': 'xe-0/0/7',
        },
    )
    assert selected_glob['name'] == 'Wildcard Interface'
    assert len(rules) == 4


def test_alert_rule_api_crud_and_history_round_trip(client):
    response = client.get('/api/alerts/rules')
    assert response.status_code == 200
    items = response.json()['items']
    assert len(items) == 4
    assert all('scope_match_mode' in item for item in items)

    create_payload = {
        'name': 'API Prefix Rule',
        'metric_type': 'cpu',
        'scope_type': 'device',
        'scope_match_mode': 'prefix',
        'scope_value': 'core-',
        'severity': 'major',
        'threshold': 75,
        'enabled': True,
        'aggregation_mode': 'dedupe_key',
        'notification_repeat_window_seconds': 300,
        'notify_on_active': True,
        'notify_on_recovery': True,
        'notify_on_reopen_after_maintenance': True,
        'created_by': 'pytest',
    }
    create_response = client.post('/api/alerts/rules', json=create_payload)
    assert create_response.status_code == 200
    created = create_response.json()
    assert created['scope_match_mode'] == 'prefix'

    update_response = client.put(
        f"/api/alerts/rules/{created['id']}",
        json={
            **created,
            'scope_match_mode': 'glob',
            'scope_value': 'core-*',
            'updated_by': 'pytest',
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated['scope_match_mode'] == 'glob'
    assert updated['scope_value'] == 'core-*'

    history_response = client.get(f"/api/alerts/rules/history?limit=10&rule_id={created['id']}")
    assert history_response.status_code == 200
    history_items = history_response.json()['items']
    assert len(history_items) >= 2

    delete_response = client.delete(f"/api/alerts/rules/{created['id']}?actor_username=pytest")
    assert delete_response.status_code == 200
    assert delete_response.json() == {'success': True}


def test_alert_rule_api_rejects_unsupported_aggregation_mode(client):
    response = client.post(
        '/api/alerts/rules',
        json={
            'name': 'Bad Aggregation',
            'metric_type': 'cpu',
            'scope_type': 'global',
            'scope_match_mode': 'exact',
            'scope_value': '',
            'severity': 'major',
            'threshold': 88,
            'enabled': True,
            'aggregation_mode': 'dedupe',
            'notification_repeat_window_seconds': 300,
        },
    )
    assert response.status_code == 400
    assert 'dedupe_key' in response.json()['detail']