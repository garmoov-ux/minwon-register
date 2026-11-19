import Database from 'better-sqlite3'

export function initializeDatabaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT '교통단속장비운영팀',
      role TEXT NOT NULL DEFAULT 'OPERATOR',
      active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS code_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(category, value)
    );

    CREATE TABLE IF NOT EXISTS minwon_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_date TEXT NOT NULL,
      reception_type TEXT NOT NULL DEFAULT '',
      reception_no TEXT NOT NULL DEFAULT '',
      complainant_name TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      zone_type TEXT NOT NULL DEFAULT '일반구역',
      content TEXT NOT NULL DEFAULT '',
      review_date TEXT NOT NULL DEFAULT '',
      review_result TEXT NOT NULL DEFAULT '검토중',
      improvement_result TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      device_id TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'admin',
      updated_by TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_minwon_received_date ON minwon_records(received_date);
    CREATE INDEX IF NOT EXISTS idx_minwon_review_date ON minwon_records(review_date);
    CREATE INDEX IF NOT EXISTS idx_minwon_review_result ON minwon_records(review_result);
    CREATE INDEX IF NOT EXISTS idx_minwon_reception_type ON minwon_records(reception_type);

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      install_year INTEGER NOT NULL,
      device_id TEXT NOT NULL UNIQUE,
      device_name TEXT NOT NULL,
      location TEXT NOT NULL,
      manufacturer TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '고정식',
      enforcement_type TEXT NOT NULL DEFAULT '신호과속',
      speed_limit INTEGER NOT NULL DEFAULT 50,
      zone_type TEXT NOT NULL DEFAULT '일반구역'
    );

    CREATE INDEX IF NOT EXISTS idx_devices_year ON devices(install_year);
    CREATE INDEX IF NOT EXISTS idx_devices_zone ON devices(zone_type);
    CREATE INDEX IF NOT EXISTS idx_devices_category_type ON devices(category, enforcement_type);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      client_ip TEXT NOT NULL DEFAULT '127.0.0.1'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
  `)
}
