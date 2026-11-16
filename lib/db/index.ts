import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

export type DB = Database.Database;

// Next dev reloads modules; keep one connection per path on globalThis.
const g = globalThis as unknown as { __minimiDbs?: Map<string, DB> };

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  return conn;
}

let override: DB | null = null;

/** Tests and the eval harness point the app at a throwaway database. */
export function useDb(conn: DB | null) {
  override = conn;
}

export function db(): DB {
  if (override) return override;
  // A runtime path on purpose (the database lives outside the bundle); tell the bundler not to trace it.
  const file = path.resolve(/*turbopackIgnore: true*/ process.env.DB_PATH || "./data/minimi.db");
  g.__minimiDbs ??= new Map();
  let conn = g.__minimiDbs.get(file);
  if (!conn) {
    conn = openDb(file);
    g.__minimiDbs.set(file, conn);
  }
  return conn;
}
