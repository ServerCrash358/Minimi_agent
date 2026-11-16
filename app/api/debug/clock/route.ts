import { getClockOffsetMs, nowMs, setClockOffsetMs } from "@/lib/clock";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const state = () => ({ offsetDays: Math.round((getClockOffsetMs() / DAY) * 100) / 100, nowIso: new Date(nowMs()).toISOString() });

export async function GET() {
  return Response.json(state());
}

/**
 * "Pretend it is N days later." Lets a reviewer chat today, jump a week ahead and ask "what did I ask last Tuesday?"
 * without waiting. The offset is global to this demo instance (it is a single-tenant demo, not a product feature).
 */
export async function POST(req: Request) {
  const parsed = z.object({ offsetDays: z.number().min(-3650).max(3650) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("offsetDays must be a number between -3650 and 3650", { status: 400 });
  setClockOffsetMs(Math.round(parsed.data.offsetDays * DAY));
  return Response.json(state());
}
