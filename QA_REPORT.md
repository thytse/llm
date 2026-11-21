# Undertone functional QA

17 November 2026. Requested QA scope: every exposed application function, with failures sent to the original implementation agent for correction and retesting. This report distinguishes actual execution, code inspection, implementation-agent proxy results, and work not tested.

## Test environment and constraints

The QA agent could not connect to the in-app browser, including the implementation agent's dedicated tab 15/browser 3. Its available Chrome connection also failed when creating controllable tabs. Existing user tabs and profiles were not modified. The implementation agent was asked to act as the browser proxy using a dedicated tab and disposable synthetic QA profile. UI checks below remain pending until that proxy supplies observed outcomes.

This reviewer made no paid model calls, sent no contact messages, printed no credentials/private chat contents, and made no production data mutations. The API tests below bundled the real route with mocked identity, database and model boundaries.

## Failures handed back for fixes

| ID | Reproduction / actual result | Expected result | Disposition |
| --- | --- | --- | --- |
| QA-01 | Model selector had `disabled={!!busy}`, preventing model selection during a request. | Allow choosing the model for the next request; keep the current request's provider fixed. | Fixed and proxy verified: idle and pending-work switches succeed; stored request metadata remains Claude Sonnet 5.5 after selector changed to GPT-5.4 during that request. |
| QA-02 | Upload dialog rejected files above 500,000 bytes and displayed 500 KB, while parser and guide support 1.5 MB. A valid 600 KB TXT cannot reach the importer. | Use the shared import byte limit and matching copy. | Fixed with shared MAX_IMPORT_BYTES; source independently inspected. Proxy verified valid ~640 KB / 620-message synthetic file reaches preview; large file not imported. |
| QA-03 | HKU model option lacked the missing-key disable condition used for Poe options. Selecting unconfigured HKU disables subsequent actions without identifying why at the option. | Disable unavailable/missing-key HKU consistently, or clearly label its setup requirement. | Source fix independently confirmed: missing-key HKU disabled with setup-required label. Missing-key live configuration not forced for testing. |
| QA-04 | Copyable draft was only component state and disappeared after reload/HMR. New persisted fallback initially matched profile/room but not changed profile snapshot, permitting an old draft after importing more chat. | Restore saved current-scope draft after reload; changing file/date/person/snapshot must not show an old result as current. | Source fix independently confirmed: current state checks snapshot version and clears on import; saved fallback uses current scoped turns. Proxy persistence/snapshot retest pending. |
| QA-05 | Proxy imported the public 12-message Cantonese sample; automatic summary failed its first batch with “Invalid profile observation”, 0/12 covered. `profileObservations` threw on one malformed attribute; the observe prompt did not spell out the eight category enums. | Observe/merge/summary each have explicit self-contained contracts; valid individual observations survive malformed siblings; an unusable malformed result fails visibly and can resume safely. | Shared stage-specific contract and per-item validation fixed; independent targeted tests 2/2. Proxy summary ultimately completed 12/12 with all eight areas plus evidence status, supported facts/interests/communication and appropriate insufficient findings. |
| QA-06 | After successful reading, proxy summary synthesis returned “Model returned malformed JSON; stopped safely” despite provider finish_reason=stop. Actual output shape was not retained, so a code-fence cause is unproven. Usage returned by provider was not preserved on parsing failure. | Accept whole valid JSON, optionally in one exact JSON fence, then validate stage schema; reject prose extraction, trailing/multiple payloads and malformed/truncated JSON. Preserve sanitized shape and known usage diagnostics without storing raw private output. Continue retries only failed synthesis. | Strict parser/diagnostics independently inspected; targeted test 1/1. Proxy Continue retried synthesis and completed the summary, preserving prior read coverage. Five cumulative job calls include earlier failures; earlier malformed output cause remains unknown. |
| QA-07 | Proxy date-fill showed new DOM dates but the next submission still used all 12 messages: React state had not updated in that browser/tool interaction. | Submitted dates match visible input values; reversed scope rejects before inference. | Original agent added `onInput` alongside `onChange`; proxy retest immediately displayed “Date range is reversed.” This is a reproduced browser/tool interaction issue, not proof that every human date picker was broken. |
| QA-08 | HKU cooldown was applied unconditionally, so switching to Poe could leave Poe actions blocked; Poe completion could also reset the retained HKU deadline. | Cooldown affects HKU only; changing/using Poe does not erase HKU's deadline. | Original agent reported provider-scoped cooldown fix; live HKU→Poe switching retest pending. |

Separate analysis failures and their fixes are recorded in `ANALYSIS_REVIEW.md`. The implementation agent additionally reports that a live Wilson invitation now returns a copyable draft with three separately checked notes, two model calls and no verification failure; this reviewer did not run that private-profile test.

## Executed independent checks

The real `/api/ask` handler passed **7/7** isolated cases:

1. Empty question → HTTP 400.
2. Reversed date range → HTTP 400.
3. Unauthorised profile ID → HTTP 403.
4. Unauthorised imported-file ID → HTTP 403.
5. Invalid imported-file scope type → HTTP 400.
6. Authorised file selection supplies only that file's messages to analysis.
7. Date selection supplies only messages within that date range.

Rejected requests made zero model calls. These checks establish route filtering/control flow with mocked boundaries; they do not establish deployed authentication or database isolation. Reproducible command: `node --test tests/qa-routes.test.mjs` (**7 passed**, exit 0; `/tmp/undertone-independent-qa-routes.log`).

Latest independent combined `npm test` execution: **92/92 passed**, exit 0 (`/tmp/undertone-qa-combined-tests.log`). This includes the current core suite with assembled prompt-contract coverage and the seven isolated route cases. Earlier independent typecheck passed; final typecheck/build after the latest UI fixes remain the implementation agent's responsibility.

After the profile-contract fix, independent targeted tests for malformed sibling isolation and assembled observe/merge/summary contracts passed **2/2**, exit 0 (`/tmp/undertone-qa-summary-contract-tests.log`). These are later than the 92-test combined snapshot.

After the JSON transport fix, the independent targeted fence/malformed/prose-rejection test passed **1/1**, exit 0 (`/tmp/undertone-qa-json-tests.log`).

Actual profile DELETE/report SQL was independently executed against **real migrations in in-memory SQLite**, with isolated identity/D1 adapter and no user database. `node --test tests/qa-profile-routes.test.mjs` passed **4/4**, exit 0 (`/tmp/undertone-qa-profile-route-tests.log`): owned deletion removes sources/messages/findings/jobs/batch cache/index and related single/network turns; unrelated profiles/turns and other-owner records remain; foreign/missing deletion changes nothing; report export contains only the selected owned profile's findings/source metadata and rejects foreign/missing scope. Owner-wide derived retrieval-cache invalidation is intentional. Usage/accounting records remain intact.

## UI acceptance checklist

| Function | Required check | Current execution status |
| --- | --- | --- |
| Provider selection | Select Sonnet and GPT-5.4 while idle; change selection during work; completed request retains original model. | Proxy passed; stored metadata confirmed original Sonnet despite changing selector to GPT-5.4 during work. |
| Unavailable providers | Luna unavailable remains disabled; missing-key providers labelled/disabled consistently. | Proxy confirmed Luna disabled with API-unavailable label; HKU defect reported. |
| Create profile | Required name, relationship/context, disposable profile appears and can be selected. | Proxy created named synthetic QA profile, Friend, disposable context, 0 messages; existing six profiles preserved. |
| Import controls | File preview, DMY/MDY, distinct self/other, consent required, limits match server. | Proxy passed 12-message preview/import, distinct-participant gating and consent gating; DMY/MDY control selectable. ISO sample does not demonstrate date interpretation change; parser has separate MDY tests. Valid ~640 KB preview also passed after limit fix. |
| Summary generation | Eight areas, tentative observations, coverage, evidence popup, optional behaviour toggle. | Proxy completed12/12, eight areas plus evidence status, supported/insufficient labels; optional reflection toggle on/off passed without costly regeneration. Evidence popup showed exact original speaker/date/span. |
| Pause/resume | Pause after current batches; continue reuses saved completed work. | Failed-job Continue actually resumed synthesis and retained completed reading. User-clicked Pause during an active read not exercised. |
| File/date scope | One imported file/date excludes others, invalid date order has useful error. | API isolation tests passed. Proxy uncovered/fixed date-state sync and verified visible reversed-date error. Valid narrowed-date/file UI count still pending. |
| Detailed questions | Cantonese language matching; dated episodes, clues, alternatives and original source links. | New engine offline tests passed; live output verification belongs to implementation agent/proxy. |
| Follow-ups | References to numbered examples resolve in display order; prior answers remain untrusted context. | Independent targeted test passed; proxy UI pending. |
| Message draft | Sendable text separate from notes; bad note does not discard safe message. | Offline regressions passed; implementation agent reports successful live invitation. Proxy generated copyable safe invitation for empty synthetic QA profile; edit/copy verification pending. |
| Edit/copy | Edit draft; copied text equals only edited message, excludes evidence/reasoning. | Proxy edited invitation and verified clipboard equals only edited text; original clipboard restored. |
| Draft persistence | Reload preserves current saved draft; new file/date/person/snapshot cannot show another scope's draft. | Room/snapshot state guard and persisted fallback independently inspected; proxy retest pending. |
| Network questions | All/selected people, zero-selected validation, justified options, unknown availability. | Existing offline tests passed; proxy UI/personalised network call not tested here. |
| Source search | Search exact source text; original quote and timestamps accessible. | Source inspected; proxy UI pending. |
| Finding history | History loads current person's records and lifecycle status. | Source inspected; proxy UI pending. |
| Report/trace exports | Download actual report/trace; expected scope and fields; credentials absent. | Proxy report download returned actual path. Independent actual-SQL tests passed selected-owner scope and foreign rejection; source raw/hash excluded from exported source metadata. Trace download still pending. No full live downloaded report independently inspected. |
| Guide/sample downloads | Links and help accurately describe current limits and workflows. | Source inspected; import-limit discrepancy reported; proxy pending. |
| Delete disposable profile | Delete only named synthetic QA profile; sources/results removed, unrelated profiles remain. | Independent actual-SQL deletion/isolation tests passed in memory. Proxy delete-confirmation cancel and disposable cleanup pending; no existing user profile deleted by QA. |

Passing offline checks must not be described as every function passing live UI QA. Outstanding proxy checks, real provider output compliance, and independent human semantic ratings remain explicit limitations until observed evidence is added.

## Implementation-agent verification after independent QA limit

The independent QA agent reached its service usage limit before the final network changes. The following are implementation-agent checks, not a claim of a second independent sign-off.

- Default network failures were traced to global rejection after conflicting speaker attribution across imported profiles. The default path now checks candidates independently, excludes attribution-conflicted preference sources, and preserves unrelated supported options. Six new offline/API cases cover retention, wrong-person sources, current availability, duplicate attribution, surrounding-context resolution and route integration; room separation has an additional regression.
- Live synthetic Cantonese network question returned one justified option with explicit Korean-food preference and unknown availability, using only the selected disposable profile. Live café retry across the six existing profiles returned two supported candidates (wilson B and Alex · demo), source links, an attribution-conflict warning and unknown current availability. No unrelated candidate was lost because of another profile’s conflicting import.
- HKU configured service returned a source-linked synthetic interest finding. Sonnet generated the valid Disney invitation, and a separate GPT-5.4 Cantonese interpretation test passed with a dated episode, exact server-copied quotation, contextual clues and an alternative interpretation. Unavailable Luna remains explicitly disabled.
- Live summary retry completed all12 messages with eight areas; original evidence popup, optional reflection toggle and actual report download passed. Transport-wrapper support is a compatibility fix; the earlier malformed synthesis output was not retained, so its exact format is unknown.
- Saved Disney draft reappeared after UI refresh; editing/copying produced exactly the edited message with no notes, and the original clipboard was restored. New imports clear old component draft state and snapshot matching prevents reuse as current.
- User-clicked pause during reading and a paid optional-personality refresh have not been exercised. Failed-stage Continue was exercised and preserved completed reading. No existing user profile has been deleted.

Final implementation checks: 110/110 automated tests passed, TypeScript passed, production build passed on 17 November 2026. New quote-source anchors copy immutable originals rather than asking the model to transcribe them. Repeated-observation ranking requires three distinct exchanges on two dates; the earlier saved café result predates that stricter tier guard. Valid narrowed-date/file counts, history/search controls, trace download, live pause and semantic human ratings remain unverified in this session. The named synthetic QA profile is retained for review.
