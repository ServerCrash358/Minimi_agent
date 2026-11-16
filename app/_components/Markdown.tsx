"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normaliseCitations, stripThinking } from "@/lib/text";
import type { SourceData } from "@/lib/types";

/** Turn "[3]" into a markdown link to source 3. Leaves real markdown links "[text](url)" alone. */
export function linkCitations(text: string, sources: Map<number, SourceData>): string {
  if (!sources.size) return text;
  return text.replace(/\[(\d{1,2})\](?!\()/g, (whole, n: string) => {
    const s = sources.get(Number(n));
    return s ? `[${n}](${s.url})` : whole;
  });
}

export function Markdown({ text, sources }: { text: string; sources: Map<number, SourceData> }) {
  const byUrl = new Map([...sources.values()].map((s) => [s.url, s]));
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const label = String(Array.isArray(children) ? children.join("") : children ?? "");
            const src = href ? byUrl.get(href) : undefined;
            const isCite = /^\d{1,2}$/.test(label) && src;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={isCite ? "cite" : undefined}
                title={isCite ? src?.title : undefined}
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {linkCitations(normaliseCitations(stripThinking(text)), sources)}
      </ReactMarkdown>
    </div>
  );
}
