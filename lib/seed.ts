import { DateTime } from "luxon";
import { db } from "./db";
import { ensureThread, insertFacts, insertMessage, insertSources, newId } from "./db/repo";

// Demo history, so the three sample questions can be tried without waiting a week:
//   "On Monday we shortlisted 5 CRM tools..."          -> the most recent Monday
//   "What did I ask you on 3 November?"                -> 3 November (this year, or last if it is still ahead)
//   "Last Tuesday I asked about Postgres hosting..."   -> Tuesday of last calendar week
//
// Everything is computed from `nowMs` and the user's timezone, so it is always "last Tuesday" whenever it runs.
// Rows are flagged demo=1 and titled "[demo]". The prices are deliberately a little out of date: the point is to
// give the agent something to re-check against the live web, not to be a source of truth.

type Fact = { entity: string; attribute: string; value: string; source_url: string };
type Source = { n: number; url: string; title: string };
type Conversation = { key: "crm" | "python" | "postgres"; day: DateTime; title: string; question: string; answer: string; sources: Source[]; facts: Fact[] };

function conversations(nowMs: number, tz: string): Conversation[] {
  const today = DateTime.fromMillis(nowMs, { zone: tz }).startOf("day");

  let monday = today.minus({ days: 1 });
  while (monday.weekday !== 1) monday = monday.minus({ days: 1 });

  let nov3 = DateTime.fromObject({ year: today.year, month: 11, day: 3 }, { zone: tz });
  if (nov3 >= today) nov3 = nov3.minus({ years: 1 });

  const tuesdayLastWeek = today.startOf("week").minus({ weeks: 1 }).plus({ days: 1 });

  const crmSources: Source[] = [
    { n: 1, url: "https://www.hubspot.com/pricing/sales", title: "HubSpot Sales Hub pricing" },
    { n: 2, url: "https://www.pipedrive.com/en/pricing", title: "Pipedrive pricing" },
    { n: 3, url: "https://www.zoho.com/crm/pricing/", title: "Zoho CRM pricing" },
    { n: 4, url: "https://www.salesforce.com/sales/pricing/", title: "Salesforce Sales pricing" },
    { n: 5, url: "https://www.freshworks.com/crm/pricing/", title: "Freshsales pricing" },
  ];
  const pgSources: Source[] = [
    { n: 1, url: "https://neon.tech/pricing", title: "Neon pricing" },
    { n: 2, url: "https://supabase.com/pricing", title: "Supabase pricing" },
    { n: 3, url: "https://aws.amazon.com/rds/postgresql/pricing/", title: "Amazon RDS for PostgreSQL pricing" },
  ];

  return [
    {
      key: "crm",
      day: monday,
      title: "[demo] CRM shortlist for a 20-person sales team",
      question: "Shortlist 5 CRM tools for a 20-person sales team. Give me the price per seat for each.",
      answer:
        `Here is a shortlist for a 20-person sales team, as of ${monday.toFormat("d LLLL yyyy")}:\n\n` +
        "| Tool | Plan | Price per seat / month | Why it fits |\n| --- | --- | --- | --- |\n" +
        "| HubSpot Sales Hub | Starter | $20 [1] | Easiest to adopt, strong free tier |\n" +
        "| Pipedrive | Advanced | $34 [2] | Pipeline-first, good for small teams |\n" +
        "| Zoho CRM | Professional | $23 [3] | Cheapest with automation |\n" +
        "| Salesforce | Starter Suite | $25 [4] | Grows into enterprise features |\n" +
        "| Freshsales | Growth | $11 [5] | Lowest cost, built-in phone |\n\n" +
        "At 20 seats, HubSpot Starter is about $400/month and Freshsales about $220/month.",
      sources: crmSources,
      facts: [
        { entity: "HubSpot Sales Hub", attribute: "Starter price per seat per month", value: "$20", source_url: crmSources[0].url },
        { entity: "Pipedrive", attribute: "Advanced price per seat per month", value: "$34", source_url: crmSources[1].url },
        { entity: "Zoho CRM", attribute: "Professional price per seat per month", value: "$23", source_url: crmSources[2].url },
        { entity: "Salesforce Sales", attribute: "Starter Suite price per seat per month", value: "$25", source_url: crmSources[3].url },
        { entity: "Freshsales", attribute: "Growth price per seat per month", value: "$11", source_url: crmSources[4].url },
      ],
    },
    {
      key: "python",
      day: nov3,
      title: "[demo] Latest Python version",
      question: "What is the latest stable Python version, and when does it reach end of life?",
      answer:
        `As of ${nov3.toFormat("d LLLL yyyy")}, the latest stable release is Python 3.14 [1]. ` +
        "It is supported with bug fixes until October 2027 and security fixes until October 2030 [1].",
      sources: [{ n: 1, url: "https://devguide.python.org/versions/", title: "Python status of versions" }],
      facts: [
        { entity: "Python", attribute: "latest stable version", value: "3.14", source_url: "https://devguide.python.org/versions/" },
        { entity: "Python 3.14", attribute: "end of security support", value: "October 2030", source_url: "https://devguide.python.org/versions/" },
      ],
    },
    {
      key: "postgres",
      day: tuesdayLastWeek,
      title: "[demo] Postgres hosting prices",
      question: "Compare managed Postgres hosting for a small SaaS: Neon, Supabase and AWS RDS. Entry-level pricing please.",
      answer:
        `Entry-level managed Postgres, as of ${tuesdayLastWeek.toFormat("d LLLL yyyy")}:\n\n` +
        "| Provider | Entry plan | Price | Notes |\n| --- | --- | --- | --- |\n" +
        "| Neon | Launch | $19/month [1] | Scales to zero, branching |\n" +
        "| Supabase | Pro | $25/month [2] | 8 GB database included |\n" +
        "| AWS RDS | db.t4g.micro | about $12/month plus storage [3] | No free tier after 12 months |\n\n" +
        "For a small SaaS, Supabase Pro is the simplest all-in-one; Neon is cheapest if traffic is bursty.",
      sources: pgSources,
      facts: [
        { entity: "Neon", attribute: "Launch plan price per month", value: "$19", source_url: pgSources[0].url },
        { entity: "Supabase", attribute: "Pro plan price per month", value: "$25", source_url: pgSources[1].url },
        { entity: "AWS RDS for PostgreSQL", attribute: "db.t4g.micro approximate price per month", value: "about $12 plus storage", source_url: pgSources[2].url },
      ],
    },
  ];
}

/** Remove this user's earlier demo rows so seeding twice does not duplicate anything. */
export function clearDemoHistory(userId: string) {
  const d = db();
  d.transaction(() => {
    const ids = (d.prepare("SELECT id FROM messages WHERE user_id = ? AND demo = 1").all(userId) as { id: string }[]).map((r) => r.id);
    for (const id of ids) {
      d.prepare("DELETE FROM facts WHERE message_id = ?").run(id);
      d.prepare("DELETE FROM sources WHERE message_id = ?").run(id);
    }
    d.prepare("DELETE FROM messages WHERE user_id = ? AND demo = 1").run(userId);
    d.prepare("DELETE FROM threads WHERE user_id = ? AND title LIKE '[demo]%' AND id NOT IN (SELECT thread_id FROM messages)").run(userId);
  })();
}

export type SeededConversation = {
  key: Conversation["key"];
  title: string;
  /** "Tue 10 Nov 2026" */
  date: string;
  isoDate: string;
  questionId: string;
  answerId: string;
};

export function seedDemoHistory(opts: { userId: string; nowMs: number; tz: string }): SeededConversation[] {
  clearDemoHistory(opts.userId);
  const out: SeededConversation[] = [];
  for (const c of conversations(opts.nowMs, opts.tz)) {
    const asked = c.day.set({ hour: 10, minute: 15 }).toMillis();
    const answered = asked + 25_000;
    const threadId = newId();
    ensureThread(threadId, opts.userId, asked, c.title);
    const questionId = insertMessage({ threadId, userId: opts.userId, role: "user", content: c.question, createdAt: asked, tz: opts.tz, demo: true });
    const answerId = insertMessage({ threadId, userId: opts.userId, role: "assistant", content: c.answer, createdAt: answered, tz: opts.tz, demo: true });
    insertSources(
      answerId,
      c.sources.map((s) => ({ n: s.n, url: s.url, title: s.title, fetched_at: answered, published_at: null, snippet: null })),
    );
    insertFacts(answerId, opts.userId, answered, c.facts);
    out.push({ key: c.key, title: c.title, date: c.day.toFormat("ccc d LLL yyyy"), isoDate: c.day.toFormat("yyyy-MM-dd"), questionId, answerId });
  }
  return out;
}
