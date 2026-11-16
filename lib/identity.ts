import { randomUUID } from "node:crypto";

const COOKIE = "mm_uid";
const UUID = /^[0-9a-f-]{36}$/i;

/** Anonymous identity: a random id in an httpOnly cookie. Memory spans threads for the same id. */
export function identify(req: Request): { userId: string; setCookie?: string } {
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const existing = match?.slice(COOKIE.length + 1);
  if (existing && UUID.test(existing)) return { userId: existing };
  const userId = randomUUID();
  const oneYear = 60 * 60 * 24 * 365;
  return {
    userId,
    setCookie: `${COOKIE}=${userId}; Path=/; Max-Age=${oneYear}; HttpOnly; SameSite=Lax`,
  };
}

export function withCookie(res: Response, setCookie?: string): Response {
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
