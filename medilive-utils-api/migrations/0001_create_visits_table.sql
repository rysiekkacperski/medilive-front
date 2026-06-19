CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  sms_sent INTEGER NOT NULL DEFAULT 0,
  sms_skipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);