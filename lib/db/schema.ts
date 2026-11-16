// All timestamps are INTEGER epoch milliseconds (UTC). The user's timezone is stored
// next to each message so "what day was that for them" can always be recomputed.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS threads (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES threads(id),
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  tz         TEXT NOT NULL,
  demo       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

-- Sources cited by an assistant message. n is the [n] number used in the answer text.
CREATE TABLE IF NOT EXISTS sources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id   TEXT NOT NULL REFERENCES messages(id),
  n            INTEGER NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT,
  fetched_at   INTEGER NOT NULL,
  published_at TEXT,
  snippet      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sources_message ON sources(message_id);

-- Structured claims extracted from an answer, so "what did I tell you, and as of when" is exact.
CREATE TABLE IF NOT EXISTS facts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL REFERENCES messages(id),
  user_id    TEXT NOT NULL,
  entity     TEXT NOT NULL,
  attribute  TEXT NOT NULL,
  value      TEXT NOT NULL,
  source_url TEXT,
  as_of      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(user_id, entity COLLATE NOCASE);

-- One row per turn, successful or not: what the pipeline did (resolved dates, memories, searches, timings).
-- Deliberately not tied to the messages table: a failed turn has no assistant message but is exactly the turn you
-- want to debug. id is the id the assistant message has (or would have had).
CREATE TABLE IF NOT EXISTS turn_traces (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ok         INTEGER NOT NULL,
  json       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_turn_traces_user ON turn_traces(user_id, created_at DESC);

-- Search cache keyed by (query, site, since, local day). Pricing pages change, so never older than a day.
CREATE TABLE IF NOT EXISTS search_cache (
  key        TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  json       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content, content='messages', content_rowid='rowid', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;
`;
