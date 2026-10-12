# Journey case portability — batch 13

## Behavior

Conversation map → Journey testing → Your regression cases now offers **Export cases** and **Import cases**. Export contains only the saved synthetic cases and an explicit version/format/quiz ID. It reads no respondent, contact, result-link, provider or server records. Case names and option IDs are included; the UI asks users to use synthetic choices, never respondent data.

Import uses an explicit review before adding anything. Review names each case, preserves the file’s expected status/score/result and legacy missing category/section assertions, and labels a differing draft baseline. The file is not scored, approved or used to replace expected values. Existing finite journey checks remain the separate action for assessing current behavior.

Exact duplicates are skipped using canonical object-key comparison. A same-ID case with different content rejects the entire import. The reviewed append is validated as a whole before one storage write, never replaces the current list, and cannot exceed the existing 25-case combined limit. Empty or all-duplicate files cannot clear a library. Cancel/Escape leaves storage unchanged; Escape dismisses the review before the parent dialog, with focus returned to Import cases.

## Boundaries and safety

- New `lib/journey-fixture-transfer.ts` has a strict nested allowlist and a **128 KiB actual UTF-8 byte limit**. File size is checked before reading; malformed UTF-8 is rejected by fatal decoding. Strict metadata, valid canonical ISO timestamps, finite scores/counts, safe identifiers, unique arrays and explicit supported fields are required. Arbitrary form/contact objects and unknown properties are rejected.
- The transfer format is intentionally narrower than the existing local serializer’s 500,000-character storage budget. An oversized existing library remains intact and usable locally; export reports that it needs a smaller file. This work does not reduce the existing browser storage limit.
- Import also validates every current case with the strict case schema, independently of the file byte limit. Malformed or unknown fields in a locally stored case reject the append and preserve the original library; valid local libraries above 128 KiB may still accept a small import within the 25-case and 500,000-character local limits. Legacy missing category/section fields remain valid.
- Older expected `categories`/`resultSectionIds` omissions remain absent, distinct from empty arrays. Category null scores remain distinct from zero; coverage counts and section order remain literal.
- Confirmation rechecks current draft, exact raw localStorage value, current case library and reviewed file content. A storage event marks another tab’s change visibly stale. A detected change or tampered review is rejected before writing. A single `setItem` replaces its value all-or-nothing; failed/quota writes preserve both the previous library and the review for retry.
- The localStorage comparison detects changes observed before the write; it is not a cross-tab transaction or compare-and-swap primitive. There remains a narrow concurrent-write window between the comparison and `setItem`, consistent with the existing local-only storage model.
- Confirmation reparses compact JSON so pretty-printing cannot inflate an already accepted file beyond the byte budget. Export uses readable indentation and independently checks its resulting size.
- Async file reads are invalidated when the dialog closes or the quiz changes. Import/export has no backend endpoint and generates no respondent attempt, email, queue or private capability.
- The import review takes keyboard focus and measures the sticky dialog header before positioning the heading. Native Firefox focus scrolling initially covered the heading at 390px; the narrow correction uses the actual header height and clamps to the dialog's scroll range, without changing any case data.

Owned files: the new helper, narrow `components/ConversationMap.tsx` additions, `tests/journey-fixture-transfer.cjs`, `tests/browser-journey-transfer.cjs`, and this document. Existing `journey-fixtures.ts` and its expanded-check semantics remain unchanged. Installed Next client/server guidance was read before edits.

## Verification

- TypeScript: passed.
- Scoped ESLint: zero errors or warnings.
- Twelve new pure transfer groups passed: real multibyte byte limits, invalid UTF-8, strict metadata/current-library validation, foreign quiz, combined cap, exact duplicate/conflict handling, stale/tampered review, null/zero/order distinctions, accepted compact files near the byte limit, valid larger local libraries with small imports, and no current-score substitution.
- All 13 existing expanded-fixture groups passed unchanged.
- Final compiled browser coverage passed in Chromium, Firefox and WebKit: actual download into a fresh context, literal legacy expectations, review/cancel/Escape/focus, read failure and quota retry with null/nonempty libraries, malformed current-library preservation, duplicate/conflict/foreign/malformed/oversize/cap rejection, actual cross-tab stale review, and reload. All three runs assert zero API mutations or respondent starts.
- The first compiled functional suite passed in Chromium, Firefox and WebKit, with nine targeted 320px/390px/1440px accessibility scans reporting no violations. The existing expanded-fixture browser regression also passed. A stronger fresh-focus geometry check then reproduced the Firefox sticky-header issue described above; that failure is preserved in `firefox-focus.log` and its screenshot folder. Chrome's first immediate focus assertion and WebKit's immediate cancel/re-import sequence were test timing issues, corrected with bounded waits for the actual scheduled focus return.
- The measured focus correction passed the final build in all three engines. Fresh import headings clear the sticky header at 320px, 390px and 1440px before any explicit test scrolling; Cancel and Import remain visible when keyboard-focused. Nine final review-panel accessibility scans reported zero WCAG A/AA violations. Screenshots were visually reviewed, including Firefox390's formerly obscured heading. The existing expanded-fixture browser suite passed again on the final build with no API mutations.
- Final evidence: `chromium-final.log`, `firefox-final.log`, `webkit-final.log`, `expanded-browser-final.log`, per-engine `*-final/` screenshots and `accessibility.json`; pure/type/lint evidence is in `unit-final.log`, `expanded-regression-final.log`, `typecheck-focus-fix.log`, and `lint-focus-fix.log`. All reside in `compiled-verification-batch-13/journey-transfer/` beneath the overnight output directory. Initial failures are retained. No deployment was performed.
