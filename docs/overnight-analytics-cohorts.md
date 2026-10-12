# Session cohort filters — batch 7

Implemented locally on 12 October 2026. Application source is frozen. The parent's combined batch-7 build and the compiled cohort browser suite passed; this document does not claim production deployment or live-data testing.

## Delivered behavior

Results now offers three independently clearable cohort controls: **Source**, **Campaign**, and **Published version**, alongside the existing 7/30/90-day/all-time selector. **Clear cohort filters** restores all sources, campaigns and versions while preserving the date range. The accessible names are `Filter by source`, `Filter by campaign`, `Filter by published version`, and `Clear cohort filters`.

Source identity distinguishes an explicit UTM source from a referring hostname. Campaign identity is the exact sanitized UTM campaign label, with case preserved. A publication is identified only by the canonical UTC `publishedAt` saved inside a retained attempt's frozen form. Draft revision numbers and today's published form are never substituted for missing historical publication metadata. An unknown selection remains available even before such sessions exist. Options describe all retained, nonpreview, nonfuture starts for this quiz, independently of the currently selected date range, so changing a date does not silently remove a selection.

All session counts, leads/consent, completion and click rates, median time, tracking coverage, quiet sessions, date trends, result segments, source/campaign aggregates, answer distributions, question performance and question CSV use the same selected start cohort. The preceding equal-length calendar period uses the identical source/campaign/version predicate. Later completions remain assigned to their original start cohort, and today remains a partial day. Empty denominators remain unavailable rather than becoming fabricated zero percentages. The existing all-time trend is still limited to the latest 90 days while headline totals cover all retained history.

Question performance now separates the reached wordings of a renamed question rather than relabeling old sessions with the current title. Earlier wording is labeled, and the export uses that same wording and aggregate count. Supported finite-choice answer distributions continue to use their more detailed frozen question/option signatures. Current questions without any reach remain at zero; historical answer snapshots are still bounded to the existing top 60 with an explicit omission count.

Landing visits have no source, campaign or publication dimensions. Their panel is therefore hidden whenever any cohort filter is active, with a visible explanation and a route back via Clear cohort filters. The API retains the existing landing summary, explicitly marks it as `unfiltered`, and never constructs a rate using filtered starts divided by unfiltered visits. Responses without any retained attempt cannot be assigned to a cohort. Their count is explicitly date-only/unassignable, shown separately in measurement notes, and never enters a filtered funnel. Stored preview responses are excluded from this unlinked count as well as from session reporting.

Request state is keyed to the quiz, exact query, refresh count and external refresh key. Old requests are aborted and cannot populate a newer report. Changing any selection immediately hides the previous metrics and disables export; a failed request leaves export disabled until a successful retry. Existing source/campaign tab and answer-snapshot preferences survive temporary loading states. CSV includes only question aggregates, date range and the selected cohort labels, with spreadsheet-formula escaping.

## Query and identity contract

`GET /api/forms/:id/analytics?range=7&source=utm%3Anewsletter&campaign=value%3AAutumn&version=published%3A2026-10-01T08%3A30%3A00.000Z`

- `range`: exactly `7`, `30`, `90` or `all`; omitted defaults to `30`.
- An omitted or empty cohort parameter means all values for that dimension.
- `source`: `utm:<sanitized source>`, `ref:<sanitized hostname>` or `unknown`.
- `campaign`: `value:<sanitized campaign>` or `unknown`.
- `version`: `published:<canonical ISO UTC timestamp>` or `unknown`.
- Literal source labels `all` or `unknown` are `utm:all` and `utm:unknown`, and a campaign named `unknown` is `value:unknown`. These never alias the all/unknown selections.
- Duplicate, unsupported, invalid and oversized query values return 400 before record scans. Valid exact values with no retained matches return an empty cohort, never an unfiltered fallback.
- Authentication and quiz ownership are checked first. Attempts, submissions and landing visits are read with that owner ID; responses remain `Cache-Control: private, no-store`.
- `cohort.filters`, `cohort.labels`, `cohort.active`, `cohort.options`, `cohort.optionsScope: all-retained-starts`, `cohort.landingScope: unfiltered`, and `cohort.unlinkedSubmissionsScope: date-only-unassignable` accompany the summary.

## Owned files

- `lib/analytics-filters.ts` — client-safe typed identities, validation, matching/options, query serialization and CSV formatting.
- `lib/analytics.ts` — cohort selection/comparison, snapshot wording, explicit scope metadata and reserved campaign-label separation.
- `app/api/forms/[id]/analytics/route.ts` — strict query parsing and 400 handling.
- `components/ResultsChart.tsx` — cohort controls, precise loading/error/export state and scope explanations.
- `tests/analytics-cohorts.cjs`, `tests/analytics-cohorts-api.cjs`, `tests/browser-analytics-cohorts.cjs` — targeted synthetic checks.

No tracking, player, storage, schema, published-quiz or contact data path was modified. No migrations, provider requests, real emails, cloud writes or deployment actions were performed.

## Verification

Passed before the combined build:

- Existing analytics regression: 30 checks.
- New cohort unit regression: 11 groups covering reserved literal labels, Unicode query round-trips, invalid/duplicate queries, metric reconciliation, partition sums, same-filter previous period, unknown publication, empty rates, preview/foreign/future exclusions, unassignable response scope, historical question/CSV wording and literal `Unknown campaign` versus absent campaign.
- New route/mock regression: 4 groups covering exact query forwarding, private no-store responses, owner-scoped record reads, rejection before scans, foreign-owner denial, anonymous denial and no network calls.
- Scoped ESLint: clean. Full `tsc --noEmit --incremental false`: passed.
- Parent independently reported general 25, hand-calculated scoring/analytics 7, and landing 22 regressions passing against the combined source.

Logs: `../pippi-overnight-2026-10-12/compiled-verification-batch-7/analytics/{existing-unit,cohorts-unit,cohorts-api}.log`.

Compiled-browser suite passed on the parent's isolated `http://127.0.0.1:3163` batch-7 build: `tests/browser-analytics-cohorts.cjs`. It refuses a non-local target, a missing isolated data directory, or cloud-enabled record storage. It seeds only synthetic owned records with two publication timestamps, two primary sources/campaigns, literal reserved labels, unknown history, a preview and foreign-owner/foreign-quiz rows. It uses real authenticated APIs and UI, then delays a real response to resolve after a newer filter, checks exports after failure/retry, verifies historical CSV contents, impossible combination/reset, keyboard order, desktop/mobile widths and screenshots. No public quiz starts are needed. Default cleanup removes only its own test records; `KEEP_ANALYTICS_FIXTURE=1` retains the printed fixture ID for the parent's independent accessibility review.

Final compiled log after accessibility fixes: `../pippi-overnight-2026-10-12/compiled-verification-batch-7/analytics/browser-cohorts-final.log`; the earlier successful run remains in `browser-cohorts-before-table-a11y.log`. An initial sandbox Chrome launch was blocked before the browser opened; that diagnostic is preserved as `browser-cohorts-sandbox-launch.log`. The authorized local-only run outside that launch restriction passed without application/test fixes. The synthetic fixture was cleaned. Desktop and mobile screenshots under `../pippi-overnight-2026-10-12/analytics-cohorts/` were visually inspected: cards, labels and controls remain legible, the active source is clear, and the 390px layout has no page-level horizontal overflow. The parent's separate populated accessibility scan exposed two tables that scrolled without being keyboard-focusable. Both now have named, focusable regions and visible focus outlines: `Question performance table` and `Answer distribution table`. The final compiled rerun verified each one at a 320px viewport with a genuinely overflowing fixture: keyboard focus succeeds, ArrowRight produces horizontal movement, `:focus-visible` is active and the computed outline is at least 2px. `analytics-table-keyboard-320.png` captures the focused table. The parent owns the separate final automated accessibility and 200% reflow pass and CSS contrast fixes.

Final bounded compatibility verification also passed sequentially against the parent's final compiled batch-7 server: `tests/browser-answer-attribution.cjs` and `tests/browser-landing-visits.cjs`. Logs are `analytics/legacy-answer-attribution.log` and `analytics/legacy-landing-visits.log` in the compiled-verification directory. These existing suites checked historical wording/options, branching and deduped multi-select, source sanitization and real browser collection, preview/privacy/owner boundaries, visible landing/reload/retake linking, resumed/preview/private-report exclusions, offscreen-to-visible embeds, blocked storage/network/slow measurement, dates and mobile reporting. No application or test fixes were needed in these runs.

## Practical limits

This remains an in-memory owner-scoped aggregate over the existing record adapter. It does not add database-side indexes or pagination, and filter choices include all unique retained identities. Very large histories or very high-cardinality campaign sets will still need a separately designed backend query/index strategy; UI filtering alone is not presented as that work. The existing source/campaign tables combine groups beyond 20 with disclosed counts. The existing answer-pattern table bounds remain unchanged. Missing, sanitized-away or deleted historical attribution/publication information cannot be reconstructed. UTM labels and referring hostnames are browser-provided signals, not independently verified advertising attribution. This pass does not add campaign dimensions to landing records, cross-device identity, ad-spend imports, or new result-link tracking.
