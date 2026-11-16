import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { db } from "../db";
import { getSourcesForMessages, insertFacts, type MessageRow } from "../db/repo";
import { extractionModel } from "../agent/model";

// Step 7, after the response has been sent: turn a sourced answer into (entity, attribute, value, source, as_of) rows.
//
// Why bother, when the answer text is already stored verbatim? Because "what did I tell you, and as of when" should be
// an exact lookup, not something re-read out of prose each time. The change-detection answer's "Then" column comes
// straight from these rows. Best effort by design: if extraction fails the turn is still fully stored, and the
// verbatim answer remains the source of truth.

const FactsSchema = z.object({
  facts: z
    .array(
      z.object({
        entity: z.string().min(1).max(120).describe("The product, vendor, plan or project, as named, e.g. 'HubSpot Sales Hub'"),
        attribute: z.string().min(1).max(160).describe("What was stated, short, e.g. 'Starter price per seat per month'"),
        value: z.string().min(1).max(200).describe("The value exactly as stated, with units, e.g. '$20' or '3.14'"),
        source_n: z.number().int().nullable().describe("The [n] citation number that backed this claim, or null"),
      }),
    )
    .max(40),
});

const INSTRUCTIONS = `You extract checkable claims from an assistant's answer so they can be re-verified later.
Return only concrete, time-sensitive facts stated in the answer: prices, plan names and limits, version numbers, release or end-of-life dates, availability, feature launches.
- Record only what is claimed to be true NOW, as of this answer. If the answer compares an earlier value with the current one ("was $19, now $0"), record only the current value: the earlier value is history, not a new fact.
- One fact per entity and attribute. Use the entity and attribute names the answer uses. Keep attributes stable and free of dates ("Launch plan price per month", never "price as of 16 Nov"), so the same attribute can be compared across time.
- Copy the value as stated, with currency and billing unit. Do not convert, round or infer.
- Skip opinions, recommendations, rationale and anything that is not a checkable claim.
- source_n is the [n] citation attached to the claim in the answer; null if there is none.
- If there are no such facts, return an empty list.`;

export type ExtractOptions = { model?: LanguageModel; timeoutMs?: number };

/** Extract and store facts for one stored assistant message. Returns how many were stored. Never throws. */
export async function extractFactsForMessage(assistantMessageId: string, opts: ExtractOptions = {}): Promise<number> {
  try {
    const answer = db().prepare("SELECT * FROM messages WHERE id = ? AND role = 'assistant'").get(assistantMessageId) as MessageRow | undefined;
    if (!answer) return 0;
    const sources = getSourcesForMessages([answer.id]);
    // An answer with no sources came from stable knowledge. There is nothing to re-check, and no call is made.
    if (!sources.length) return 0;
    const question = db()
      .prepare("SELECT content FROM messages WHERE thread_id = ? AND role = 'user' AND rowid < (SELECT rowid FROM messages WHERE id = ?) ORDER BY rowid DESC LIMIT 1")
      .get(answer.thread_id, answer.id) as { content: string } | undefined;

    const { output } = await generateText({
      model: opts.model ?? extractionModel().model,
      output: Output.object({ schema: FactsSchema }),
      system: INSTRUCTIONS,
      prompt:
        `Question:\n${question?.content ?? "(unknown)"}\n\nAnswer:\n${answer.content}\n\n` +
        `Sources cited, by number:\n${sources.map((s) => `[${s.n}] ${s.title ?? ""} ${s.url}`).join("\n")}`,
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      maxRetries: 1,
    });

    const byN = new Map(sources.map((s) => [s.n, s.url]));
    const seen = new Set<string>();
    const rows = output.facts
      .map((f) => ({
        entity: f.entity.trim(),
        attribute: f.attribute.trim(),
        value: f.value.trim(),
        source_url: f.source_n != null ? (byN.get(f.source_n) ?? null) : null,
      }))
      .filter((f) => {
        const key = `${f.entity.toLowerCase()}|${f.attribute.toLowerCase()}`;
        if (!f.entity || !f.value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    insertFacts(answer.id, answer.user_id, answer.created_at, rows);
    return rows.length;
  } catch (e) {
    console.error("[facts] extraction skipped:", (e as Error)?.message ?? e);
    return 0;
  }
}
