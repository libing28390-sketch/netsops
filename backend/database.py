import sqlite3
import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, 'data', 'netops.db')

def get_db_connection():
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.execute('PRAGMA journal_mode=WAL;')
        conn.execute('PRAGMA synchronous=NORMAL;')
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.DatabaseError as e:
        if "malformed" in str(e).lower():
            print(f"Database corrupted, deleting {DB_PATH} and recreating...")
            if os.path.exists(DB_PATH):
                os.remove(DB_PATH)
            if os.path.exists(DB_PATH + "-wal"):
                os.remove(DB_PATH + "-wal")
            if os.path.exists(DB_PATH + "-shm"):
                os.remove(DB_PATH + "-shm")
            conn = sqlite3.connect(DB_PATH, timeout=10.0)
            conn.execute('PRAGMA journal_mode=WAL;')
            conn.execute('PRAGMA synchronous=NORMAL;')
            conn.row_factory = sqlite3.Row
            return conn
        raise e

def init_db():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Create devices table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            hostname TEXT,
            ip_address TEXT,
            platform TEXT,
            status TEXT,
            compliance TEXT,
            sn TEXT,
            model TEXT,
            version TEXT,
            role TEXT,
            site TEXT,
            uptime TEXT,
            connection_method TEXT,
            username TEXT,
            password TEXT,
            current_config TEXT,
            config_history TEXT,
            cpu_usage INTEGER DEFAULT 0,
            memory_usage INTEGER DEFAULT 0,
            interface_data TEXT DEFAULT '[]',
            snmp_community TEXT DEFAULT 'public',
            snmp_port INTEGER DEFAULT 161,
            cpu_history TEXT DEFAULT '[]',
            memory_history TEXT DEFAULT '[]',
            temp INTEGER DEFAULT 35,
            fan_status TEXT DEFAULT 'ok',
            psu_status TEXT DEFAULT 'redundant',
            sys_name TEXT,
            sys_location TEXT,
            sys_contact TEXT
        )
        ''')
        
        # Create jobs table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            device_id TEXT,
            task_name TEXT,
            status TEXT,
            output TEXT,
            created_at TEXT,
            FOREIGN KEY (device_id) REFERENCES devices (id)
        )
        ''')
        
        # Create scripts table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS scripts (
            id TEXT PRIMARY KEY,
            name TEXT,
            content TEXT,
            description TEXT,
            platform TEXT,
            category TEXT DEFAULT 'custom'
        )
        ''')
        
        # Create templates table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            category TEXT,
            vendor TEXT,
            content TEXT,
            last_used TEXT
        )
        ''')
        
        # Create users table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            status TEXT,
            last_login TEXT,
            avatar_url TEXT
        )
        ''')

        # Store user-defined scenario templates for playbooks
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_scenarios (
            id TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            created_by TEXT DEFAULT 'admin',
            created_at TEXT,
            updated_at TEXT
        )
        ''')
        
        # Create global_vars table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS global_vars (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE,
            value TEXT
        )
        ''')

        # Create config_snapshots table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS config_snapshots (
            id TEXT PRIMARY KEY,
            device_id TEXT,
            hostname TEXT,
            vendor TEXT,
            timestamp TEXT,
            trigger TEXT,
            author TEXT,
            tag TEXT DEFAULT '',
            file_path TEXT,
            size INTEGER DEFAULT 0,
            FOREIGN KEY (device_id) REFERENCES devices (id)
        )
        ''')

        # Create links table for topology
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            source_device_id TEXT,
            source_port TEXT,
            target_device_id TEXT,
            target_port TEXT,
            last_seen TEXT,
            FOREIGN KEY (source_device_id) REFERENCES devices (id),
            FOREIGN KEY (target_device_id) REFERENCES devices (id)
        )
        ''')

        # Create playbook_executions table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS playbook_executions (
            id TEXT PRIMARY KEY,
            scenario_id TEXT,
            scenario_name TEXT,
            platform TEXT DEFAULT 'cisco_ios',
            device_ids TEXT DEFAULT '[]',
            variables TEXT DEFAULT '{}',
            status TEXT DEFAULT 'pending',
            dry_run INTEGER DEFAULT 0,
            author TEXT DEFAULT 'admin',
            concurrency INTEGER DEFAULT 1,
            phases_json TEXT DEFAULT '{}',
            results_json TEXT DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            actor_id TEXT,
            actor_username TEXT,
            actor_role TEXT,
            source_ip TEXT,
            target_type TEXT,
            target_id TEXT,
            target_name TEXT,
            device_id TEXT,
            job_id TEXT,
            execution_id TEXT,
            snapshot_id TEXT,
            summary TEXT NOT NULL,
            details_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_events_category ON audit_events(category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events(severity)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_events_actor_username ON audit_events(actor_username)')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS compliance_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            platforms_json TEXT DEFAULT '[]',
            logic_json TEXT DEFAULT '{}',
            remediation TEXT DEFAULT '',
            reference TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1,
            is_builtin INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS compliance_runs (
            id TEXT PRIMARY KEY,
            initiated_by TEXT DEFAULT 'admin',
            scope_json TEXT DEFAULT '[]',
            status TEXT DEFAULT 'pending',
            started_at TEXT NOT NULL,
            completed_at TEXT,
            summary_json TEXT DEFAULT '{}'
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_compliance_runs_started_at ON compliance_runs(started_at)')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS compliance_findings (
            id TEXT PRIMARY KEY,
            fingerprint TEXT UNIQUE NOT NULL,
            rule_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            run_id TEXT,
            severity TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            observed_value TEXT DEFAULT '',
            evidence TEXT DEFAULT '',
            remediation TEXT DEFAULT '',
            owner TEXT DEFAULT '',
            note TEXT DEFAULT '',
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY (rule_id) REFERENCES compliance_rules(id),
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (run_id) REFERENCES compliance_runs(id)
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_compliance_findings_status ON compliance_findings(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_compliance_findings_device_id ON compliance_findings(device_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_compliance_findings_last_seen_at ON compliance_findings(last_seen_at)')

        # Track notification read status per user
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notification_reads (
            user_id TEXT,
            notification_id TEXT,
            read_at TEXT,
            PRIMARY KEY (user_id, notification_id)
        )
        ''')

        # High-frequency raw interface telemetry (short retention)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS interface_telemetry_raw (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            device_id TEXT NOT NULL,
            interface_name TEXT NOT NULL,
            status TEXT,
            speed_mbps REAL,
            in_bps REAL,
            out_bps REAL,
            bw_in_pct REAL,
            bw_out_pct REAL,
            in_pkts INTEGER,
            out_pkts INTEGER,
            in_errors INTEGER,
            out_errors INTEGER,
            in_discards INTEGER,
            out_discards INTEGER
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interface_telemetry_raw_ts ON interface_telemetry_raw(ts)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interface_telemetry_raw_dev_intf_ts ON interface_telemetry_raw(device_id, interface_name, ts)')

        # 1-minute rollup telemetry for long-term trending
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS interface_telemetry_1m (
            ts_minute TEXT NOT NULL,
            device_id TEXT NOT NULL,
            interface_name TEXT NOT NULL,
            samples INTEGER DEFAULT 0,
            avg_in_bps REAL,
            max_in_bps REAL,
            avg_out_bps REAL,
            max_out_bps REAL,
            avg_bw_in_pct REAL,
            max_bw_in_pct REAL,
            avg_bw_out_pct REAL,
            max_bw_out_pct REAL,
            in_pkts_sum INTEGER DEFAULT 0,
            out_pkts_sum INTEGER DEFAULT 0,
            err_delta_sum INTEGER DEFAULT 0,
            discard_delta_sum INTEGER DEFAULT 0,
            PRIMARY KEY (ts_minute, device_id, interface_name)
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interface_telemetry_1m_ts ON interface_telemetry_1m(ts_minute)')

        # Alert lifecycle records (open/resolved)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS alert_events (
            id TEXT PRIMARY KEY,
            dedupe_key TEXT NOT NULL,
            source TEXT NOT NULL,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            device_id TEXT,
            interface_name TEXT,
            created_at TEXT NOT NULL,
            resolved_at TEXT
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_alert_events_resolved_at ON alert_events(resolved_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_alert_events_dedupe_key ON alert_events(dedupe_key)')

        # Migration: add platform column to playbook_executions if missing
        cursor.execute("PRAGMA table_info(playbook_executions)")
        pb_cols = [c[1] for c in cursor.fetchall()]
        if 'platform' not in pb_cols:
            cursor.execute("ALTER TABLE playbook_executions ADD COLUMN platform TEXT DEFAULT 'cisco_ios'")

        # Migration: Add new columns if they don't exist
        cursor.execute("PRAGMA table_info(devices)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'cpu_usage' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN cpu_usage INTEGER DEFAULT 0')
        if 'memory_usage' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN memory_usage INTEGER DEFAULT 0')
        if 'interface_data' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN interface_data TEXT DEFAULT "[]"')
        if 'snmp_community' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN snmp_community TEXT DEFAULT "public"')
        if 'snmp_port' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN snmp_port INTEGER DEFAULT 161')
        if 'cpu_history' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN cpu_history TEXT DEFAULT "[]"')
        if 'memory_history' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN memory_history TEXT DEFAULT "[]"')
        if 'temp' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN temp INTEGER DEFAULT 35')
        if 'fan_status' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN fan_status TEXT DEFAULT "ok"')
        if 'psu_status' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN psu_status TEXT DEFAULT "redundant"')
        if 'sys_name' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN sys_name TEXT')
        if 'sys_location' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN sys_location TEXT')
        if 'sys_contact' not in columns:
            cursor.execute('ALTER TABLE devices ADD COLUMN sys_contact TEXT')

        # Migration for scripts table
        cursor.execute("PRAGMA table_info(scripts)")
        script_columns = [column[1] for column in cursor.fetchall()]
        if 'platform' not in script_columns:
            cursor.execute('ALTER TABLE scripts ADD COLUMN platform TEXT')
        if 'category' not in script_columns:
            cursor.execute('ALTER TABLE scripts ADD COLUMN category TEXT DEFAULT "custom"')

        # Migration for users table
        cursor.execute("PRAGMA table_info(users)")
        user_columns = [column[1] for column in cursor.fetchall()]
        if 'avatar_url' not in user_columns:
            cursor.execute('ALTER TABLE users ADD COLUMN avatar_url TEXT')

        cursor.execute("PRAGMA table_info(compliance_findings)")
        finding_columns = [column[1] for column in cursor.fetchall()]
        if finding_columns:
            if 'owner' not in finding_columns:
                cursor.execute("ALTER TABLE compliance_findings ADD COLUMN owner TEXT DEFAULT ''")
            if 'note' not in finding_columns:
                cursor.execute("ALTER TABLE compliance_findings ADD COLUMN note TEXT DEFAULT ''")

        # Migration for interface_telemetry_raw table
        cursor.execute("PRAGMA table_info(interface_telemetry_raw)")
        raw_columns = [column[1] for column in cursor.fetchall()]
        if raw_columns:
            if 'in_pkts' not in raw_columns:
                cursor.execute('ALTER TABLE interface_telemetry_raw ADD COLUMN in_pkts INTEGER')
            if 'out_pkts' not in raw_columns:
                cursor.execute('ALTER TABLE interface_telemetry_raw ADD COLUMN out_pkts INTEGER')

        # Migration for interface_telemetry_1m table
        cursor.execute("PRAGMA table_info(interface_telemetry_1m)")
        rollup_columns = [column[1] for column in cursor.fetchall()]
        if rollup_columns:
            if 'in_pkts_sum' not in rollup_columns:
                cursor.execute('ALTER TABLE interface_telemetry_1m ADD COLUMN in_pkts_sum INTEGER DEFAULT 0')
            if 'out_pkts_sum' not in rollup_columns:
                cursor.execute('ALTER TABLE interface_telemetry_1m ADD COLUMN out_pkts_sum INTEGER DEFAULT 0')

        conn.commit()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
