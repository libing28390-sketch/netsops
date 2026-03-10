import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / 'backend'

for path in (PROJECT_ROOT, BACKEND_ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import database
from api.alerts import router as alerts_router


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    db_path = tmp_path / 'netops-test.db'
    monkeypatch.setattr(database, 'DB_PATH', str(db_path))
    database.init_db()
    return db_path


@pytest.fixture
def client(isolated_db):
    app = FastAPI()
    app.include_router(alerts_router, prefix='/api')
    return TestClient(app)


@pytest.fixture
def db_conn(isolated_db):
    conn = database.get_db_connection()
    try:
        yield conn
    finally:
        conn.close()