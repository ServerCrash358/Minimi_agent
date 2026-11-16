import type { MessageRow, SourceRow } from "./db/repo";
import type { ChatMessage } from "./types";

/** Rebuild UI messages from the database. Same shape the live stream produces: source parts, then text. */
export function toUIMessages(rows: MessageRow[], sources: SourceRow[]): ChatMessage[] {
  const byMsg = new Map<string, SourceRow[]>();
  for (const s of sources) byMsg.set(s.message_id, [...(byMsg.get(s.message_id) ?? []), s]);
  return rows.map((m): ChatMessage => {
    const srcParts = (byMsg.get(m.id) ?? []).map((s) => ({
      type: "data-source" as const,
      id: `src-${s.n}`,
      data: { n: s.n, url: s.url, title: s.title ?? s.url, publishedAt: s.published_at },
    }));
    return {
      id: m.id,
      role: m.role,
      metadata: { createdAt: m.created_at },
      parts: [...srcParts, { type: "text", text: m.content }],
    };
  });
}
