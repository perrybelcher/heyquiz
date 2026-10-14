# Tester audit repairs — 14 October 2026

Source: Perry's Pippi Audit (with reproduction steps), functional review dated 13 October. Existing tester/customer quizzes were not edited. Verification uses synthetic local fixtures, mocked provider output, and the compiled application.

| ID | Repair | Evidence / limit |
| --- | --- | --- |
| F01 | Export blanks inapplicable raw score and point columns; shared reporting helper also treats zero-possible scores as ungraded. | Unit assertions and actual browser CSV download with synthetic recommendation. |
| F02 | CSV outcome uses frozen marketing recommendation; score-tier distribution hidden for marketing quizzes. | Browser report and download checks. |
| F03 | Generation instructs the model to challenge overlapping/partly true distractors; duplicate normalized choices rejected. Knowledge publish dialog requires explicit answer-key review. | Mocked AI valid/duplicate output and browser checkbox gating. Semantic correctness cannot be guaranteed; expert review remains necessary. |
| F04 | Conversation map says separate contact step is off and explicitly notes that quiz questions may collect contact data. | Browser map copy check. |
| F05 | Browser-only draft checks authentication state separately from whether the draft has been claimed. Signed-in copy asks for first account save; unknown state uses neutral wording. | Local authenticated blank builder; no account identifiers returned by new private/no-store auth GET. |
| F06 | Preview completion says no response recorded, rather than claiming saved answers. | Complete preview through phone/NPS/image flow. |
| F07 | Recovery eligibility compares initial backup with initial server form, not only the changing saved fingerprint. Matching backups cannot become stale candidates after a later save. Banner describes a different device draft with title, question count and base revision. | Browser matching-backup/current-save regression. Original intermittent tester sequence not independently reproduced; this closes a code-confirmed trigger, not a claim of lost-data repair. |
| F09 | Shared client/server answer validator accepts 7–15 digits and optional leading +, spaces, parentheses, dots or hyphens; rejects letters. | Unit formats and browser invalid-to-valid flow. Extensions/vanity numbers not supported. |
| F10 | New and existing parsed NPS fields normalize to fixed 0–10. Player and editor display all eleven choices. | Legacy schema + zero/range unit checks and browser zero selection. Other rating types retain custom ranges. |
| F11 | Image-only fields reject unsupported MIME types before network upload; shared answer validation rejects non-image metadata before advancing. Existing server stored-upload checks remain. | Browser text rejection with zero upload calls, then valid PNG success. No claim of new binary-content malware validation. |
| F12 | Publish dialog fetches nonsecret configured status, blocks while checking/missing/unavailable, shows actionable CAPTCHA setup message. | Browser missing/ready states; existing publish API rejects missing setup with 422. No security setting disabled. |
| F13 | Schema import resets active page to an imported page, clears stale question selection and opens page view. | Browser replacement-page import immediately shows imported question. |

## Verification
- Production build and TypeScript passed.
- 25 general regression checks passed.
- 19 publish-readiness unit/component checks passed.
- Audit-specific validation/reporting and mocked AI checks passed.
- Full synthetic browser suite covers signup copy, CAPTCHA readiness, answer review, import, recovery false warning, conversation copy, CSV/result chart, phone/NPS/image/preview flow.
- Targeted ESLint: no errors; existing warnings remain.

No real emails, CRM leads, AI requests, or customer submissions were sent during these checks. Production delivery/authentication/provider configuration is outside this repair pass. Deployment evidence will be recorded separately when verified.
