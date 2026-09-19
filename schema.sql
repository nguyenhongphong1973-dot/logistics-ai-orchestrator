-- Schema cho Logistics AI Orchestrator (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  assignee TEXT NOT NULL,
  input TEXT NOT NULL,
  deliverable TEXT NOT NULL,
  accept_criteria TEXT NOT NULL, -- JSON array
  deadline TEXT,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL,
  return_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  done_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS ticket_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  ts TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  actor TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_history_ticket ON ticket_history(ticket_id);
