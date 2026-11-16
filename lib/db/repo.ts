import { randomUUID } from "node:crypto";
import { db } from "./index";

export type Role = "user" | "assistant";
export type MessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: Role;
  content: string;
  created_at: number;
  tz: string;
  demo: number;
};
export type SourceRow = {
  message_id: string;
  n: number;
  url: string;
  title: string | null;
  fetched_at: number;
  published_at: string | null;
  snippet: string | null;
};
export type ThreadRow = { id: string; user_id: string; title: string | null; created_at: number; updated_at: number };

export const newId = () => randomUUID();

export function ensureThread(threadId: string, userId: string, at: number, title?: string): ThreadRow {
  const existing = db().prepare("SELECT * FROM threads WHERE id = ?").get(threadId) as ThreadRow | undefined;
  if (existing) {
    if (existing.user_id !== userId) throw new Error("Thread belongs to another user");
    return existing;
  }
  db()
    .prepare("INSERT INTO threads(id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)")
    .run(threadId, userId, title ?? null, at, at);
  return { id: threadId, user_id: userId, title: title ?? null, created_at: at, updated_at: at };
}

export function getThread(threadId: string, userId: string): ThreadRow | undefined {
  return db().prepare("SELECT * FROM threads WHERE id = ? AND user_id = ?").get(threadId, userId) as ThreadRow | undefined;
}

export function listThreads(userId: string, limit = 50): ThreadRow[] {
  return db().prepare("SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?").all(userId, limit) as ThreadRow[];
}

export function insertMessage(m: {
  id?: string;
  threadId: string;
  userId: string;
  role: Role;
  content: string;
  createdAt: number;
  tz: string;
  demo?: boolean;
}): string {
  const id = m.id ?? newId();
  db()
    .prepare("INSERT INTO messages(id, thread_id, user_id, role, content, created_at, tz, demo) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, m.threadId, m.userId, m.role, m.content, m.createdAt, m.tz, m.demo ? 1 : 0);
  db().prepare("UPDATE threads SET updated_at = MAX(updated_at, ?) WHERE id = ?").run(m.createdAt, m.threadId);
  return id;
}

export function setThreadTitle(threadId: string, title: string) {
  db().prepare("UPDATE threads SET title = ? WHERE id = ? AND title IS NULL").run(title, threadId);
}

export function insertSources(messageId: string, rows: Omit<SourceRow, "message_id">[]) {
  const stmt = db().prepare(
    "INSERT INTO sources(message_id, n, url, title, fetched_at, published_at, snippet) VALUES (?,?,?,?,?,?,?)",
  );
  const tx = db().transaction(() => {
    for (const r of rows) stmt.run(messageId, r.n, r.url, r.title, r.fetched_at, r.published_at, r.snippet);
  });
  tx();
}

export function getThreadMessages(threadId: string): MessageRow[] {
  return db().prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at, rowid").all(threadId) as MessageRow[];
}

export function getSourcesForMessages(ids: string[]): SourceRow[] {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  return db().prepare(`SELECT * FROM sources WHERE message_id IN (${marks}) ORDER BY message_id, n`).all(...ids) as SourceRow[];
}

export type FactRow = {
  id: number;
  message_id: string;
  user_id: string;
  entity: string;
  attribute: string;
  value: string;
  source_url: string | null;
  as_of: number;
};

export function insertFacts(
  messageId: string,
  userId: string,
  asOf: number,
  facts: Array<{ entity: string; attribute: string; value: string; source_url: string | null }>,
) {
  const stmt = db().prepare("INSERT INTO facts(message_id, user_id, entity, attribute, value, source_url, as_of) VALUES (?,?,?,?,?,?,?)");
  db().transaction(() => {
    db().prepare("DELETE FROM facts WHERE message_id = ?").run(messageId); // re-running extraction replaces, never duplicates
    for (const f of facts) stmt.run(messageId, userId, f.entity, f.attribute, f.value, f.source_url, asOf);
  })();
}

export function getFactsForMessages(ids: string[]): FactRow[] {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  return db().prepare(`SELECT * FROM facts WHERE message_id IN (${marks}) ORDER BY message_id, id`).all(...ids) as FactRow[];
}

/** Facts whose entity contains any of the given words (case-insensitive), newest first. */
export function getFactsByEntityWords(userId: string, words: string[], limit = 40): FactRow[] {
  if (!words.length) return [];
  const clause = words.map(() => "entity LIKE ? ESCAPE '\\'").join(" OR ");
  const args = words.map((w) => `%${w.replace(/[\\%_]/g, "\\$&")}%`);
  return db()
    .prepare(`SELECT * FROM facts WHERE user_id = ? AND (${clause}) ORDER BY as_of DESC, id LIMIT ?`)
    .all(userId, ...args, limit) as FactRow[];
}

export type TurnTraceRow = { id: string; thread_id: string; user_id: string; created_at: number; ok: number; json: string };

export function saveTurnTrace(t: { id: string; threadId: string; userId: string; createdAt: number; ok: boolean; trace: unknown }) {
  db()
    .prepare("INSERT OR REPLACE INTO turn_traces(id, thread_id, user_id, created_at, ok, json) VALUES (?,?,?,?,?,?)")
    .run(t.id, t.threadId, t.userId, t.createdAt, t.ok ? 1 : 0, JSON.stringify(t.trace));
}

export function listTurnTraces(userId: string, limit = 30): TurnTraceRow[] {
  return db().prepare("SELECT * FROM turn_traces WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as TurnTraceRow[];
}

export function getTurnTrace(id: string): TurnTraceRow | undefined {
  return db().prepare("SELECT * FROM turn_traces WHERE id = ?").get(id) as TurnTraceRow | undefined;
}
