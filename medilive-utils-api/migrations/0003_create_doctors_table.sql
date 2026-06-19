CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  specialization TEXT NOT NULL,
  university TEXT NOT NULL DEFAULT '',
  areas_of_interest TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);