import { getSourcesForMessages, getThread, getThreadMessages, getTraceChips } from "@/lib/db/repo";
import { identify, withCookie } from "@/lib/identity";
import { toUIMessages } from "@/lib/threadView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId, setCookie } = identify(req);
  const { id } = await ctx.params;
  if (!getThread(id, userId)) return withCookie(Response.json({ messages: [] }), setCookie);
  const rows = getThreadMessages(id);
  const assistantIds = rows.filter((r) => r.role === "assistant").map((r) => r.id);
  const sources = getSourcesForMessages(assistantIds);
  return withCookie(Response.json({ messages: toUIMessages(rows, sources, getTraceChips(assistantIds)) }), setCookie);
}
