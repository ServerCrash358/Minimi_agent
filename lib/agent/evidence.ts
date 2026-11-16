import type { FactRow } from "../db/repo";
import type { SearchToolOutput } from "../types";
import { hostOf } from "./prefetch";

// A mechanical check, done in code, of each earlier value against the pages fetched today.
//
// The model is good at reading a page but sometimes glosses a comparison: in testing it wrote "Now: $19, Unchanged"
// for a page that said "$0 monthly minimum". Whether an earlier value still appears on the vendor's page is not a
// judgment, it is a string search, so code does it and reports the result as evidence.
//
// Only ABSENCE is reported. If "$19" is missing from the vendor's page, the value has very probably changed. If it IS
// present that proves little ("Python 3.14" is still on the page, as the previous release), so presence is left to the
// model's reading. An unreachable page is reported too, so it is never mistaken for "unchanged".

export type Evidence = { entity: string; attribute: string; earlier: string; host: string; status: "absent" | "unreachable" };

const MONEY = /[$€£]\s?\d[\d,]*(?:\.\d+)?/g;

function normalise(text: string): string {
  return text.replace(/([$€£])\s+/g, "$1").replace(/(\d),(?=\d{3}\b)/g, "$1");
}

/** The parts of an earlier value that must appear for it to still be current: prices, or the number itself. */
function needles(value: string): string[] {
  const money = normalise(value).match(MONEY);
  if (money?.length) return money;
  const plain = value.trim();
  return /\d/.test(plain) ? [plain] : [];
}

function appears(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = /[$€£]/.test(needle) ? "(?:\\.00)?(?!\\d)" : "(?!\\d)";
  return new RegExp(`(?<![\\d.])${escaped}${tail}`).test(haystack);
}

export function checkEarlierValues(facts: FactRow[], outputs: SearchToolOutput[]): Evidence[] {
  const byHost = new Map<string, string[]>();
  for (const o of outputs) {
    if ("error" in o) continue;
    for (const r of o.results) {
      const host = hostOf(r.url);
      if (host) byHost.set(host, [...(byHost.get(host) ?? []), normalise(r.excerpt)]);
    }
  }
  const out: Evidence[] = [];
  for (const f of facts) {
    const host = f.source_url ? hostOf(f.source_url) : null;
    if (!host) continue;
    const wanted = needles(f.value);
    if (!wanted.length) continue;
    const pages = [...byHost].filter(([h]) => h === host || h.endsWith("." + host) || host.endsWith("." + h)).flatMap(([, texts]) => texts);
    if (!pages.length) {
      out.push({ entity: f.entity, attribute: f.attribute, earlier: f.value, host, status: "unreachable" });
      continue;
    }
    const text = pages.join("\n");
    if (!wanted.every((n) => appears(text, normalise(n)))) {
      out.push({ entity: f.entity, attribute: f.attribute, earlier: f.value, host, status: "absent" });
    }
  }
  return out;
}

export function renderEvidence(evidence: Evidence[]): string {
  if (!evidence.length) return "";
  const lines = ["# Mechanical check of the earlier values against today's pages (done by code, not by guessing)"];
  for (const e of evidence) {
    lines.push(
      e.status === "absent"
        ? `- ${e.entity} | ${e.attribute} | earlier value "${e.earlier}" is NOT FOUND anywhere on the ${e.host} pages fetched today. It has very probably changed: read the page text, report the new value, and mark it Changed unless the page clearly still says the same thing.`
        : `- ${e.entity} | ${e.attribute} | earlier value "${e.earlier}": no ${e.host} page could be fetched today, so this CANNOT be verified. Mark it Could not verify. Do not assume it is unchanged.`,
    );
  }
  return lines.join("\n");
}
