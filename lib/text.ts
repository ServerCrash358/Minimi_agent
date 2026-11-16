/**
 * Some models (observed: Amazon Nova) write their reasoning inside <thinking>...</thinking> in the visible reply.
 * Readers should never see it, and it should not be stored as "what the agent said" in memory.
 * Also drops an unterminated block, which is what the text looks like while it is still streaming.
 * Does not trim the end: this is called on every streamed update.
 */
/** Some models cite with full-width brackets, 【1】 or ［1］. Normalise to [1] so links, tests and memory agree. */
export function normaliseCitations(text: string): string {
  return text.replace(/[【［]\s*(\d{1,2})\s*[】］]/g, "[$1]");
}

export function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, "").replace(/<thinking>[\s\S]*$/i, "");
}
