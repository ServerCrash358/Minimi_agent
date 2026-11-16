import { createUIMessageStreamResponse } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { extractFactsForMessage } from "@/lib/memory/facts";
import { ConfigError } from "@/lib/agent/model";
import { runTurn } from "@/lib/agent/run";
import { identify, withCookie } from "@/lib/identity";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  threadId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  tz: z.string().max(64).default("UTC"),
});

const text = (status: number, message: string, setCookie?: string) =>
  withCookie(new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } }), setCookie);

export async function POST(req: Request) {
  const { userId, setCookie } = identify(req);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text(400, "Send a message of 1 to 4000 characters.", setCookie);

  try {
    const { stream, done } = runTurn({ userId, ...parsed.data, signal: req.signal });
    // [7] After the response: extract structured facts from the stored answer. The user never waits for this.
    after(async () => {
      const outcome = await done.catch(() => null);
      if (outcome) await extractFactsForMessage(outcome.assistantMessageId);
    });
    return withCookie(createUIMessageStreamResponse({ stream }), setCookie);
  } catch (e) {
    if (e instanceof ConfigError) return text(500, e.message, setCookie);
    if (e instanceof Error && e.message === "Thread belongs to another user") return text(403, "That conversation is not yours.", setCookie);
    console.error("[chat] failed to start turn", e);
    return text(500, "Could not start that turn. Please try again.", setCookie);
  }
}
