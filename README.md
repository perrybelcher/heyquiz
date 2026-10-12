# Pippi

Pippi is a quiz and assessment builder for product recommendations, audience segmentation, and category scorecards. Creators can start blank, use a template, or work through the guided builder; the full editor remains available. Accounts are free. CRM rollout and Stripe are deferred priorities, not release requirements for this increment.

This repository retains some historical `heyquiz` names in paths, cookies, and configuration. The product name is Pippi. The package name is currently `quizcraft`; neither historical name implies a separate application.

## Run a personal local workspace

Use Node.js 22+ and npm, with the committed lockfile:

```sh
npm ci
npm run setup:local
npm run dev -- --hostname 127.0.0.1 --port 3130
```

Open [the local workspace](http://127.0.0.1:3130/login) and select **Open local workspace**. Setup creates `.env.local` with local mode and a random signing secret, preserving any existing file. Use the placeholder-only `.env.example` as a configuration reference, not as a ready-to-run secret. Review an existing configuration before running: local mode does not override configured cloud storage. Keep this mode on loopback; it is not public authentication and is disabled on Vercel.

Local records and uploaded bytes use `.heyquiz-data/`, or an explicit `HEYQUIZ_DATA_DIR`. Back up the complete runtime directory and protect the signing configuration separately. Keep a stable `SESSION_SECRET` to preserve existing signed links; replacing it invalidates capabilities. Neither records nor secrets belong in source control or a release archive.

On first local workspace access, the app can import legacy `data/forms.json` and `data/submissions.json` when those optional files exist. Otherwise it uses built-in starter forms. Those legacy files are runtime data, not required release inputs. Import preserves the originals; it is not a cloud migration. A clean release candidate excludes `data/` entirely.

## Creating and sharing a quiz

1. Start blank or choose from 43 templates. All 43 now include expanded original landing/result campaigns, verified in the separately documented batches through batch 14. Customize all example copy before using it for your own offer.
2. Edit questions, answer points, branching, theme, lead capture, results and optional landing sections. Guided editing and the full editor use the same saved form. The compact Setup checklist links known issues to their exact fields and separates required fixes from optional recommendations; full scoring diagnostics run in Review & publish. The theme has reusable visual brand kits.
3. Drafts autosave with revision checks. Failed saves and conflicting edits remain visible; local recovery checkpoints support restoration. AI question changes are reviewed as proposals before acceptance. Guests can build locally but need an account to save to a workspace. After a confirmed save, choosing Stay in the browser warning retains newer edits and continues revision-checked saves; Save & open quiz waits for current edits before opening the workspace.
4. Preview saves the current draft first and does not count as a public response. Use the journey simulator and saved expectations to check routing, result selection, scores, coverage and conditional result sections before publishing. Optional manual cases add specific synthetic numbers and short answers to the existing choice inputs, with an explicit result review before saving. The shared library holds up to 25 cases. Cases can be exported and reviewed for import into the same quiz in another browser; typed values are included without redaction. These are browser-local regression baselines, not account synchronization, exhaustive coverage, or proof that a recommendation is correct.
5. Publish creates the respondent-facing snapshot. Its verified server receipt distinguishes up-to-date publication from later unpublished draft changes. An unverifiable successful confirmation preserves edits and asks you to refresh before publishing again. Pause stops new public starts; existing attempts and saved results retain their documented behavior.
6. Guided Embed & Share opens the existing sharing tools and returns to guided Publish without replacing your draft. Share a direct link, responsive inline embed, script-free fixed-height iframe, or explicit click-to-open popup. Popup scripts load no quiz iframe before activation; a real direct link remains the fallback. The embedded quiz uses its own theme, not the host site's CSS.

The player supports required validation, branching, review before submission, same-browser recovery, timed attempts and configured feedback. Question and answer types have different scoring semantics; marketing scores and category coverage are computed on the server and retained with the response. Unknown/insufficient category information does not silently become zero.

## Results and follow-up

- **Analytics:** visitor/start/completion/result/CTA measurements with explicit denominators, historical question/answer views, previous-period comparisons and CSV. Exact source, campaign and published-version filters apply to retained attempt snapshots. Landing visits have no such dimensions, so they are not blended into filtered funnel rates. Missing historical information stays unknown.
- **Contacts:** retained responses, capture/consent, recorded activity, supported cohorts and an exact historical discrete-answer condition. Matching exports use the same filters. Owners can save up to 20 named filter definitions per quiz, then apply, update, rename or delete them with revision checks. Free-text search and contact membership are never saved in a definition. Pagination alone does not mean the storage query is bounded.
- **Saved results:** optional private bearer links contain frozen result/theme snapshots with original 30-day expiry. They exclude raw answers and contact fields. Anyone holding an active link can view it. Owners can revoke individual links and clean up to 25 expired copies without deleting quiz responses or durable revocation receipts.
- **PDF:** saved results support browser printing and a native server PDF download using bundled licensed fonts. Native PDFs preserve result values and selected sections; unsupported scripts or oversized reports have a browser-print fallback. Already downloaded copies cannot be recalled by revoking a link.
- **Experiments:** reviewed plans and publication-aware variants are supported. An optional Plan a test action in Results attaches an owner-verified observation for the exact published step and selected cohort. The reviewed counts stay fixed when traffic changes; refreshing requires a new review. Manual setup remains available. Quiet sessions are a signal to investigate, not a causal explanation, statistical significance or a promise of conversion uplift.
- **Result email:** editable subject/introduction/sign-off and a safe preview are available in Results/Ending settings. Explicitly enabled local synthetic requests freeze encrypted copy from the completed quiz version; they prepare local artifacts and send no mail. Production result sending remains unavailable. This is separate from Supabase account confirmation and recovery emails.

Detailed behavior and limitations are recorded in [the overnight progress log](docs/overnight-progress-2026-10-12.md), [analytics cohorts](docs/overnight-analytics-cohorts.md), [contact answer filtering](docs/overnight-contact-answer-filter.md), [saved filters](docs/overnight-saved-segments.md), [saved-result management](docs/overnight-report-management.md), [native PDF](docs/overnight-native-pdf.md), [popup embeds](docs/overnight-popup-embeds.md), and [synthetic result email](docs/overnight-result-email.md).

## Architecture and configuration

The app uses Next.js App Router, React and TypeScript. `app/` contains pages and server API routes; `components/` holds builder/player/report UI; `lib/` contains schemas, scoring, ownership, storage adapters and report logic; `hooks/` contains client behavior. The generic records adapter uses local files or the configured Supabase records table. Server routes enforce ownership; public attempts and saved reports use purpose-specific capabilities. It is not a browser-to-database client architecture.

| Configuration | Purpose |
| --- | --- |
| `SESSION_SECRET` | Server-only signing secret, at least 32 characters. Keep stable across release/rollback. |
| `HEYQUIZ_LOCAL_MODE` | Set to `1` only for a personal loopback workspace; use `0` for hosted accounts. |
| `HEYQUIZ_DATA_DIR` | Local runtime records/uploads directory. Use a separate synthetic directory for QA. |
| `SUPABASE_URL` | Project URL used by server auth/storage requests. |
| `SUPABASE_PUBLISHABLE_KEY` or legacy `SUPABASE_ANON_KEY` | Account-auth API key; the app prefers the publishable-key name when both are configured. |
| `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-only records/storage key. Never use a `NEXT_PUBLIC_` prefix for it. |
| `APP_URL` | Configured account-callback origin. The code also recognizes its existing explicit production-origin allowlist. Review both when changing domains. |
| `GEMINI_API_KEY`, optional `GEMINI_MODEL` | Optional server-side AI generation. Current code default: `gemini-3.5-flash-lite`; provider availability is not established by local tests. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional CAPTCHA configuration for the actual public hostname. Publishing a CAPTCHA field requires both. |

Only enable provider configuration when intending to use that provider. AI requests send the selected brief/prompt to Google; missing keys produce an unavailable state rather than a fabricated generated quiz. Both the general generator and marketing generator are implemented. Local mocks are not evidence of live provider success.

The native PDF route requires a Node runtime and `assets/pdf-fonts/`, including both fonts, license and provenance. Preserve the narrow font tracing include and runtime-data/environment/docs/test tracing exclusions in `next.config.ts`. PDFKit and fontkit are pinned production dependencies; no production browser renderer or remote image fetch is used.

## Hosted accounts and release setup

The app implements email/password sign-in, signup, resend confirmation, forgot-password, email callback and password reset. Signup/reset passwords require 12–128 characters. Confirmation/recovery uses a browser-bound PKCE flow: open the email link in the browser that requested it. Workspace access sessions currently expire and require signing in again; this code does not implement automatic refresh-token renewal or invitation/team roles.

For an authorized deployment:

1. Review `database/supabase.sql` against the intended project. It defines the generic records table and private media bucket; direct table access is restricted and privileged server routes enforce ownership. Do not blindly rerun setup over an existing database.
2. Configure the server variables above and disable local mode. Configure Supabase account registration, the exact allowed callback URL ending in `/auth/callback`, and a working account-email sender. App route availability alone does not establish that email reaches an inbox.
3. Build with `npm run build`, then use `npm start` behind HTTPS or the reviewed hosting adapter. Serverless hosting must use durable cloud storage, not the local filesystem. Do not upload local records, secrets or synthetic test flags.
4. Verify signup/confirmation/recovery, owner isolation, save/publish/pause, uploads, public completion and report revocation in the actual target environment before inviting testers. Preserve a rollback reference and signing settings.

The overnight work is verified in separately documented batches using isolated synthetic local data. They did not deploy code, verify live inbox delivery, authorize CRM providers, enable Stripe, or establish production/cloud readiness. Existing integration code and its [operations notes](docs/integrations.md) remain in the source; provider availability varies and rollout is deferred. See [release staging](docs/overnight-release-staging-plan.md) and [release validation](docs/overnight-release-validation.md) for the clean-candidate procedure. Recovery archives are not automatically safe release inputs, and a clean candidate tip does not clean old Git history.

## Verification

The basic source checks are:

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`npm test` runs only `tests/regression.cjs` (25 checks at the batch-10 checkpoint). It is not the full acceptance suite. Feature docs name additional unit/API/browser tests and record the exact build against which they passed. Useful focused groups include:

| Area | Source/mock checks | Compiled local browser checks |
| --- | --- | --- |
| Drafts and guided editing | `draft-history.cjs`, `guided-editing.cjs`, `publish-readiness.cjs`, `guided-checklist.cjs` | `browser-draft-safety.cjs`, `browser-guided-creation.cjs`, `browser-publish-readiness.cjs`, `browser-guided-checklist.cjs` |
| Historical analytics and contacts | `analytics-cohorts.cjs`, `analytics-cohorts-api.cjs`, `contact-answer-cohort.cjs`, `contact-answer-api.cjs` | `browser-analytics-cohorts.cjs`, `browser-contact-answers.cjs` |
| Saved contact filters | `contact-segments.cjs`, `contact-segments-compiled.cjs` (isolated HTTP) | `browser-contact-segments.cjs` |
| Saved reports and PDF | `report-management.cjs`, `result-reports.cjs`, `result-pdf-model.cjs`, `result-pdf-api.cjs`, `result-pdf-renderer.cjs`, `result-pdf-packaging.cjs` | `browser-report-management.cjs`, `browser-native-result-pdf.cjs` |
| Complete local creator/response rehearsal | Literal expectations and exact record/API/CSV reconciliation | `browser-creator-reconciliation.cjs` (two UI-created quizzes, Chrome; see batch19 quality) |
| Publication and guided sharing | `publication-receipt.cjs`, `publication-pause.cjs`, `guided-publication-compiled.cjs` (isolated HTTP) | `browser-guided-publication.cjs`, `browser-publication-pause.cjs` |
| Embeds | `embed.cjs`, `popup-embed.cjs` | `browser-responsive-embed.cjs`, `browser-popup-embed.cjs` |
| Original campaigns | `template-campaigns.cjs`, `template-campaigns-batch8.cjs`, `template-campaigns-batch9.cjs`, `template-campaigns-batch10.cjs`, `template-campaigns-batch11.cjs`, `template-campaigns-batch13.cjs`, `template-campaigns-batch14.cjs`, `template-catalog.cjs` | Corresponding `browser-template-campaigns*.cjs` suites |

All names above are under `tests/`. Read each suite's guards and dependencies before running it. Compiled browser tests need a separately started local server, installed Playwright browser engines, explicit `TEST_BASE_URL` and an isolated `HEYQUIZ_DATA_DIR`. Server and test processes must agree on those settings. Set all five supported Supabase URL/key variables to empty values for isolated QA; do not assume removing one service-key alias disables cloud mode, or that unsetting shell variables overrides a local environment file. Some PDF checks also use Python PDF tooling and Poppler as described in their feature docs. Serialize suites when sharing per-process public-start/PDF request limits.

Do not run `live-*` scripts or legacy defaults blindly against an existing service. Historical `scripts/test-*` and `scripts/qc-*` are not the current acceptance checklist. Keep logs, browser state, screenshots, generated PDFs and test data outside the release candidate; clean only fixtures created by the test. Representative three-engine flows and automated accessibility checks are valuable evidence, not exhaustive device/assistive-technology coverage or a security certification.

## Known boundaries

- The preserved schema has 51 field types. A meeting preference does not reserve a calendar slot; a typed signature is not an e-signature service. Uploads are one file per answer, at most 10 MB or a lower configured limit; microphone recording needs browser permission.
- Media includes curated assets, URL insertion and uploads, not an unrestricted live stock-photo service. Question shuffling is suppressed when branching requires a stable dependency order. Legacy scroll-layout metadata is not a second full player implementation.
- Owner record scans still aggregate in memory. Local read concurrency limits are not database indexing, backend pagination, or a large-account performance guarantee. Rate limits and PDF capacity are process-local. Expired-report cleanup is manual and only bounds mutations.
- Native PDF text is tested for Latin, Greek and Cyrillic within bundled glyph coverage. RTL, CJK, emoji and other unsupported text use the browser-print fallback. Remote media, arbitrary fonts, PDF/UA certification and pixel-for-pixel web-theme reproduction are outside its scope.
- Real result email, broader CRM rollout, Stripe/payments, calendar booking and collaborative team roles remain deferred. All accounts remain free. No complete competitor feature-parity claim is made.
