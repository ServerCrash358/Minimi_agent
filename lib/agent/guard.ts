import { generateText, type JSONValue, type LanguageModel, type ModelMessage } from "ai";
import type { SearchToolOutput } from "../types";

// After the model answers, check the answer against rules that are about FORM, not taste, and repair it once if it
// breaks one. Each rule exists because a live model was seen breaking it: an empty reply, a one-line non-answer after
// four searches ("Search Neon pricing."), no [n] citations, no "As of" date, a list where a table belongs.
//
// The repair is one extra model call and only happens when a rule fails. It never loops: whatever the second
// attempt produces is the answer (and the trace records that it was a repair).

export type AnswerFacts = {
  text: string;
  /** Every search output this turn, prefetched or chosen by the model. */
  outputs: SearchToolOutput[];
  /** A re-check over this many recalled items should be a table. */
  recheckItems: number;
  recheck: boolean;
};

const hasResults = (o: SearchToolOutput) => !("error" in o) && o.results.length > 0;

export function inspectAnswer(a: AnswerFacts): string[] {
  const defects: string[] = [];
  const text = a.text.trim();
  const searched = a.outputs.some(hasResults);

  if (!text) return ["The answer was empty. Write the answer now."];
  if (searched && text.length < 40) defects.push("The answer is too short to be useful. Answer the question fully, using the search results.");
  if (searched && !/\[\d{1,2}\]/.test(text)) {
    defects.push("Cite sources inline with the [n] numbers shown in the search results, for example [1], right after each claim taken from them.");
  }
  if (searched && !/\bas of\b/i.test(text)) defects.push('Open the answer with the date, in the form "As of <today\'s date>, ...".');
  const hasTable = /^\s*\|.*\|\s*$/m.test(text) && /\|\s*:?-{3,}/.test(text);
  if (a.recheck && a.recheckItems >= 3 && !hasTable) {
    defects.push("Present the comparison as a markdown table with the columns Item | Then | Now | Verdict | Source, one row per item.");
  }
  return defects;
}

export type RepairInput = {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  draft: string;
  defects: string[];
  providerOptions?: Record<string, Record<string, JSONValue>>;
  abortSignal?: AbortSignal;
};

/** One non-streaming rewrite of a draft that broke the rules. Tools are off: everything needed is in the prompt. */
export async function repairAnswer(i: RepairInput): Promise<string> {
  const { text } = await generateText({
    model: i.model,
    system: i.system,
    messages: [
      ...i.messages,
      { role: "assistant", content: i.draft.trim() || "(no answer)" },
      {
        role: "user",
        content:
          "Rewrite your answer, fixing these problems:\n- " +
          i.defects.join("\n- ") +
          "\nUse the search results and the Prior conversations block in your instructions as the only sources of facts. " +
          "Reply with the corrected answer only, with no commentary about the rewrite.",
      },
    ],
    providerOptions: i.providerOptions,
    abortSignal: i.abortSignal,
    maxRetries: 1,
  });
  return text;
}
