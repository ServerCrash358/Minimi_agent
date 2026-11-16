import type { Memory } from "../memory/retrieve";

// Decide, in code, what kind of turn this is, so the model is not left to choose whether to search.
// Every miss in the eval history was the model's discretion going wrong: searching a question whose answer was
// already in memory, searching a conceptual question, ... Where a rule can make that call, a rule makes it.
//
//   recall      memory found the conversation, and the user asks WHAT was said, not whether it still holds.
//               Tools off: the answer is in the Prior conversations block.
//   recheck     memory found the conversation and the user asks whether it changed / still holds.
//               The searches are started before the model runs (see prefetch.ts).
//   conceptual  no memory, no freshness cue, an explanatory question with no product or company name.
//               Tools off: stable knowledge, answered directly.
//   open        everything else: the model decides, with web_search available.
//
// The rules are deliberately conservative. Turning search off wrongly costs a stale answer; leaving it on costs
// only seconds, so any doubt resolves to `open`.

export type IntentKind = "recall" | "recheck" | "conceptual" | "open";
export type Intent = { kind: IntentKind; reason: string };

/** The user is asking whether something changed, still holds, or is current. */
const CHANGE_CUE =
  /\b(chang(e|ed|es|ing)|still|since|current(ly)?|latest|newest|now|today|right now|up to date|up-to-date|outdated|update[ds]?|new|recent(ly)?|shipped|launch(ed)?|released?|announce[ds]?|correct|accurate|true|valid|different|differs?|any (news|update))\b/i;

/** The answer depends on the live world, whatever the phrasing. */
const FRESH_CUE =
  /\b(price[ds]?|pricing|costs?|how much|latest|newest|current(ly)?|today|now|this (week|month|year)|news|release[ds]?|version|versions|available|availability|open|weather|score|stock|vs|versus|compare|comparison|cheapest|best|top|20\d\d)\b/i;

/** An explanatory question about a concept. */
const EXPLANATORY =
  /^\s*(what (is|are|does|do|was|were)\b|what'?s (a|an|the)\b|explain\b|define\b|describe\b|how (does|do|can|to|is|are)\b|why (is|are|does|do|did)\b|(what'?s )?the difference between\b|difference between\b|tell me (how|what|why)\b|walk me through\b)/i;

/** A capitalised word that is not the first word of a sentence: very likely a product, company or place. */
function hasProperNoun(text: string): boolean {
  const words = text.split(/\s+/);
  let sentenceStart = true;
  for (const raw of words) {
    const w = raw.replace(/^[("'`]+|[)"'`,;:]+$/g, "");
    if (!w) continue;
    if (!sentenceStart && /^[A-Z][A-Za-z0-9.+#-]*$/.test(w) && w !== "I") return true;
    sentenceStart = /[.!?]$/.test(raw);
  }
  return /\b[A-Za-z]+\.(js|io|com|dev|ai|org)\b/i.test(text); // Node.js, example.com
}

export function foundRecord(memory: Memory | null | undefined): boolean {
  if (!memory) return false;
  return memory.ranges.some((r) => r.hits.some((h) => h.turns.length)) || memory.topical.length > 0;
}

export function classifyIntent(text: string, memory: Memory | null | undefined): Intent {
  const found = foundRecord(memory);
  if (found) {
    return CHANGE_CUE.test(text)
      ? { kind: "recheck", reason: "memory found the conversation and the question asks whether it changed or still holds" }
      : { kind: "recall", reason: "memory found the conversation and the question asks what was said, not whether it changed" };
  }
  if (memory?.attempted) return { kind: "open", reason: "the user referred to the past but no record was found; the model may check current facts" };
  if (FRESH_CUE.test(text)) return { kind: "open", reason: "the question depends on current facts" };
  if (hasProperNoun(text)) return { kind: "open", reason: "the question names a product, company or place" };
  if (EXPLANATORY.test(text)) return { kind: "conceptual", reason: "explanatory question about a concept: stable knowledge, no search needed" };
  return { kind: "open", reason: "no rule applied; the model decides" };
}
