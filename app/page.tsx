"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Chat } from "./_components/Chat";

type ThreadItem = { id: string; title: string; updatedAt: number };

const LAST = "mm_last_thread";

function remember(id: string) {
  try {
    localStorage.setItem(LAST, id);
  } catch {}
}
function recall(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

export default function Home() {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [current, setCurrent] = useState<{ id: string; messages: ChatMessage[] } | null>(null);
  const [menu, setMenu] = useState(false);

  const refresh = useCallback(async (): Promise<ThreadItem[]> => {
    try {
      const res = await fetch("/api/threads", { cache: "no-store" });
      const { threads } = (await res.json()) as { threads: ThreadItem[] };
      setThreads(threads);
      return threads;
    } catch {
      return [];
    }
  }, []);

  const open = useCallback(async (id: string) => {
    let messages: ChatMessage[] = [];
    try {
      const res = await fetch(`/api/threads/${id}`, { cache: "no-store" });
      messages = ((await res.json()) as { messages: ChatMessage[] }).messages;
    } catch {}
    remember(id);
    setCurrent({ id, messages });
    setMenu(false);
  }, []);

  const startNew = useCallback(() => {
    const id = crypto.randomUUID();
    remember(id);
    setCurrent({ id, messages: [] });
    setMenu(false);
  }, []);

  useEffect(() => {
    (async () => {
      const list = await refresh();
      const saved = recall();
      if (saved && list.some((t) => t.id === saved)) await open(saved);
      else startNew();
    })();
  }, [refresh, open, startNew]);

  const sidebar = (
    <nav className="flex h-full w-[272px] shrink-0 flex-col border-r" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="p-3">
        <button
          onClick={startNew}
          className="w-full rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="px-3 py-2 text-[13.5px]" style={{ color: "var(--ink-3)" }}>
            Your conversations show up here, and I remember all of them.
          </p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => open(t.id)}
              title={t.title}
              className="mb-0.5 block w-full truncate rounded-lg px-3 py-2 text-left text-[14px]"
              style={{
                background: current?.id === t.id ? "var(--card)" : "transparent",
                color: current?.id === t.id ? "var(--ink)" : "var(--ink-2)",
                fontWeight: current?.id === t.id ? 600 : 400,
              }}
            >
              {t.title}
            </button>
          ))
        )}
      </div>
      <div className="border-t p-3 text-[13px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
        <a href="/debug" className="underline underline-offset-2">
          Debug view
        </a>
      </div>
    </nav>
  );

  return (
    <div className="flex h-dvh">
      <div className="hidden md:block">{sidebar}</div>
      {menu ? (
        <div className="fixed inset-0 z-20 flex md:hidden" onClick={() => setMenu(false)}>
          <div onClick={(e) => e.stopPropagation()}>{sidebar}</div>
          <div className="flex-1 bg-black/40" />
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2 md:hidden" style={{ borderColor: "var(--line)" }}>
          <button onClick={() => setMenu(true)} aria-label="Open conversations" className="rounded-lg border px-3 py-1.5 text-[14px]" style={{ borderColor: "var(--line)" }}>
            Chats
          </button>
          <button onClick={startNew} className="rounded-lg px-3 py-1.5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
            New
          </button>
        </header>
        {current ? (
          <Chat key={current.id} threadId={current.id} initialMessages={current.messages} onTurnDone={refresh} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[14px]" style={{ color: "var(--ink-3)" }}>
            Loading...
          </div>
        )}
      </main>
    </div>
  );
}
