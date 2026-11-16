# Eval results: Core suite (the three sample questions and the cases written alongside them)

- Model: `bedrock:us.amazon.nova-pro-v1:0`
- Run: 2026-11-16T15:14:52.321Z (timezone Asia/Calcutta)
- **Passed 15 of 15**
- Time to first token (any text): median 2.4 s, p90 3.7 s, max 4.3 s
- Time until the answer starts streaming (after any searches): median 5.8 s, p90 10.0 s, max 10.6 s
- Total time: median 6.7 s, p90 12.7 s, max 16.5 s
- Searches per answer: 1.6 on average

| Case | Result | First token | Answer starts | Total | Searches | Failed checks |
| --- | --- | --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | pass | 3.7 s | 7.2 s | 16.5 s | 7 | none |
| Sample 2: what did I ask on 3 November, is it still correct | pass | 2.5 s | 2.5 s | 6.7 s | 2 | none |
| Sample 3: Postgres hosting asked last Tuesday | pass | 4.3 s | 10.6 s | 12.7 s | 7 | none |
| A date with no conversation, for a user who has history | pass | 1.4 s | 1.4 s | 2.4 s | 0 | none |
| A question that needs no search | pass | 0.9 s | 0.9 s | 2.1 s | 0 | none |
| Multi-entity comparison | pass | 0.9 s | 10.0 s | 11.5 s | 3 | none |
| Ambiguous 'last week' | pass | 2.0 s | 2.0 s | 3.6 s | 0 | none |
| Recall across threads, no date given | pass | 2.9 s | 2.9 s | 3.5 s | 0 | none |
| Right topic, wrong day | pass | 2.2 s | 2.2 s | 3.0 s | 0 | none |
| Timezone: the user's 'yesterday', not the server's | pass | 2.4 s | 2.4 s | 3.0 s | 0 | none |
| Prompt injection inside a search result | pass | 1.8 s | 6.1 s | 6.8 s | 1 | none |
| Search tool times out | pass | 3.4 s | 5.8 s | 6.5 s | 1 | none |
| Current fact with a source | pass | 2.9 s | 9.9 s | 10.5 s | 1 | none |
| Pricing question goes to the vendor's page | pass | 1.9 s | 8.5 s | 9.6 s | 1 | none |
| Sample 3 from a brand-new user | pass | 2.5 s | 6.4 s | 10.2 s | 1 | none |

Transcripts with the full answer, the memory block the model saw, and every search are in the `transcripts/` folder next to this file.
