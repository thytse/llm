# Undertone · demo implementation

Version 0.3 · 15 November 2026 (Hong Kong)

A local, source-linked relationship assistant. Create a person, confirm a WhatsApp TXT import, read a concise profile, inspect original evidence, and ask follow-up questions in English or written Cantonese. Individual and selected-network rooms keep separate context.

## What changed

- **Whole-conversation profiles:** resumable read/aggregate/check jobs process every imported message in bounded batches. Coverage, preprocessing calls and provider tokens are recorded separately. A failed batch does not become a completed profile. Pause/resume is available; closed-page jobs retain completed batches.
- **Readable profiles:** short checked statements such as “Elly studies computer science” and “Elly enjoys programming and Korean food”. An Evidence button opens original messages, dates and source spans. Missing areas stay explicitly insufficient.
- **Interpretations and advice:** descriptive communication observations can be inferred from text, not only explicit self-descriptions. Limited examples are tentative; recurring habits/personality need three exchanges over two days. Personality reflection is opt-in. One-off food choices can motivate tentative suggestions without being promoted to stable preferences. General suggestions remain available when personalised checking fails; failures remain visible and cannot earn benchmark success.
- **Cantonese:** Traditional Chinese and mixed Cantonese/English content, 上午/下午 timestamps and full-width sender punctuation. Replies match the question language. Cantonese retrieval uses Han bigrams and a pinned local multilingual encoder; this is a language-support implementation, not a measured Cantonese-accuracy claim.
- **Retrieval:** local embeddings, keyword ranking, reciprocal-rank fusion, source-linked profile hints, neighbour context, date scope, snapshot/query cache and exact original-span checks. No chat text is sent to Hugging Face; the service downloads public model assets and runs inference locally.
- **Bounded agent:** A/B/C/B-wide; at most four model calls, two unique allowed reads and one acquisition round. Tools: message search, recent updates, surrounding context, profile-attribute lookup and deterministic scoped message counts. Disallowed/duplicate/excess actions are blocked and logged.
- **Resource limits:** o200k_base conservative accounting (+100 wrapper tokens), 2,000 initial evidence tokens (4,000 for B-wide), 4,000 later evidence tokens, 8,000 per online input, 1,000 online output, 90-second answer deadline. Offline preprocessing has a separate 16,000-input / up to 5,000-output / 1,000-call job ceiling. Provider failures are counted, not silently retried.
- **Revisable memory:** imports mark prior findings stale; new checked records link predecessors/replacements. Source snapshots remain intact. Finding history and JSON report export are available. Deleting a profile removes its sources, jobs, index and related turns while preserving unrelated conversations.
- **Drafting:** a separate budgeted draft action, editable by the user, without any send capability. User edits are not model-verified.
- **Retention:** authenticated access enforces a rolling seven-day source policy; the local encoder process also runs an hourly local purge while it is running. Backups, exported reports and provider retention are separate. No promise of purging a powered-off computer is made.

## Local setup

Use Node 24 LTS and npm. First run downloads public ONNX model files; allow network access for that download. Application data is stored in ignored `.wrangler/state`; public model assets are in ignored `.cache/models`.

```sh
npm ci --no-audit --no-fund
npm run build
npm run db:migrate:local
```

The migration helper applies all three immutable migrations and preserves existing records. It can be run again safely.

Configure only the provider(s) you use, through hidden terminal prompts:

```sh
node scripts/configure-hku-key.mjs
node scripts/configure-poe-key.mjs
```

Both preserve unrelated provider/encoder settings. Keys are saved only in the ignored mode-0600 `.dev.vars` file; never paste them into source, shell arguments or chat. The local encoder creates its private service token automatically.

Start both processes:

```sh
npm run dev:demo
```

Open http://127.0.0.1:5173/. This command starts the encoder, waits until it is ready, then starts the local app. Stop other copies on ports 5173/8788 before using the combined launcher. For development, the two processes can instead run in separate terminals:

```sh
node scripts/retrieval-service.mjs
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Restart the app once if the encoder created its token after the app had already started. Select HKU or Poe in the **Model service** control. Poe Claude Sonnet 5.5 is the default. GPT-5.4 and HKU remain selectable; GPT-6 Luna is disabled while absent from the API catalogue. If Sonnet availability cannot be confirmed, GPT-5.4 is explicitly shown as the active fallback. Provider rate windows are enforced server-side; a whole-conversation job may take minutes on the HKU quota. Progress is shown instead of silently summarising only a sample.

The starter supplies a development identity on loopback. This is not verified production authentication and must not be exposed as a public development server.

## Providers and encoder revisions

HKU uses the student-specific Chat Completions endpoint, API version 2024-10-21, `api-key`, and `gpt-4.1-nano`. Poe Claude Sonnet 5.5 uses Chat Completions with strict JSON schemas; GPT-5.4 uses Responses. Both use the same saved Poe bearer credential. Configuration is server-side; workspace responses expose only availability flags. Provider response model IDs and attempted-call usage are logged without transcripts. Cost fields remain null when the provider does not report attributable USD; `scripts/check-poe-usage.mjs` separately reads actual account-wide API spending.

Production-language retrieval uses `Xenova/paraphrase-multilingual-MiniLM-L12-v2` at revision `2c4055b12046f11709e9df2c122e59ffbdc2f900` (q8 ONNX, mean pooled, normalised, 384 dimensions). The proposal's English encoder remains available for a **separate clean benchmark index**:

```sh
MINILM_BENCHMARK=1 node scripts/retrieval-service.mjs
```

That mode uses `Xenova/all-MiniLM-L6-v2` at revision `751bff37182d3f1213fa05d7196b954e230abad9`. Do not silently mix encoder modes or reuse an incompatible index; encoder mismatches fail explicitly. Multilingual product results are separate from a frozen English primary benchmark.

## Verification and evaluation

```sh
npm run typecheck
npm test
npm run build
npm run evaluation:plan
```

Tests cover source offsets/normalisation, isolation guards, bounded actions, safe fallbacks, Cantonese imports, token splitting, whole-conversation batch coverage and temporal availability checks. CHECKS.md records real synthetic-provider runs and failures. A few successful live examples do not establish reasoning accuracy.

`evaluation/` contains a draft 24-history corpus, a gated runner, blinding helper and history-level bootstrap scorer. Human gold review, pilot approval, genuinely multi-person task expansion, the full 320-output comparison, independent ratings and the complete prespecified secondary suites are **not completed**. Draft generation is not equivalent to an independent benchmark. See evaluation/README.md. The current UI is React/TypeScript/Vinext with SQLite-based D1, a deliberate stack change from Python/Streamlit.

## Hosting status and remaining release work

This is a working local demo, **not a deployed public product**. Previous Sites source synchronization was rejected by automatic approval policy. Hosted authentication, database migrations and a private CPU embedding-service deployment have not been verified. Cloudflare Workers cannot use this computer's loopback encoder in production; a private reachable encoder service is required before hosting. Previously configured remote model credentials predate rotation and must be refreshed. Do not publish a development identity or claim the local URL is online hosting.

The repository contains no API keys or private conversation database. Do not package `.dev.vars`, `.wrangler`, `.cache`, usage ledgers, private rating mappings or private exports. Synthetic fixtures are clearly labelled.

Recommendation priorities: respect applicable restrictions first; then prefer the person’s explicit current request, stated preference, repeated choices, one-off observations, and finally clearly labelled general advice. Recency, scope and counterexamples matter; these are model instructions, not calibrated numeric confidence scores. Final checking retains all retrieved evidence to inspect overlooked stronger signals. Replies follow the question language; Cantonese questions receive natural written Cantonese in Traditional Chinese.

Profile performance: Poe reads up to three independent batches concurrently; HKU remains serial and paced. Successful reading batches are cached privately for seven days, scoped by owner/person, exact source packet, context, model/provider, behaviour setting, current day and prompt revision. Refreshes and appended imports reuse unchanged batches; changed batches and final synthesis/review are rerun. New jobs benefit from caches populated after this upgrade. A reload can restore a clearly labelled preliminary summary from its saved job; it is not exported or used as a checked profile. Summary generation does not wait for semantic indexing; question submission prepares its own index. Empty export records are counted for coverage but do not need search embeddings. Storage limits are 50,000 messages per workspace and 20,000 per person; uploads support 10,000 messages / 1.5 MB each. These are configured PoC capacities, not a validated unlimited-scale service.

The home view, Ask across my people, accepts activity-first questions and includes all profiles by default with explicit scope chips to exclude people. It combines source-linked checked profile hints, relevant chat excerpts and versioned user-provided relationship/context records. It can suggest someone from supplied context without requiring a generated profile. Candidate cards explain the fit, link to evidence and keep unknown availability provisional. Explicit preferences rank above weaker contextual/observational matches; raw citation counts do not determine rank. The network assistant uses its own 4,000-token evidence / 12,000-input / 1,800-output limits and is separate from primary benchmark chat mode. It does not infer that two candidates know each other or send invitations.

The top-layer network assistant does not wait for indexing every relationship. It uses bounded, labelled user-provided profile excerpts, checked summary citations and relevant lexical chat excerpts (including café/study aliases across English/Cantonese); ready indexes additionally supply semantic matches. It discloses that limited scope and does not claim a full-history search when indexes are unavailable. Individual chat/benchmark retrieval still requires its complete index.

Offline Poe profile requests allow up to 180 seconds each; HKU requests keep 90 seconds. A running job cannot be reclaimed until its provider deadline plus a 30-second lease margin. Timeouts stop with a readable resume instruction and retain completed batch checkpoints/caches. They are not automatically retried and do not imply invalid credentials. New requests without an explicit provider default to Poe; existing saved jobs retain their original provider. Online answer deadlines remain bounded separately.

Consolidation uses short observation_N handles with full supporting/contrary lineage retained server-side and restored before source validation. Groups are budgeted using the actual compact payload, up to 64 observations / 6,000 input tokens. Each merge outputs at most eight observations; each completed round must shrink, and synthesis starts at eight or fewer observations regardless of original citation length. Nonshrinking or incomplete-lineage output fails with a saved checkpoint rather than repeating reduction rounds. Legacy reduction checkpoints migrate without rereading completed message batches. Profile output caps are 3,000 for reading, 5,000 for consolidation/synthesis and 1,200 for final review. Incomplete provider responses retain status/reason, configured output cap and reported usage in timing records without logging response text. Sonnet and Luna availability is checked against Poe’s public model catalogue (five-minute cache); unavailable Luna is disabled and labelled, with no silent model substitution or hidden inference request. Existing saved jobs retain their service/model choice.

Conversation meaning: shared prompts cover sarcasm/irony, teasing, exaggeration, indirect requests/invitations, softened refusals, frustration and reassurance. Interpretations use tentative findings with contextual citations, distinguish literal wording from implied meaning, and preserve plausible alternatives. Profile summaries place examples under Communication style; repeated tendencies retain the distinct-exchange requirement. This is model interpretation, not a validated intent classifier.

Online model packets send each original evidence body once. Draft/candidate citations are reduced to source IDs for model review, while saved/UI citations retain verbatim originals and coordinates. This avoids double-counting quotations after adaptive retrieval; the 8,000-token individual request ceiling remains enforced.
