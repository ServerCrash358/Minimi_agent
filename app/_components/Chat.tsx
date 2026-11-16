"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Message } from "./Message";

const SUGGESTIONS = [
  "What is the latest Node.js LTS version?",
  "Compare managed Postgres pricing: Neon, Supabase and AWS RDS",
  "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
  "What did I ask you on Monday? Is your answer still correct today?",
];

const MAX_CHARS = 4000; // matches the server's limit

/** Browser-level failures arrive as terse engine strings; say what actually happened. */
function readableError(message: string | undefined): string {
  const m = message ?? "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return m.trim() || "Something went wrong. Please try again.";
}

export function Chat({
  threadId,
  initialMessages,
  onTurnDone,
}: {
  threadId: string;
  initialMessages: ChatMessage[];
  onTurnDone: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        // The server owns history (it is the memory). The browser sends only the new turn.
        prepareSendMessagesRequest: ({ id, messages }) => {
          const last = messages[messages.length - 1];
          const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return { body: { threadId: id, text, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } };
        },
      }),
    [],
  );

  const { messages, sendMessage, regenerate, stop, status, error, clearError } = useChat<ChatMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => onTurnDone(),
  });

  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const box = useRef<HTMLTextAreaElement>(null);

  // Follow the stream unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    pinned.current = true;
    sendMessage({ text: t });
    setInput("");
  }

  const last = messages[messages.length - 1];
  const awaitingAssistant = busy && last?.role === "user";
  // The question was saved but no answer was (failed turn, closed tab). Offer a retry instead of silence.
  const unanswered = !busy && !error && last?.role === "user";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div role="log" aria-live="polite" aria-label="Conversation" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-start gap-5 pt-[10vh]">
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight">What should we look into?</h1>
                <p className="mt-2 max-w-[56ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
                  I search the live web and I remember our earlier conversations, so you can ask me to re-check
                  something I told you before.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <Message key={m.id} message={m} streaming={busy && i === messages.length - 1 && m.role === "assistant"} />
            ))
          )}

          {awaitingAssistant ? (
            <div className="dots" role="status" aria-label="Thinking">
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {unanswered ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[14.5px]"
              style={{ borderColor: "var(--line)", color: "var(--ink-2)", background: "var(--card)" }}
            >
              <span>This question has no answer yet.</span>
              <button
                onClick={() => regenerate()}
                className="rounded-lg border px-3 py-1 text-[13.5px] font-medium"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                Answer it
              </button>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[14.5px]"
              style={{ borderColor: "var(--bad)", color: "var(--bad)", background: "var(--card)" }}
            >
              <span>{readableError(error.message)}</span>
              <button
                onClick={() => {
                  clearError();
                  regenerate();
                }}
                className="rounded-lg border px-3 py-1 text-[13.5px] font-medium"
                style={{ borderColor: "var(--bad)" }}
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-5 pt-2">
        <form
          className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-2xl border p-2 shadow-sm"
          style={{ borderColor: "var(--line)", background: "var(--card)" }}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={box}
            rows={1}
            value={input}
            maxLength={MAX_CHARS}
            autoFocus
            placeholder="Ask anything, or ask about an earlier conversation"
            aria-label="Message"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[15.5px] outline-none placeholder:text-[var(--ink-3)]"
          />
          {input.length > MAX_CHARS - 300 ? (
            <span className="self-center pr-1 text-[12.5px]" style={{ color: input.length >= MAX_CHARS ? "var(--bad)" : "var(--ink-3)" }}>
              {MAX_CHARS - input.length} left
            </span>
          ) : null}
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="h-10 rounded-xl border px-4 text-[14px] font-medium"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-10 rounded-xl px-4 text-[14px] font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
