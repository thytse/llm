# Independent analysis review

## Re-review disposition after implementation

The findings below describe the initial work-in-progress snapshot. A subsequent independent source review on 17 November confirms their structural fixes in the normal individual-chat and draft paths:

- `/api/ask` now routes ordinary individual chat to `runConversation` and message drafting to `runMessageDraft`; the workspace renders dated emotional episodes, contextual clues, alternatives, sources and coverage without a new user mode. Explicit research/baseline requests retain the legacy engine.
- Sendable messages and supporting notes now receive independent verdicts. An offline regression verifies that a safe Disney invitation survives an unsupported note, while a message falsely assuming agreement is withheld.
- Small scoped histories are supplied completely to both generation and contextual review. Larger histories add deterministic neighbors for review and disclose selected-original limits. This improves context handling; it cannot guarantee discovery of every distant contradiction.
- Visible coverage/limits prose is server-derived. Extraction validates episodes separately and stores successful extracts alongside omission counts and resumable checkpoints.
- Two additional re-review issues were corrected: new episode/pattern/draft information now survives in bounded, explicitly untrusted follow-up context, and legacy retrieval filters indexed rows to authorised scoped messages while fingerprinting that scope in its cache key. Episode ordering is shared between displayed numbering and follow-up context.

Independent checks: the expanded offline suite completed **84 passed, 0 failed**, exit 0 (`/tmp/undertone-independent-final-tests.log`); current typecheck passed, exit 0 (`/tmp/undertone-independent-final-typecheck.log`). After the ordinal-context refinement, its targeted follow-up check also passed **1/1**, exit 0 (`/tmp/undertone-independent-followup-test.log`).

No further blocking source-code issue was identified in this re-review. This is **not** a claim that live semantic accuracy is established, that the end-to-end UI has been independently exercised, or that independent human ratings are complete. The implementation agent is responsible for completing and reporting the remaining end-to-end/evaluation acceptance evidence. This reviewer made no paid calls or private-chat replays.

### Subsequent live-output contract issue

The implementation agent subsequently reported a live scoped run in which generation and review received all 380 messages, but every generated episode and finding failed structural validation while some patterns survived. This reviewer did not replay or inspect private chat bodies. This is an example of an integration issue the earlier injected-provider tests could not detect: those tests supplied valid objects directly and bypassed actual prompt assembly and provider compliance.

The answer prompt referred to “extraction rules” without including the extraction contract. The new shared `EPISODE_SCHEMA` in `lib/conversation-contract.ts` now gives both extraction and answer stages explicit section/support enum values, a single YYYY-MM-DD date, exact contiguous quotation rules, required fields and citation arrays. Finding enum values are now explicit as well; the revision is `episodes-v3`. Independent source inspection confirms that contract improvement, but does not establish that the provider follows it. Add a payload-level regression test that captures each assembled provider request independently, plus repeat the authorised live acceptance case and report actual accepted/omitted counts. Real output retention and independent human interpretation quality remain separate acceptance requirements.

## Initial review snapshot

Reviewed 17 November 2026. This is a read-only code and offline behavior review, apart from this report. Implementation was in progress. No credentials, private chat contents, signed URLs or paid model calls were used in the checks below. Semantic accuracy on real conversations has **not** been measured.

## Findings, in priority order

1. **[P1] The detailed conversation engine is not connected to the live question flow.** `app/api/ask/route.ts:9–11` imports and calls `runAgent` only. `runConversation` has no callers outside its own declaration. The workspace does not render `episodes` or `analysis_scope`. Consequently the new full-context and detailed episode contracts are scaffolding; they do not yet explain a change in results shown by the app. Existing `runAgent` still uses bounded excerpts and the concise three-finding prompt. This is unfinished integration, not a demonstrated regression caused by the new engine.

2. **[P1] A bad supporting note still discards a valid invitation.** `lib/agent.ts:88–92` treats the entire final verdict as one boolean and replaces the whole draft, including `draft_message`, on rejection. A reviewer accepting the message but rejecting one unrelated factual explanation cannot retain the valid message. The earlier reported Disney outcome is consistent with this branch. The specific saved production verdict was supplied by the parent investigation; this independent review verified the code behavior, not the private trace. Check the sendable message and supporting notes separately. Withhold an unsupported message premise while omitting a bad note independently.

3. **[P1] The new checker cannot see contrary context omitted by the draft.** `lib/conversation-run.ts:56` sends only originals selected by the candidate's own citation IDs. Even in full-context mode, a later correction or resolution can be absent from the check. An offline synthetic run gave the answer stage two turns (apparent praise followed by an explicit correction), while the checker received only the cited praise turn. This is a context-selection vulnerability, not proof that a particular live model misclassified it. Give the checker the complete small history; for larger histories add deterministic surrounding exchanges and counterevidence beyond the draft's own selections.

4. **[P2] The returned limits prose bypasses review.** `lib/conversation-run.ts:61` returns `draft.limits` verbatim, while only overview, next question, findings, episodes and patterns become checked items at lines 46–51. The synthetic check confirmed arbitrary limits text survives unchanged and is never reviewed. A field labelled “limits” can still contain unsupported claims. Prefer a server-generated scope disclosure from actual coverage, or include this prose in item review.

5. **[P2] One malformed extraction episode loses an otherwise useful reading batch.** `lib/conversation-run.ts:31` validates extraction episodes with one atomic `.map(checkedEpisode)`. One invalid source or quotation throws into the outer technical-failure return; the successful episodes are not cached, and retry rereads the same batch. This recreates all-or-nothing behavior during large-history preparation. Validate extracted episodes individually, preserve successful records, and retain a visible omission/error status so an empty bad batch is not silently declared complete.

6. **[P2] New-engine behavior has no automated regression coverage yet.** The 72 existing tests pass, but none invokes `runConversation` or imports the new context/items/run modules. They establish that the existing suite remains green; they do not establish full-history coverage, cache resume, emotional interpretation quality or episode-level retention. The new `variant==='A'` branch (`lib/conversation-run.ts:55`) also deliberately omits every item: keep research baseline routing explicit rather than accidentally exposing this as an ordinary answer path.

## Checks performed

- `npm test`: **72 passed, 0 failed**, exit 0. Log: `/tmp/undertone-review-tests.log`.
- `npm run typecheck`: **passed**, exit 0. Log: `/tmp/undertone-independent-review-typecheck.log`.
- Inspected API entry point, workspace rendering, new conversation contracts/planning/review modules, provider payload shaping, and existing draft validation.
- Bundled `lib/conversation-run.ts` with a mock environment and an injected offline provider. Result: answer input 2 messages; review input 1 message; later correction absent; unreviewed limits retained; 1 synthetic episode retained. This tests data flow, not model accuracy.
- No live browser acceptance test, paid inference, private history replay or human semantic rating was performed.

## Acceptance criteria before calling the update complete

1. Existing individual chat reaches the new engine without adding a new mode; source-file/date scope is authorised on the server and visibly reflected in the answer. A full-context fixture exposes every scoped original to generation and contextual review.
2. Natural Cantonese output explains literal wording, plausible implied meaning, contextual clues, alternatives and dated citations. Separate positive, negative, mixed and ambiguous examples remain inspectable. Verify source buttons resolve exact originals.
3. A valid Disney invitation plus an invalid supporting note returns a copyable invitation and omits only the note. A message that falsely assumes agreement remains withheld.
4. A sarcastic utterance with an uncited neighboring correction/resolution is still available to the checker; unsupported wording cannot survive solely because the candidate omitted the contrary source.
5. One invalid episode, one rejected item or one review-group failure does not erase other independently validated items. Large-history retries reuse saved batches, preserve exact split spans and do not claim that extraction omissions prove absence.
6. All visible generated prose is checked or explicitly server-generated; coverage and cost/latency metrics describe completed work across preparation requests accurately.
7. Add offline regression cases for the above, then run a small authorised end-to-end example. Keep the evaluation rubric, synthetic expected readings and outstanding independent human ratings separate. Report measured accuracy only after those ratings exist.
