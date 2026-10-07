# HeyQuiz — improved workspace

An upgraded version of the supplied HeyQuiz backup, with a refreshed dashboard/editor, a respondent player, 51 field types, validated branching and scoring, protected administration, and optional Gemini/Supabase connections.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm ci
npm run setup:local
npm run dev -- --hostname 127.0.0.1 --port 3130
```

Open http://127.0.0.1:3130 and choose **Open local workspace**. Local mode is for a personal loopback preview only. The setup command generates a secret and never overwrites an existing `.env.local`.

Existing forms and responses from `data/` are imported once on the first local login. New records and upload bytes live in `.heyquiz-data/`. Back up that whole directory, along with your environment configuration. Original JSON files are preserved. The source archive excludes runtime records, credentials, and dependencies.

## Editor workflow

1. Create a form or open an existing one. Search the field palette to add fields; use the settings panel to configure them.
2. Draft edits autosave. The status reports errors; a device copy supports recovery after failures. Conflicting revisions are rejected instead of silently overwriting another tab.
3. Preview tests the current draft without adding responses to results.
4. Publish creates the version respondents see. Later draft changes stay private until published again.
5. Results shows saved responses, scores, completion rate, and question reach. Branching can make a lower reach count intentional; it is not automatically abandonment. Exports are CSV.

On mobile, Fields and Question settings open drawers. The respondent player supports required validation, branching, review before submission, resuming in the same browser tab, timed attempts, retakes, and configured immediate feedback.

## Marketing MVP

The dashboard includes fictional product finder, buyer segmentation, and category scorecard templates. The Marketing tab configures recommendations and score rules. Contacts configures lead capture before or after results, optional or required details, and separate marketing consent. Contacts can be searched, filtered, inspected, and exported.

The current milestone is tested locally, not production-ready. Webhook delivery, email/CRM integrations, persuasive AI generation, hosted-account verification, and broader device/accessibility testing remain. See [MVP status](docs/heyquiz-mvp-status.md).

## AI generation

Set `GEMINI_API_KEY` in server configuration. Optionally override `GEMINI_MODEL` (default `gemini-2.5-flash`). Generation calls Gemini with a structured response schema, validates the answer, and reports failures. Prompts are sent to Google only when Generate is selected. No canned quiz is substituted when the key is missing.

Reference: https://ai.google.dev/gemini-api/docs/structured-output

## Cloud deployment

1. Create a Supabase project and apply `database/supabase.sql` using its SQL editor. This creates the records table and a private media bucket. RLS blocks direct anonymous/authenticated table access; server routes enforce ownership using the service role.
2. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `SESSION_SECRET` of at least 32 characters. Keep the service key and session secret server-only.
3. Set `HEYQUIZ_LOCAL_MODE=0`. Create the intended user accounts in Supabase Auth. The app supports email/password sign-in; account enrollment, password recovery, and invitation flows are not implemented. Expired sessions require sign-in again.
4. Run `npm run build`, then `npm start` behind HTTPS. Add Gemini credentials if needed. For CAPTCHA fields, configure `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for your actual hostname; publishing such forms is blocked without them.
5. Verify two separate accounts cannot access each other’s forms, then exercise publish, upload, and submission on the deployed environment before inviting users.

Local backup data is not automatically migrated into a cloud account. Use reviewed JSON form import; historic responses require a separate migration. A serverless deployment must use cloud storage, not its ephemeral local filesystem. The built-in request limiter is process-local; use an edge/shared limiter for a scaled public deployment.

References: https://supabase.com/docs/guides/api and https://supabase.com/docs/guides/storage/security/access-control

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
# With the loopback preview running:
npm run test:api
npm run test:marketing-api
npm run test:contacts-api
```

`test:api` creates its own fixture and removes the fixture form. Historical scripts in `scripts/test-*` and `scripts/qc-*` predate the new authenticated API and are retained as reference, not the current acceptance suite.

## Scope and known limits

- The 51-field schema is preserved. A meeting preference captures a requested time; it does not reserve a calendar slot. Signature is typed, not a drawing pad or an e-signature service. Attachments are one file per answer, capped at 10 MB (or a lower configured limit). Voice recording requires browser microphone permission.
- The media library is a curated, filtered image list plus URL insertion and real uploads, not a live stock-photo search service.
- Question shuffling is suppressed on forms with branching rules to preserve dependency order. JSON `theme.layout=scroll` and keyboard-shortcut configuration are legacy metadata; this release uses the step player. Matrix answer keys can be set in JSON; matrices without keys are treated as survey fields.
- The Integrate panel reports real connection status. CRM/webhook integrations, payments, calendar booking, team roles, and collaboration are not implemented.
- Gemini, Supabase, and Turnstile adapters are implemented but have not been exercised against live credentials in this workspace. This is a substantial local product upgrade, not a verified claim of full Fillout feature parity or production security certification.

## Marketing MVP milestone

The dashboard now offers Product finder, Buyer segmentation, and Category scorecard examples. Each is fictional and editable. Open the new **Marketing** tab to configure result copy, category coverage, answer points, exclusions and no-fit behavior. Expand a result or rule to edit it; use the simulator to check combinations without creating responses.

Recommendations and category scores are computed on the server, saved with submissions, visible in response details, and included in CSV export. Exclusions override points; ties follow result order. Scorecard unknowns do not become zeros, and insufficient coverage has an explicit result. Questions now have a brief entry transition that respects reduced-motion preferences.

Run `npm run test:marketing-api` against the local preview to verify all three modes. The existing conventional Gemini generator has not yet been adapted to generate these marketing configurations. Dedicated lead capture, consent records, webhook delivery, offer-click tracking, and live cloud verification remain pending; this milestone is not the full MVP. See the accompanying `heyquiz-mvp-status.md` acceptance tracker.
