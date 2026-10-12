# Manual journey cases — independent QA

12 October 2026, batch 16. This lane owns only `tests/manual-journey-independent.cjs` and this note. No application, schema, routing, scoring, provider or server changes were made by this reviewer. Installed Next client-boundary guidance and the full manual-journey plan, including its migration guards, were read.

## Current evidence

`node tests/manual-journey-independent.cjs` passes **19 groups with 63 literal evaluator comparisons** on the active source. The comparison count includes rerunning the same explicit expectations through the evaluator, reviewed helper and saved fixture; it is not 63 distinct browser journeys or exhaustive input coverage. `node --check tests/manual-journey-independent.cjs` and scoped ESLint pass.

Expected status, tier ID, score/null, visible question IDs, category scores and coverage, and ordered result sections are written as test literals. They are not derived from the new helper's expected-result output. Existing engine behavior is also checked directly before exercising the new helper.

| Area | Independent assertions |
| --- | --- |
| Numbers | Strict branch threshold below/at/above 10; inclusive min/max; numeric bounds reject out-of-range values; rendered step increments do not silently become evaluator restrictions. Exact keyed `1` scores differently from `1.0`, `01` and `1e0`; valid lexemes survive review/save/rerun unchanged. |
| Short text | Case and outer-whitespace normalization for grading and equals/contains/not-equals routing; blank is unanswered. Unicode and intentional spaces survive; controls, bidi controls, unpaired surrogates, non-string values and overlong text reject. |
| Routing and scores | First matching jump wins; hide beats show; early ending skips a required contact field. Skipped supplied answers are excluded from the saved path without mutating the composer's original inputs. Unknown category values, mapped zero, unanswered/applicable coverage, minimum answers and withheld overall score stay distinct. Paired category changes fail even when the overall score remains 50. Conditional section order is asserted. |
| Provenance | Both maps are checked, including supplied values on skipped fields. Wrong question types, missing/ambiguous IDs, removed options, duplicate selections, map overlap, unsupported fields and reserved keys reject. Saved v2 cases do not reinterpret finite option IDs as short text or omit typed values. Renaming a label with its ID unchanged is stale editorial data, not a behavioral failure. |
| Review | Prepare/cancel is inert; changed draft, input, raw name, raw library, foreign quiz, expected values and saved typed values prevent confirmation. Confirmation recomputes actual behavior; replay against newer raw bytes rejects. |
| Legacy and transfer | Noncanonical legacy metadata, unknown fields and duplicate answer arrays remain readable without rewriting. Strict promotion/append fails with retained data. v1 rejects reserved manual markers. Mixed v2 preserves narrower legacy expectations; imports preserve deliberately incorrect historical scores/section order rather than rescoring them. Same-ID conflicts and tampered/stale imports reject. |
| Bounds | One combined 25-case cap; exactly 128 KiB UTF-8 transfer input, multibyte overflows and invalid UTF-8; 500,000 JavaScript-character local boundary. These are deliberately different limits. |

Evaluation has throwing guards for `fetch`, browser local/session storage access, network modules and known server/storage/provider module imports. The complete passing run records **zero guarded accesses**. The client-safe result-email-copy schema helper is allowed; it is distinct from the server email transport. No records, attempts, real email, cloud services or credentials are involved.

## Findings from independent review

1. **Fixed and independently retested:** an own enumerable `__proto__` answer-map key was silently dropped during Zod record parsing, so a supplied invalid input could be accepted. The first run failed this explicit assertion. The model owner added raw-key checks before parsing. The final suite covers both input maps, strict local v2 parsing, transfer imports and current-library validation, while keeping historically accepted v1 bytes readable. No field-stripping migration was introduced.
2. **UI correction source-reviewed, compiled verification pending:** typed-export acknowledgement remained true after another tab changed the saved library, while export reread the latest bytes. That could apply an acknowledgement made for case A to new typed case B. The UI owner now binds acknowledgement to the displayed raw library/import file, clears it on Reload and rejects export when current raw bytes differ or a storage change was observed. The prepared browser test covers a same-tab change followed by Reload and fresh acknowledgement. This note does not claim that browser behavior has passed yet.

Original failing assertion, retained here after the source fix:

```text
FAIL both maps reject unsupported provenance even when an input would be skipped
AssertionError [ERR_ASSERTION]: Missing expected exception: Reject own reserved typed key __proto__
```

Final source run:

```text
19 independent manual journey groups passed; 63 literal evaluator comparisons; no network/storage/provider access.
```

## Limits and remaining acceptance

The helper test exercises raw-baseline rejection using supplied immutable strings. It does not simulate native browser storage events, quota failures, file pickers, focus, Escape priority or actual `setItem` behavior. The UI owner's compiled tests and root's release pass must cover those paths, including late focus, changed-library acknowledgement and same-tab/reloaded reviews.

An already-open older application tab can still overwrite the shared key with its cached v1 list. New-code guards do not constrain that old writer, and a local read/check/write is not cross-tab compare-and-swap. Refresh/close-old-tabs guidance remains necessary. Local saved text and exported JSON are plaintext; these checks do not prove entered text is anonymous or safe customer data.

Root separately owns `tests/manual-journey-compiled.cjs` and respondent API parity evidence. Its accepted-batch-15 baseline is separate from this source-only helper proof; the new compiled build must be checked again before claiming completed acceptance. No production verification, real human usability result or exhaustive number/text-domain coverage is claimed here.
