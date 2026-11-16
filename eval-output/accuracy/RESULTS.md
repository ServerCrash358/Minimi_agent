# Eval results: Accuracy suite (canned vendor pages with known prices: is every verdict right?)

- Model: `bedrock:us.amazon.nova-pro-v1:0`
- Run: 2026-11-16T15:18:18.647Z (timezone Asia/Calcutta)
- **Passed 5 of 5**
- Time to first token (any text): median 1.1 s, p90 2.6 s, max 2.6 s
- Time until the answer starts streaming (after any searches): median 3.4 s, p90 6.5 s, max 6.5 s
- Total time: median 5.8 s, p90 9.6 s, max 9.6 s
- Searches per answer: 6.6 on average

| Case | Result | First token | Answer starts | Total | Searches | Failed checks |
| --- | --- | --- | --- | --- | --- | --- |
| Postgres: Neon changed, Supabase and RDS did not | pass | 0.9 s | 2.9 s | 5.6 s | 5 | none |
| CRM: HubSpot changed, three unchanged, one page failed to load | pass | 1.1 s | 3.4 s | 6.2 s | 9 | none |
| Python: the latest stable version has moved on | pass | 0.9 s | 2.6 s | 5.8 s | 4 | none |
| Helpdesk: Intercom changed, the other three did not | pass | 2.6 s | 6.5 s | 9.6 s | 7 | none |
| Vector databases: Qdrant's free tier changed, the others did not | pass | 1.4 s | 3.6 s | 5.8 s | 8 | none |

Transcripts with the full answer, the memory block the model saw, and every search are in the `transcripts/` folder next to this file.
