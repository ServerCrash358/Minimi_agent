import * as chrono from "chrono-node";
import { DateTime } from "luxon";

// Step 1 of the pipeline: turn "Monday", "last Tuesday", "3 November" into exact UTC ranges.
// Deterministic, no LLM call, and it is the only place that knows about calendars.
//
// Design rules:
//  - All arithmetic happens in the USER'S timezone (luxon). The server clock only supplies the instant.
//    At 03:30 in Kolkata on the 17th it is still the 16th on a UTC server; "yesterday" must be the 16th.
//  - Day boundaries use calendar arithmetic (startOf("day")), never "+24h", so DST days are 23 or 25 hours.
//  - Ambiguity is not guessed away. "Monday" could be this week's or last week's, "last Tuesday" could be
//    the most recent one or the one in last calendar week, "3/11" could be 3 Nov or 11 Mar. We return every
//    plausible candidate in preference order; retrieval looks at all of them and the model is told which had history.
//  - chrono-node handles explicit dates ("3 November", "Nov 3rd 2026", ISO). Weekdays and relative phrases
//    are handled here, because chrono's weekday semantics are not the ones people mean when talking about the past.

export type DateCandidate = { startMs: number; endMs: number; label: string };

export type ResolvedReference = {
  /** Exact words from the message. */
  phrase: string;
  kind: "day" | "range";
  /** Preference order: the first is the most likely reading. */
  candidates: DateCandidate[];
  ambiguous: boolean;
  /** Every candidate is today or later. Nothing can have been said then, so retrieval skips it. */
  future: boolean;
  /** Human-readable explanation of any assumption made. Shown to the model. */
  note?: string;
};

const WEEKDAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
  tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5,
  // "mon", "sat", "sun" are deliberately not accepted: too often ordinary words.
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  "a couple of": 2, "couple of": 2,
};

/** Words that show the speaker is talking about something earlier in time. Used to accept a bare "Monday". */
const RECALL_CUE =
  /\b(asked|told|said|gave|showed|mentioned|discussed|recommended|suggested|answered|answer|shortlist(?:ed)?|compared|picked|chose|decided|looked|talked|remember|recall|earlier|before|previous(?:ly)?|last time|since then|still (?:correct|true|right|valid)|changed since|any update|we (?:\w+ed|had|did|made|found|got|saw|went)|i (?:\w+ed|had|did|made|found|got|saw|went))\b/i;

export function hasRecallCue(text: string): boolean {
  return RECALL_CUE.test(text);
}

const dayCandidate = (d: DateTime): DateCandidate => {
  const s = d.startOf("day");
  return { startMs: s.toMillis(), endMs: s.plus({ days: 1 }).startOf("day").toMillis(), label: s.toFormat("ccc d LLL yyyy") };
};

/** Inclusive range of whole days. */
const rangeCandidate = (first: DateTime, last: DateTime): DateCandidate => {
  const s = first.startOf("day");
  const l = last.startOf("day");
  return {
    startMs: s.toMillis(),
    endMs: l.plus({ days: 1 }).startOf("day").toMillis(),
    label: `${s.toFormat("ccc d LLL")} to ${l.toFormat("ccc d LLL yyyy")}`,
  };
};

const dedupe = (cs: DateCandidate[]) => cs.filter((c, i) => cs.findIndex((o) => o.startMs === c.startMs && o.endMs === c.endMs) === i);

type Built = Omit<ResolvedReference, "phrase" | "future" | "ambiguous"> & { ambiguous?: boolean };

export function resolveDates(text: string, nowMs: number, tz: string): ResolvedReference[] {
  const now = DateTime.fromMillis(nowMs, { zone: tz });
  if (!now.isValid) throw new Error(`Invalid timezone: ${tz}`);
  const today = now.startOf("day");
  const tomorrowStartMs = today.plus({ days: 1 }).toMillis();

  const found: Array<ResolvedReference & { index: number; source: "weekday" | "date" | "relative" }> = [];
  let masked = text;

  const push = (m: RegExpMatchArray, source: "weekday" | "date" | "relative", built: Built) => {
    const candidates = dedupe(built.candidates);
    found.push({
      phrase: m[0].trim(),
      index: m.index ?? 0,
      source,
      kind: built.kind,
      candidates,
      ambiguous: built.ambiguous ?? candidates.length > 1,
      future: candidates.every((c) => c.startMs >= tomorrowStartMs),
      note: built.note,
    });
  };
  const mask = (m: RegExpMatchArray) => {
    const i = m.index ?? 0;
    masked = masked.slice(0, i) + " ".repeat(m[0].length) + masked.slice(i + m[0].length);
  };
  const scan = (re: RegExp, source: "weekday" | "relative", build: (m: RegExpMatchArray) => Built | null) => {
    for (const m of [...masked.matchAll(re)]) {
      const built = build(m);
      if (!built) continue;
      push(m, source, built);
      mask(m);
    }
  };

  const mostRecentBefore = (weekday: number): DateTime => {
    let d = today.minus({ days: 1 });
    while (d.weekday !== weekday) d = d.minus({ days: 1 });
    return d;
  };

  // ---- relative days
  scan(/\bday before yesterday\b/gi, "relative", () => ({ kind: "day", candidates: [dayCandidate(today.minus({ days: 2 }))] }));
  scan(/\byesterday\b/gi, "relative", () => ({ kind: "day", candidates: [dayCandidate(today.minus({ days: 1 }))] }));
  scan(/\b(today|tonight|this (?:morning|afternoon|evening))\b/gi, "relative", () => ({ kind: "day", candidates: [dayCandidate(today)] }));

  scan(/\b(\d{1,3}|a couple of|couple of|an?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?\s+ago\b/gi, "relative", (m) => {
    const n = /^\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()];
    const unit = m[2].toLowerCase();
    if (unit === "day") return { kind: "day", candidates: [dayCandidate(today.minus({ days: n }))] };
    const centre = unit === "week" ? today.minus({ weeks: n }) : today.minus({ months: n });
    return {
      kind: "range",
      candidates: [rangeCandidate(centre.minus({ days: 3 }), centre.plus({ days: 3 }))],
      ambiguous: false,
      note: `"${m[0]}" is approximate: searched three days either side of ${centre.toFormat("ccc d LLL yyyy")}.`,
    };
  });

  // ---- relative weeks / months
  scan(/\b(?:last|previous|past)\s+week\b/gi, "relative", () => {
    const lastWeekStart = today.startOf("week").minus({ weeks: 1 });
    return {
      kind: "range",
      candidates: [
        rangeCandidate(lastWeekStart, lastWeekStart.plus({ days: 6 })), // calendar week, Monday to Sunday
        rangeCandidate(today.minus({ days: 7 }), today.minus({ days: 1 })), // the rolling seven days before today
      ],
      note: `"last week" is ambiguous (calendar week or the past seven days); both were checked.`,
    };
  });
  scan(/\bthis week\b/gi, "relative", () => ({ kind: "range", candidates: [rangeCandidate(today.startOf("week"), today)] }));
  scan(/\b(?:last|previous|past)\s+month\b/gi, "relative", () => {
    const first = today.startOf("month").minus({ months: 1 });
    return { kind: "range", candidates: [rangeCandidate(first, first.endOf("month"))] };
  });

  // ---- weekdays
  const WD = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|tues?|wed|thu(?:rs?)?|fri";
  scan(new RegExp(`\\b(?:(last|previous|past|this|next)\\s+)?(?:on\\s+)?(${WD})\\b`, "gi"), "weekday", (m) => {
    const qualifier = m[1]?.toLowerCase();
    const wd = WEEKDAYS[m[2].toLowerCase()];
    const name = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
    const recent = mostRecentBefore(wd);

    if (qualifier === "next") {
      let d = today.plus({ days: 1 });
      while (d.weekday !== wd) d = d.plus({ days: 1 });
      return { kind: "day", candidates: [dayCandidate(d)] };
    }
    if (qualifier === "this") {
      const d = today.startOf("week").plus({ days: wd - 1 });
      return { kind: "day", candidates: [dayCandidate(d)] };
    }
    if (qualifier === "last" || qualifier === "previous" || qualifier === "past") {
      const calendarLastWeek = today.startOf("week").minus({ weeks: 1 }).plus({ days: wd - 1 });
      const cands = dedupe([dayCandidate(recent), dayCandidate(calendarLastWeek)]);
      return {
        kind: "day",
        candidates: cands,
        note:
          cands.length > 1
            ? `"${m[0].trim()}" is ambiguous: the most recent ${name} or ${name} of last calendar week. Both were checked.`
            : undefined,
      };
    }
    // Bare weekday. Only accepted as a memory reference when the sentence talks about the past,
    // otherwise "is it open on Saturday?" would trigger a memory lookup.
    if (!hasRecallCue(text)) return null;
    const cands = [dayCandidate(recent), dayCandidate(recent.minus({ weeks: 1 }))];
    if (today.weekday === wd) cands.push(dayCandidate(today));
    return {
      kind: "day",
      candidates: cands,
      note: `"${m[0].trim()}" is ambiguous (this week's or the week before's). All were checked.`,
    };
  });

  // ---- explicit dates via chrono, in both day-first and month-first readings
  const pivot = new Date(Date.UTC(today.year, today.month - 1, today.day, 12));
  const byKey = new Map<string, { index: number; text: string; cands: DateCandidate[]; isRange: boolean; assumedYear: boolean }>();
  for (const parser of [chrono.en, chrono.en.GB]) {
    for (const r of parser.parse(masked, { instant: pivot, timezone: 0 }, { forwardDate: false })) {
      if (!r.start.isCertain("day") || !r.start.isCertain("month")) continue;
      const toDay = (c: typeof r.start): DateTime | null => {
        const yearCertain = c.isCertain("year");
        let d = DateTime.fromObject({ year: yearCertain ? c.get("year")! : today.year, month: c.get("month")!, day: c.get("day")! }, { zone: tz });
        if (!d.isValid) return null;
        if (!yearCertain && d > today) d = d.minus({ years: 1 }); // "3 November" in March means last November
        return d;
      };
      const a = toDay(r.start);
      if (!a) continue;
      const b = r.end && r.end.isCertain("day") && r.end.isCertain("month") ? toDay(r.end) : null;
      const cand = b ? rangeCandidate(a, b) : dayCandidate(a);
      const key = `${r.index}:${r.text}`;
      const prev = byKey.get(key);
      if (prev) prev.cands.push(cand);
      else byKey.set(key, { index: r.index, text: r.text, cands: [cand], isRange: !!b, assumedYear: !r.start.isCertain("year") });
    }
  }
  for (const v of byKey.values()) {
    const cands = dedupe(v.cands);
    const notes: string[] = [];
    if (cands.length > 1) notes.push(`"${v.text}" could be day/month or month/day; both were checked.`);
    if (v.assumedYear) notes.push(`No year given in "${v.text}"; assumed the most recent past occurrence.`);
    push([v.text] as unknown as RegExpMatchArray & { index: number }, "date", {
      kind: v.isRange ? "range" : "day",
      candidates: cands,
      note: notes.join(" ") || undefined,
    });
    found[found.length - 1].index = v.index;
  }

  // "Monday 9 Nov": the explicit date wins, the weekday is just decoration.
  const kept = found.filter((f) => {
    if (f.source !== "weekday") return true;
    const end = f.index + f.phrase.length;
    return !found.some((o) => o.source === "date" && o.index >= end && o.index - end <= 3);
  });

  return kept.sort((a, b) => a.index - b.index).map(({ index: _i, source: _s, ...ref }) => ref);
}

/** True if at least one candidate lies entirely before today in the user's timezone. */
export function refersToPast(refs: ResolvedReference[], nowMs: number, tz: string): boolean {
  const startOfToday = DateTime.fromMillis(nowMs, { zone: tz }).startOf("day").toMillis();
  return refs.some((r) => r.candidates.some((c) => c.endMs <= startOfToday));
}
