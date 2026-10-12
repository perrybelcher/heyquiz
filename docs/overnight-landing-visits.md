# Landing-visit analytics — overnight batch 4

## What changed

Public quiz landings now record an actual browser-visible observation, including embedded quizzes. The collector waits for both a nonzero viewport intersection and visible document state. It does not run on the server, prefetch, owner preview, in-progress resume screens or saved result-report pages. A resume-storage recheck at observation time protects hydration from briefly treating a saved response as a fresh landing. Starting over deliberately creates/reuses an eligible landing window.

A random UUID lives in sessionStorage per quiz, experiment context and browser tab. The client saves it before the request and shares in-flight requests. The server stores only its owner/form/context-scoped hash, server timestamps, form ID, direct/embed channel and optional experiment ID/arm. It stores no nonce, IP, contact, URL, query parameters, referrer, fingerprint or cross-tab identity. The existing start attribution remains independent and retains its existing sanitization.

The window is a fixed 30 minutes after first server observation, never extended by reloads or retakes. Expired keys rotate. The server returns remaining duration, mapped to a local client deadline so device clock skew does not reject valid tokens. A retired/expired nonce can retry once. Purpose-signed tokens bind a landing record to its quiz, owner and experiment arm. The Start API validates the record and window before retaining the optional landingVisitId. Expired, malformed, foreign, retired and missing tokens are ignored; legacy start clients continue working.

Optional instrumentation cannot block the quiz: browser Start waits at most 300ms for collection, and server validation has a 250ms deadline. Browser fetch aborts after 2 seconds. Unavailable storage uses bounded in-page memory and degrades to unlinked starts if measurement fails. The player's existing resume storage reads/removal now tolerate blocked storage as its writes already did.

## Metric contract

The new **Before the first answer** panel has its own visit-date cohort, using the server first-view date in UTC:

- Observed landing visits: actual retained first-view records in the selected date range.
- Visits that started a quiz: unique visits in that cohort with at least one correctly linked public start within the visit window.
- Visit-to-start rate: unique converted visits / observed visits. Retakes never inflate the numerator past the denominator.
- Direct/embed counts and additional starts explain the visit cohort.
- Separate start-date coverage counts linked and unlinked starts in the existing session cohort. A start just after midnight can link to yesterday's visit without moving that visit into today's denominator.

No recorded visits means **unknown**, not historical zero. The first recorded landing timestamp is explicitly a first stored observation, not the exact time instrumentation was enabled. Date periods extending before it disclose unknown earlier traffic. An observed visit without a start gives a real zero start rate; an empty measured denominator gives no rate. Existing start/completion/lead/source/answer metrics retain their definitions. There is no visit-to-completion rate in this batch.

The panel uses semantic headings, a definition list and readable empty/coverage states. The existing Leads chart legend was darkened to improve contrast. All content remains usable on narrow screens.

## Verification

- `node tests/landing-visits.cjs`: **22 passed**, pure/client/in-memory API checks; no persistent or external services. Covers historical unknowns, visit-only abandonment, repeats, preview/foreign/future exclusions, midnight cohorts, expired/context links, first observation, reload/concurrent dedupe, rotation, skew, failures/deadlines, privacy, signing, backwards-compatible starts, ownership, origin, publication pause and deletion retirement.
- `node tests/analytics.cjs`: **30 passed**, existing regression coverage.
- `npx tsc --noEmit`: passed, including the final visibility callback guard.
- Focused ESLint: no errors; four existing QuizPlayer warnings (unused type, existing progress hook dependencies, two img elements).
- `tests/browser-landing-visits.cjs`: **passed on compiled batch-4 localhost:3163**. Exercises actual visible landing/reload/retake, signed start payload, resume/preview/private-report exclusions, offscreen-to-visible iframe, hidden-to-visible document, blocked storage/network and slow measurement, privacy, date filtering and mobile report width. Log: `../pippi-overnight-2026-10-12/compiled-verification-batch-4/browser-landing-visits.log`. Desktop and mobile screenshots were inspected: readable, responsive and without horizontal page overflow.

Run the browser suite only against the rebuilt isolated server:

```
TEST_BASE_URL=http://127.0.0.1:3163 HEYQUIZ_DATA_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/test-data node tests/browser-landing-visits.cjs
```

It creates unique synthetic fixtures, starts an ephemeral localhost embed host, cleans its own rows, and writes screenshots to `../pippi-overnight-2026-10-12/landing-visits/`. It needs headless Chrome launch permission. Coordinate with other browser suites because the existing Start limiter is shared by localhost IP.

## Limits and next work

This is best-effort browser observation, not unique people or bot-proof traffic. Browser duplication can copy sessionStorage; blocked/cleared storage or separate tabs can overcount. Hidden/offscreen pages become measurable only when visible; a continuously idle page is not polled every 30 minutes. A new real Start can open the next bounded window. A slow/failing measurement may remain an unlinked start even if a late visit subsequently arrives. Server deadlines stop waiting, but the underlying read adapter has no cancellation interface.

No raw visitor identity, external analytics provider, CRM, email or Stripe integration was added. No existing analytics history was reconstructed. No cloud migration is required: this uses the existing records adapter and a new `landing_visits` kind. Data has the same retained-record lifecycle as existing attempt analytics; this batch does not introduce a retention/deletion scheduler. Saved result report interactions remain untracked. Production behavior and additional browser visibility semantics still require verification beyond the local Chrome pass; synthetic checks are not a claim that every browser or traffic pattern is covered.
