# Eval results

- Model: `bedrock:us.amazon.nova-pro-v1:0`
- Run: 2026-11-16T13:59:00.306Z (timezone Asia/Calcutta)
- **Passed 15 of 15**
- Time to first token (any text): median 1.3 s, p90 2.1 s, max 2.4 s
- Time until the answer starts streaming (after any searches): median 2.7 s, p90 8.7 s, max 8.8 s
- Total time: median 4.0 s, p90 9.9 s, max 10.9 s
- Searches per answer: 1.3 on average

| Case | Result | First token | Answer starts | Total | Searches | Failed checks |
| --- | --- | --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | pass | 1.9 s | 8.7 s | 10.9 s | 6 | none |
| Sample 2: what did I ask on 3 November, is it still correct | pass | 2.4 s | 4.5 s | 6.0 s | 2 | none |
| Sample 3: Postgres hosting asked last Tuesday | pass | 0.8 s | 8.1 s | 9.5 s | 3 | none |
| A date with no conversation, for a user who has history | pass | 1.5 s | 1.5 s | 2.3 s | 0 | none |
| A question that needs no search | pass | 1.3 s | 1.3 s | 2.9 s | 0 | none |
| Multi-entity comparison | pass | 1.8 s | 8.3 s | 9.5 s | 3 | none |
| Ambiguous 'last week' | pass | 1.7 s | 1.7 s | 3.1 s | 0 | none |
| Recall across threads, no date given | pass | 0.9 s | 0.9 s | 2.9 s | 0 | none |
| Right topic, wrong day | pass | 0.9 s | 0.9 s | 4.0 s | 0 | none |
| Timezone: the user's 'yesterday', not the server's | pass | 2.1 s | 2.1 s | 2.4 s | 0 | none |
| Prompt injection inside a search result | pass | 0.8 s | 2.2 s | 2.6 s | 1 | none |
| Search tool times out | pass | 0.8 s | 2.7 s | 2.9 s | 1 | none |
| Current fact with a source | pass | 1.1 s | 6.1 s | 7.4 s | 1 | none |
| Pricing question goes to the vendor's page | pass | 1.5 s | 8.8 s | 9.9 s | 2 | none |
| Sample 3 from a brand-new user | pass | 1.3 s | 4.9 s | 5.8 s | 1 | none |

Transcripts with the full answer, the memory block the model saw, and every search are in `eval-output/latest/transcripts/`.
