"use client";

import type { ChatMessage, SourceData } from "@/lib/types";
import { Markdown } from "./Markdown";

type Part = ChatMessage["parts"][number];

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SearchChip({ part }: { part: Extract<Part, { type: "tool-web_search" }> }) {
  const q = part.input?.query ?? "";
  const site = part.input?.site;
  let state: "running" | "done" | "error" = "running";
  let detail = "";
  if (part.state === "output-available") {
    const out = part.output;
    if ("error" in out) {
      state = "error";
      detail = "could not complete";
    } else {
      state = "done";
      detail = `${out.results.length} result${out.results.length === 1 ? "" : "s"}${out.cached ? ", cached" : ""}`;
    }
  } else if (part.state === "output-error") {
    state = "error";
    detail = "failed";
  }
  const color = state === "error" ? "var(--bad)" : state === "done" ? "var(--ok)" : "var(--accent)";
  return (
    <div
      className="flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[13px]"
      style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink-2)" }}
    >
      <span
        aria-hidden
        className={state === "running" ? "dots" : ""}
        style={{ color, lineHeight: 1 }}
      >
        {state === "running" ? <span style={{ background: color }} /> : state === "done" ? "✓" : "!"}
      </span>
      <span className="truncate">
        {state === "running" ? "Searching" : state === "done" ? "Searched" : "Search failed"}:{" "}
        <span style={{ color: "var(--ink)" }}>{q}</span>
        {site ? <span style={{ color: "var(--ink-3)" }}> · {site}</span> : null}
      </span>
      {detail ? <span className="shrink-0" style={{ color: "var(--ink-3)" }}>{detail}</span> : null}
    </div>
  );
}

export function Message({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15.5px] leading-relaxed"
          style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
        >
          {text}
        </div>
      </div>
    );
  }

  const sources = new Map<number, SourceData>();
  for (const p of message.parts) if (p.type === "data-source") sources.set(p.data.n, p.data);

  const hasText = message.parts.some((p) => p.type === "text" && p.text.trim());
  const blocks = message.parts.map((p, i) => {
    if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} sources={sources} /> : null;
    if (p.type === "tool-web_search") return <SearchChip key={p.toolCallId} part={p} />;
    return null;
  });

  return (
    <div className="flex flex-col gap-3">
      {blocks}
      {streaming && !hasText ? (
        <div className="dots" aria-label="Thinking" role="status">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {!streaming && sources.size > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Sources">
          {[...sources.values()]
            .sort((a, b) => a.n - b.n)
            .map((s) => (
              <a
                key={s.n}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title}
                className="flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px] hover:underline"
                style={{ borderColor: "var(--line)", color: "var(--ink-2)", background: "var(--card)" }}
              >
                <span className="font-semibold" style={{ color: "var(--accent)" }}>{s.n}</span>
                <span className="truncate">{host(s.url)}</span>
                {s.publishedAt ? <span style={{ color: "var(--ink-3)" }}>{s.publishedAt.slice(0, 10)}</span> : null}
              </a>
            ))}
        </div>
      ) : null}
    </div>
  );
}
