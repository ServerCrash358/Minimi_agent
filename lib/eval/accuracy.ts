import type { SearchFn } from "../agent/tool";
import { seedDemoHistory, type SeededConversation } from "../seed";
import { SearchError } from "../search/tavily";
import type { SearchHit } from "../search/tavily";
import { answered, check, recalls, type Check, type EvalCase, type EvalEnv } from "./cases";
import { seedHoldout } from "./holdout";

// The accuracy suite. The other suites check that the pipeline behaves (recalls, searches, cites). This one checks that
// the ANSWER IS RIGHT: the live model reads canned vendor pages whose prices are known, and the verdict for each item
// must be the correct one. Canned pages mean the truth is known and fixed, so a wrong verdict is the model's error,
// the run costs no search credits, and it is repeatable.
//
// Each case changes SOME prices and leaves others alone, and one vendor's page fails to load, so a model that
// says "changed" for everything, or "unchanged" for everything, or hides a failure, fails.

export type Verdict = "changed" | "unchanged" | "unverified";

const UNVERIFIED = /could not verify|couldn.t verify|unverified|cannot verify|can.t verify|not verified|unable to verify/i;
const UNCHANGED = /\bunchanged\b|\bno change\b|\bnot changed\b|\bremains? (the )?same\b|\bsame\b|\bstill\b/i;
const CHANGED = /\bchanged\b|\bincreas|\bdecreas|\bhigher\b|\blower\b|\bnew price\b|\bnow\b.{0,30}\$/i;

/** The verdict the answer gives for one item: read from the table row (or sentence) that names it. */
export function verdictFor(answer: string, who: RegExp): Verdict | null {
  const lines = answer.split("\n").filter((l) => who.test(l));
  const line = lines.find((l) => l.trim().startsWith("|")) ?? lines[0];
  if (!line) return null;
  if (UNVERIFIED.test(line)) return "unverified";
  if (UNCHANGED.test(line)) return "unchanged";
  if (CHANGED.test(line)) return "changed";
  return null;
}

const verdict = (label: string, who: RegExp, expected: Verdict): Check =>
  check(`${label}: ${expected}`, (x) => {
    const got = verdictFor(x.answer, who);
    return got === expected ? true : `the answer says ${got ?? "nothing about it"}`;
  });

type Page = { title: string; url: string; content: string };

function pages(table: Record<string, Page | "fail">): SearchFn {
  return async (p) => {
    if (!p.site) {
      const news: SearchHit = { title: "Industry news", url: "https://news.example/roundup", content: "No pricing announcements this month from the vendors searched.", publishedAt: null };
      return [news];
    }
    const hit = Object.entries(table).find(([host]) => p.site === host || p.site!.endsWith("." + host))?.[1];
    if (!hit) return [];
    if (hit === "fail") throw new SearchError("The search timed out.", "timeout");
    return [{ ...hit, publishedAt: null }];
  };
}

export function seedAccuracy(userId: string, nowMs: number, tz: string): SeededConversation[] {
  return [...seedDemoHistory({ userId, nowMs, tz }), ...seedHoldout(userId, nowMs, tz)];
}

export function buildAccuracyCases(env: EvalEnv): EvalCase[] {
  const s = env.seeded;

  return [
    {
      id: "a1-postgres-one-changed",
      title: "Postgres: Neon changed, Supabase and RDS did not",
      why: "The diff must name the one price that moved and leave the others alone.",
      question: "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
      user: "seeded",
      search: pages({
        "neon.tech": { title: "Neon pricing", url: "https://neon.tech/pricing", content: "Neon pricing. Launch plan: usage-based with a $0 monthly minimum. Compute $0.106 per CU-hour. Storage $0.35 per GB-month." },
        "supabase.com": { title: "Supabase pricing", url: "https://supabase.com/pricing", content: "Supabase pricing. Pro plan: $25 per month per project, includes an 8 GB database." },
        "aws.amazon.com": { title: "Amazon RDS for PostgreSQL pricing", url: "https://aws.amazon.com/rds/postgresql/pricing/", content: "Amazon RDS for PostgreSQL pricing. db.t4g.micro: about $12 per month plus storage." },
      }),
      checks: [answered, recalls(s.postgres), verdict("Neon", /neon/i, "changed"), verdict("Supabase", /supabase/i, "unchanged"), verdict("RDS", /rds/i, "unchanged")],
    },
    {
      id: "a2-crm-one-changed-one-unverifiable",
      title: "CRM: HubSpot changed, three unchanged, one page failed to load",
      why: "Five items, three different truths. A failed page must be reported as unverified, not guessed at.",
      question: "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
      user: "seeded",
      search: pages({
        "hubspot.com": { title: "HubSpot Sales Hub pricing", url: "https://www.hubspot.com/pricing/sales", content: "HubSpot Sales Hub Starter: $30 per seat per month, billed annually." },
        "pipedrive.com": { title: "Pipedrive pricing", url: "https://www.pipedrive.com/en/pricing", content: "Pipedrive Advanced plan: $34 per seat per month, billed annually." },
        "zoho.com": { title: "Zoho CRM pricing", url: "https://www.zoho.com/crm/pricing/", content: "Zoho CRM Professional: $23 per user per month, billed annually." },
        "salesforce.com": { title: "Salesforce pricing", url: "https://www.salesforce.com/sales/pricing/", content: "Salesforce Starter Suite: $25 per user per month, billed annually." },
        "freshworks.com": "fail",
      }),
      checks: [
        answered, recalls(s.crm),
        verdict("HubSpot", /hubspot/i, "changed"), verdict("Pipedrive", /pipedrive/i, "unchanged"), verdict("Zoho", /zoho/i, "unchanged"),
        verdict("Salesforce", /salesforce/i, "unchanged"), verdict("Freshsales", /freshsales/i, "unverified"),
      ],
    },
    {
      id: "a3-python-version-moved-on",
      title: "Python: the latest stable version has moved on",
      why: "'Is your answer still correct?' when it is not: the old claim must be restated and marked changed, with the new version.",
      question: "What did I ask you on 3 November? Is your answer still correct today?",
      user: "seeded",
      search: pages({
        "python.org": { title: "Python status of versions", url: "https://devguide.python.org/versions/", content: "Status of Python versions. Python 3.15 is the latest stable release (feature release). Python 3.14 is in bugfix maintenance." },
      }),
      checks: [
        answered, recalls(s.python),
        check("restates the old claim (3.14)", (x) => (/3\.14/.test(x.answer) ? true : "the old version is not mentioned")),
        check("reports the new version (3.15)", (x) => (/3\.15/.test(x.answer) ? true : "the new version is not mentioned")),
        check("says it is no longer correct", (x) => (/\b(no longer|not (still )?(correct|accurate)|changed|outdated|incorrect|moved on|superseded)\b/i.test(x.answer) ? true : "no statement that the old answer is out of date")),
      ],
    },
    {
      id: "a4-helpdesk-one-changed",
      title: "Helpdesk: Intercom changed, the other three did not",
      why: "Held-out topic and weekday; one price up, three the same.",
      question: "On Thursday we shortlisted 4 helpdesk tools for a 12-person support team. Has any of them changed pricing or launched something big since?",
      user: "seeded",
      search: pages({
        "zendesk.com": { title: "Zendesk pricing", url: "https://www.zendesk.com/pricing/", content: "Zendesk Suite Team: $55 per agent per month, billed annually." },
        "freshworks.com": { title: "Freshdesk pricing", url: "https://www.freshworks.com/freshdesk/pricing/", content: "Freshdesk Pro: $49 per agent per month, billed annually." },
        "helpscout.com": { title: "Help Scout pricing", url: "https://www.helpscout.com/pricing/", content: "Help Scout Standard: $50 per user per month, billed annually." },
        "intercom.com": { title: "Intercom pricing", url: "https://www.intercom.com/pricing", content: "Intercom Essential: $39 per seat per month, billed annually." },
      }),
      checks: [
        answered, recalls(s.helpdesk),
        verdict("Zendesk", /zendesk/i, "unchanged"), verdict("Freshdesk", /freshdesk/i, "unchanged"),
        verdict("Help Scout", /help ?scout/i, "unchanged"), verdict("Intercom", /intercom/i, "changed"),
      ],
    },
    {
      id: "a5-vectordb-free-tier-grew",
      title: "Vector databases: Qdrant's free tier changed, the others did not",
      why: "A change that is not a price: the free cluster grew. 'Two weeks ago' is a date range, and the TypeScript chat inside that range must not pull in an irrelevant check.",
      question: "Two weeks ago I asked you about vector database hosting. Has any pricing changed since then?",
      user: "seeded",
      search: pages({
        "pinecone.io": { title: "Pinecone pricing", url: "https://www.pinecone.io/pricing/", content: "Pinecone Standard plan: $50 per month minimum, usage-based above that." },
        "qdrant.tech": { title: "Qdrant Cloud pricing", url: "https://qdrant.tech/pricing/", content: "Qdrant Cloud free cluster: now 4 GB of storage at no cost (previously 1 GB)." },
        "weaviate.io": { title: "Weaviate Cloud pricing", url: "https://weaviate.io/pricing", content: "Weaviate Cloud Flex plan: from $45 per month, pay as you go." },
      }),
      checks: [
        answered, recalls(s.vectordb),
        verdict("Pinecone", /pinecone/i, "unchanged"), verdict("Qdrant", /qdrant/i, "changed"), verdict("Weaviate", /weaviate/i, "unchanged"),
        check("does not drag in the unrelated TypeScript chat", (x) => (/typescript/i.test(x.answer) ? "the answer mentions TypeScript" : true)),
      ],
    },
  ];
}
