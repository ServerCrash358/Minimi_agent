import { listThreads } from "@/lib/db/repo";
import { identify, withCookie } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId, setCookie } = identify(req); // first visit: this call mints the identity cookie
  const threads = listThreads(userId).map((t) => ({ id: t.id, title: t.title ?? "New chat", updatedAt: t.updated_at }));
  return withCookie(Response.json({ threads }), setCookie);
}
