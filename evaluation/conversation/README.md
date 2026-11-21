# Conversation interpretation development evaluation

These six small, synthetic contrast cases are development material, **not a human-labelled gold set**. They contain no user chat. The runner invokes the same conversation engine used by ordinary individual chat; it does not introduce a user mode or change the research A/B/C benchmark.

Run `node scripts/evaluate-conversation.mjs` to prepare a plan and blank independent rating sheet without spending. Run `node scripts/evaluate-conversation.mjs --live` only when deliberately testing the configured Poe Sonnet service. It reads the existing ignored local key privately, uses six synthetic conversations, makes bounded paid calls, and saves private outputs under ignored `evaluation/runs/`. Never commit keys or replace the cases with personal histories. The usage API remains the authoritative account spending total.

Two independent reviewers should inspect each result and its original turns. Rate each dimension from 0 (incorrect/absent), 1 (partly correct), to 2 (correct and useful):

- **Source fidelity:** exact quoted originals, correct speaker/date, working source references.
- **Context coverage:** triggers, following clarification, counterexamples and repairs retained.
- **Interpretation:** literal versus implied meaning supported by contextual clues; no forced sarcasm.
- **Calibration:** self-reports separated from interpretation; alternatives and uncertainty proportionate.
- **Usefulness and language:** direct, detailed response in the question's language; natural Cantonese where requested.

Also mark unsupported factual claims, omitted decisive turns and incorrect emotional attribution as binary errors. The application’s checker verdict is not an independent human rating. Reviewers must provide their own IDs and explanations; do not populate scores from model self-evaluation. Compare variants on the same cases and record disagreements/adjudication separately. Timing/token counts are observed runtime measurements; USD cost is not inferred from tokens.

The generated `human-ratings.json` starts with `scores: null` and `reviewer_id: null`. Independent human ratings, inter-rater agreement, live semantic accuracy and a representative relationship-history evaluation remain **outstanding**. The optional `--score PATH` reports only supplied ratings with identified reviewers; it refuses incomplete or invalid entries. A small development score is not a claim of general accuracy.
