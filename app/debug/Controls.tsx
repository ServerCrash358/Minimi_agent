"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Clock = { offsetDays: number; nowIso: string };

const btn = "rounded-lg border px-3 py-2 text-[14px] font-medium";
const btnStyle = { borderColor: "var(--line)", background: "var(--card)" };

export function Controls() {
  const router = useRouter();
  const [clock, setClock] = useState<Clock | null>(null);
  const [seeded, setSeeded] = useState<{ title: string; date: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadClock = useCallback(async () => setClock(await (await fetch("/api/debug/clock", { cache: "no-store" })).json()), []);
  useEffect(() => {
    loadClock();
  }, [loadClock]);

  async function setOffset(days: number) {
    setClock(
      await (await fetch("/api/debug/clock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offsetDays: days }) })).json(),
    );
  }
  async function seed() {
    setBusy(true);
    try {
      const res = await fetch("/api/debug/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      setSeeded(((await res.json()) as { seeded: { title: string; date: string }[] }).seeded);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="text-[17px] font-semibold">Demo history</h2>
        <p className="mt-1 text-[14px]" style={{ color: "var(--ink-2)" }}>
          Adds three backdated conversations to your own memory, so "what did I ask on Monday / 3 November / last Tuesday" has
          something to recall. Dates are computed from today in your timezone. Loading again replaces them.
        </p>
        <button onClick={seed} disabled={busy} className={`${btn} mt-3`} style={btnStyle}>
          {busy ? "Loading..." : "Load demo history"}
        </button>
        {seeded ? (
          <ul className="mt-3 text-[14px]">
            {seeded.map((s) => (
              <li key={s.title}>
                <span style={{ color: "var(--ink-3)" }}>{s.date}</span> {s.title}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-[17px] font-semibold">Pretend today is...</h2>
        <p className="mt-1 text-[14px]" style={{ color: "var(--ink-2)" }}>
          Moves the app's clock so you can chat now, jump ahead, and ask about "last Tuesday" without waiting. Applies to this whole
          demo instance.
        </p>
        <p className="mt-2 text-[14px]">
          App clock: <strong>{clock ? new Date(clock.nowIso).toLocaleString() : "..."}</strong>
          {clock && clock.offsetDays !== 0 ? (
            <span style={{ color: "var(--ink-3)" }}>
              {" "}
              ({clock.offsetDays > 0 ? "+" : ""}
              {clock.offsetDays} days)
            </span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 7, 30].map((d) => (
            <button key={d} className={btn} style={btnStyle} onClick={() => setOffset((clock?.offsetDays ?? 0) + d)}>
              +{d} day{d > 1 ? "s" : ""}
            </button>
          ))}
          <button className={btn} style={{ borderColor: "var(--line)" }} onClick={() => setOffset(0)}>
            Reset to real time
          </button>
        </div>
      </section>
    </div>
  );
}
