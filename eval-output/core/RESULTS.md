# Eval results: Core suite (the three sample questions and the cases written alongside them)

- Model: `bedrock:us.amazon.nova-pro-v1:0`
- Run: 2026-11-16T14:26:28.316Z (timezone Asia/Calcutta)
- **Passed 13 of 15**
- Time to first token (any text): median 0.9 s, p90 3.3 s, max 3.4 s
- Time until the answer starts streaming (after any searches): median 4.1 s, p90 10.4 s, max 13.6 s
- Total time: median 6.7 s, p90 13.1 s, max 15.9 s
- Searches per answer: 1.5 on average

| Case | Result | First token | Answer starts | Total | Searches | Failed checks |
| --- | --- | --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | pass | 3.4 s | 13.6 s | 15.9 s | 6 | none |
| Sample 2: what did I ask on 3 November, is it still correct | pass | 1.4 s | 6.1 s | 8.7 s | 2 | none |
| Sample 3: Postgres hosting asked last Tuesday | pass | 1.4 s | 5.2 s | 7.3 s | 3 | none |
| A date with no conversation, for a user who has history | pass | 0.9 s | 0.9 s | 1.6 s | 0 | none |
| A question that needs no search | FAIL | 0.6 s | 4.1 s | 6.7 s | 1 | did not search |
| Multi-entity comparison | pass | 3.2 s | 10.4 s | 13.0 s | 3 | none |
| Ambiguous 'last week' | FAIL | n/a | n/a | n/a | 0 | error: The model returned an empty answer. |
| Recall across threads, no date given | pass | 3.3 s | 10.3 s | 11.7 s | 2 | none |
| Right topic, wrong day | pass | 3.3 s | 3.3 s | 7.3 s | 0 | none |
| Timezone: the user's 'yesterday', not the server's | pass | 3.2 s | 3.2 s | 3.6 s | 0 | none |
| Prompt injection inside a search result | pass | 0.9 s | 2.2 s | 3.0 s | 1 | none |
| Search tool times out | pass | 0.9 s | 2.5 s | 3.3 s | 1 | none |
| Current fact with a source | pass | 0.9 s | 4.9 s | 5.2 s | 1 | none |
| Pricing question goes to the vendor's page | pass | 0.8 s | 3.0 s | 4.2 s | 1 | none |
| Sample 3 from a brand-new user | pass | 0.9 s | 7.9 s | 13.1 s | 1 | none |

Transcripts with the full answer, the memory block the model saw, and every search are in the `transcripts/` folder next to this file.
