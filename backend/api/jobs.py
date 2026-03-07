from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()

@router.get("/jobs")
def read_jobs(
    status: Optional[str] = Query(default=None),
    time_range: Optional[str] = Query(default=None),
    page: Optional[int] = Query(default=None, ge=1),
    page_size: Optional[int] = Query(default=None, ge=1, le=200),
):
    conn = get_db_connection()
    try:
        where_clauses = []
        params = []

        if status and status != 'all':
            where_clauses.append('status = ?')
            params.append(status)

        # SQLite datetime filters are interpreted in UTC.
        if time_range and time_range != 'all':
            if time_range == '24h':
                where_clauses.append("datetime(created_at) >= datetime('now', '-1 day')")
            elif time_range == '7d':
                where_clauses.append("datetime(created_at) >= datetime('now', '-7 days')")
            elif time_range == '30d':
                where_clauses.append("datetime(created_at) >= datetime('now', '-30 days')")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ''

        # Backward-compatible mode: no pagination params -> return array like before.
        # Safety cap: never return more than 500 rows without explicit pagination.
        if page is None or page_size is None:
            jobs = conn.execute(
                f'SELECT * FROM jobs {where_sql} ORDER BY created_at DESC LIMIT 500',
                tuple(params)
            ).fetchall()
            return [dict(j) for j in jobs]

        total_row = conn.execute(
            f'SELECT COUNT(*) AS count FROM jobs {where_sql}',
            tuple(params)
        ).fetchone()
        total = int(total_row['count']) if total_row else 0

        offset = (page - 1) * page_size
        paged_jobs = conn.execute(
            f'SELECT * FROM jobs {where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?',
            tuple([*params, page_size, offset])
        ).fetchall()

        return {
            'items': [dict(j) for j in paged_jobs],
            'total': total,
            'page': page,
            'page_size': page_size,
        }
    finally:
        conn.close()

@router.get("/jobs/{job_id}")
def read_job(job_id: str):
    conn = get_db_connection()
    try:
        job = conn.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return dict(job)
    finally:
        conn.close()
