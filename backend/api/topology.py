from fastapi import APIRouter, BackgroundTasks, HTTPException

from database import get_db_connection
from services.topology_service import (
    create_discovery_run,
    discover_lldp_neighbors,
    execute_discovery_run,
    get_current_links,
    get_discovery_run,
    list_discovery_runs,
)

router = APIRouter()


@router.post('/topology/discover')
async def trigger_discovery(background_tasks: BackgroundTasks):
    conn = get_db_connection()
    try:
        device_rows = conn.execute(
            '''
            SELECT id
            FROM devices
            WHERE status = 'online'
              AND COALESCE(ip_address, '') <> ''
              AND COALESCE(username, '') <> ''
              AND COALESCE(password, '') <> ''
            ORDER BY hostname
            '''
        ).fetchall()
    finally:
        conn.close()

    device_ids = [row['id'] for row in device_rows]
    if not device_ids:
        raise HTTPException(status_code=400, detail='No online devices with valid credentials available for topology discovery')

    run_id = create_discovery_run(device_ids=device_ids, requested_by='api', scope='full')
    background_tasks.add_task(execute_discovery_run, run_id, device_ids)
    return {
        'status': 'Discovery started in background',
        'run_id': run_id,
        'device_count': len(device_ids),
    }


@router.get('/topology/links')
def get_links():
    return get_current_links()


@router.get('/topology/discovery-runs')
def get_topology_discovery_runs(limit: int = 20):
    safe_limit = max(1, min(limit, 100))
    return list_discovery_runs(limit=safe_limit)


@router.get('/topology/discovery-runs/{run_id}')
def get_topology_discovery_run(run_id: str):
    payload = get_discovery_run(run_id)
    if not payload:
        raise HTTPException(status_code=404, detail='Topology discovery run not found')
    return payload