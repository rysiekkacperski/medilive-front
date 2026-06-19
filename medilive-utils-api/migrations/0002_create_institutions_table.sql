CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);