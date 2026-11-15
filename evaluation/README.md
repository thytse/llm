# Evaluation status
The generated corpus is DRAFT, not a completed benchmark. It contains 24 seed histories (8 development/16 test), each with 240 messages and five seed questions. Annotation proposals are AI-generated and require two independent reviewers; multi-person tasks require additional people/constraints. Do not claim independent gold data or measured effectiveness.

`node scripts/evaluation/generate-corpus.mjs` regenerates draft inputs. Freeze model, encoder, prompts, retrieval, scopes, tokenizer and seeds after the 20-question development pilot, not after held-out results. Record human authors and two non-author gold reviewers. Use one pinned model across A/B/C/B-wide. Whole-profile preprocessing is shared and accounted separately. Clear room state between independent questions.

`blind.mjs runs.jsonl` produces a shuffled packet and a separate private mapping. Human assessors must not receive the mapping. Assign a second rater to the prespecified 25% history-level audit (80 of 320 outputs). Assessors cannot score histories they authored. Save actual ratings; never synthesize them with the online critic.

`score.mjs evaluation/ratings/private-runs.jsonl ratings.json` computes per-history answerable scores and 10,000 paired history-level bootstrap replicates. Every answerable task remains in the denominator; verification failures are failures even if the UI offers general advice. Correct handling of underdetermined tasks is separate. Human agreement/adjudication and retrieval/citation diagnostics remain required in the final report.

The runner refuses unfrozen data. There are no completed 320-output results or human ratings yet.

`freeze.mjs reviewed-manifest.json` validates explicit human gold reviews, source hashes, split boundaries, real multi-person records and pilot-selected configuration. It does not invent approvals.
