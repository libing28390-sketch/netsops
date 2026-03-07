"""Shared test fixtures."""
import os
import sys
import pytest
import sqlite3
import tempfile

# Ensure backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


@pytest.fixture
def tmp_db(tmp_path):
    """Create a temporary SQLite database and redirect DB_PATH to it."""
    db_file = tmp_path / 'test.db'
    import database
    original_path = database.DB_PATH
    database.DB_PATH = str(db_file)
    database.init_db()
    yield str(db_file)
    database.DB_PATH = original_path


@pytest.fixture
def db_conn(tmp_db):
    """Return a connection to the temporary test database."""
    import database
    conn = database.get_db_connection()
    yield conn
    conn.close()
