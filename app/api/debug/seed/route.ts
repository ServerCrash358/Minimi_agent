import { nowMs } from "@/lib/clock";
import { identify, withCookie } from "@/lib/identity";
import { validTimezone } from "@/lib/agent/run";
import { seedDemoHistory } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Load backdated demo conversations for the caller's own identity (relative to the app's clock, in their timezone). */
export async function POST(req: Request) {
  const { userId, setCookie } = identify(req);
  const body = (await req.json().catch(() => ({}))) as { tz?: string };
  const seeded = seedDemoHistory({ userId, nowMs: nowMs(), tz: validTimezone(body.tz) });
  return withCookie(Response.json({ seeded }), setCookie);
}
