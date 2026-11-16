// npm run seed [-- <user-id>]
// Loads backdated demo conversations for a user. With no argument it uses the most recently active user in the
// local database. (The /debug page has a button that does the same for your browser's own identity.)
import { db } from "../lib/db";
import { nowMs } from "../lib/clock";
import { seedDemoHistory } from "../lib/seed";

const arg = process.argv[2];
const latest = db().prepare("SELECT user_id FROM threads ORDER BY updated_at DESC LIMIT 1").get() as { user_id: string } | undefined;
const userId = arg ?? latest?.user_id;

if (!userId) {
  console.error("No user found yet. Open the app once so it creates your anonymous id, or run: npm run seed -- <user-id>");
  process.exit(1);
}

const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const seeded = seedDemoHistory({ userId, nowMs: nowMs(), tz });
console.log(`Seeded ${seeded.length} demo conversations for user ${userId} (timezone ${tz}):`);
for (const s of seeded) console.log(`  ${s.date}  ${s.title}`);
