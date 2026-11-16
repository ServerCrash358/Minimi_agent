import { db } from "./db";

// Every "what time is it" in the app goes through here. Two seams:
//  - setNowOverride(): tests and the eval harness pin the clock to a fixed instant.
//  - a stored offset (/debug "pretend today is..."), so a reviewer can chat today, jump a
//    week forward and ask "what did I ask last Tuesday?" without waiting a week.
let pinned: number | null = null;

export function setNowOverride(ms: number | null) {
  pinned = ms;
}

export function getClockOffsetMs(): number {
  try {
    const row = db().prepare("SELECT value FROM kv WHERE key = 'clock_offset_ms'").get() as
      | { value: string }
      | undefined;
    return row ? Number(row.value) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setClockOffsetMs(ms: number) {
  db()
    .prepare("INSERT INTO kv(key, value) VALUES ('clock_offset_ms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(String(ms));
}

export function nowMs(): number {
  return pinned ?? Date.now() + getClockOffsetMs();
}
