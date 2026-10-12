# Offline release documentation and source validation — batch 10

Prepared 12 October 2026. This lane updates release-facing documentation and supplies an offline, dependency-free candidate source audit. It does not deploy, push, fetch Git history, inspect existing environment/credential files, read original records or backup contents, send emails, authorize providers, or certify production readiness. CRM and Stripe remain deferred; accounts remain free.

## Documentation correction

`README.md` now describes Pippi and the current source rather than the early HeyQuiz MVP. Specific stale claims removed include signup/recovery being unimplemented, an outdated Gemini model default, only three example templates, pending CTA measurement and no marketing AI generation. The replacement covers blank/guided/full creation, save-before-preview and reviewed AI changes, publication pause, report snapshots/revocation/native PDF, historical analytics/contact cohorts, inline/popup embeds and (updated at the completed batch10 checkpoint) 24 enriched campaigns within the preserved 43-template catalog.

Configuration names and behavior were checked against `lib/auth.ts`, `lib/account-auth.ts`, auth routes, `lib/records.ts`, local setup, generators, result-email configuration, schema, package scripts and Next output tracing. The installed Next environment-variable guide was read; Supabase skill guidance was reviewed for configuration/privacy, but no Supabase feature, query or service configuration was changed. Current source, not old deployment claims, is the basis of the README. The documentation distinguishes implemented auth flows from unverified inbox delivery, local synthetic result-email artifacts from real messages, and representative local QA from hosted/cloud or exhaustive verification.

The README links the existing detailed batch reports rather than claiming `npm test` runs everything. That package script runs only the general 25-check regression. Required Playwright engines, explicit isolated data/base URL, empty cloud aliases, PDF tooling, limits and preservation of evidence are called out. Existing provider integrations are described as source code with deferred rollout, not newly tested live connections.

## Explicit audit contract

Run only after the parent has constructed and frozen its separate allowlisted candidate:

```sh
node tests/release-source-audit.cjs --root /absolute/candidate/path --manifest /absolute/external/release-candidate-manifest.json
```

The external manifest must be `{ "files": [{ "path": "relative/source.ts", "sha256": "64-lowercase-hex-characters" }] }`. There is no recursive discovery fallback. The scanner reads only named, approved paths in that candidate, not the original working app, runtime records, Git object database, old ZIP, prior checkpoints or environment files other than the explicitly reviewed placeholder example. It neither loads the application nor imports project dependencies. No network API or command execution is used.

The parent separately verifies that the final tracked candidate paths exactly match the reviewed manifest. This scanner alone cannot detect an omitted/untracked file and is not a Git-history scanner. A clean branch tip leaves old tracked backup/history concerns unresolved.

### Path and integrity gates

The audit accepts known root source/config files; intended source under `app`, `components`, `hooks`, `lib`, `tests`, `scripts`, `database`, `docs`, `public`; the exact Next metadata asset `app/favicon.ico`, and the five named bundled font/license/provenance assets. Documentation must be Markdown. Public binaries are restricted to known image/font extensions and are hashed without text interpretation. Every accepted path must be explicitly present in the manifest.

It rejects traversal, absolute/backslash/control-character paths, duplicates, missing hashes, symlinks including parent directories, unreadable/nonregular/oversized files, source decoding failures, hash mismatches, runtime/generated/credential directories, archives, private-key file extensions, raw QA logs, browser state, build output and every `.env` variant except the explicitly reviewed root `.env.example`. That one example permits empty settings and only three nonempty configuration defaults: boolean `HEYQUIZ_LOCAL_MODE`, a syntactically valid `GEMINI_MODEL`, and `NANGO_HUBSPOT_INTEGRATION_ID=hubspot`. Unknown nonempty values, populated URLs/secrets, duplicate keys and malformed assignment lines fail; content credential rules also apply. It was authorized after the parent independently confirmed its placeholder-only structure without echoing values. Other environment files remain unread. Rejected paths are not opened for content inspection. Limits are 10,000 manifest entries, 2 MiB manifest input and 32 MiB per accepted file.

### High-confidence content rules

Text checks report only a relative filename and rule name, never a token, matched line, decoded payload, source excerpt or filesystem error message. Exit status is 0 for no findings, 1 for candidate findings, and 2 for invalid CLI/manifest input. JSON counters describe the scope; a finding means review is required, not that a credential was confirmed valid.

Rules cover private-key block headers, provider-shaped GitHub/Google/Supabase/Stripe/OpenAI/Slack tokens, AWS access-key identifiers, parsed JWTs declaring privileged `service_role`, and sufficiently varied token-shaped literals assigned to named server-secret settings. Explicit FAKE/TEST/EXAMPLE-style placeholders and single-character repeated fixture payloads are excluded; merely using a provider's real test-mode prefix is not an exemption. General high-entropy strings, arbitrary passwords, email addresses, ordinary `process.env` references and synthetic IDs are not broadly flagged.

The audit is intentionally bounded. It does not prove that all secrets are absent, classify all personal data, decode arbitrary obfuscation, inspect image/font metadata for secrets, validate licenses automatically, inspect dependency contents, audit Git history, or contact providers to test any suspected key. Hashing a binary is integrity evidence, not a content-safety review. Unknown token formats, short literals and deliberately split strings may not be detected. It complements manifest review and human release review; it is not a certification.

## Validation performed

- `node tests/release-source-audit.cjs --self-test`: **20 groups passed** using a disposable synthetic temporary directory, removed afterward. Checks include a clean manifest, non-echoing credential finding, assembled private-key/JWT fixtures, placeholder handling versus real-shaped test-mode tokens, disallowed paths before opening, mismatch, file/directory symlinks, duplicate paths, binary asset hashing, missing/non-UTF8 files empty manifest rejection, and strict reviewed environment-example acceptance/rejection.
- `node --check tests/release-source-audit.cjs`: passed.
- Scoped ESLint for the new audit script: passed with no output.
- README source/path claims were reviewed against current files; no application behavior, dependency, package script or build setting changed by this lane.

**Initial candidate audit:** the independently staged 500-file candidate was checked against the parent-provided manifest. Its 481 text files and 18 allowed assets had no credential-pattern findings. One path-policy finding was a false positive: standard Next `app/favicon.ico` was omitted from the asset allowlist. That exact path now has a regression-tested exception; arbitrary app-directory binary paths remain rejected. The first sanitized output is retained as `compiled-verification-batch-10/release-source/candidate-audit.json`. After the parent recopied the corrected script and refreshed the manifest, the final candidate audit **passed: 500 listed files, 481 text files checked, 19 binary assets hashed, zero findings**. Its exit status was 0. Output is retained separately as `compiled-verification-batch-10/release-source/candidate-audit-final.json`. No application content was changed to resolve this inventory-rule issue.

The parent also reported that the fresh candidate dependency installation completed with `npm ci --offline --ignore-scripts` (403 packages), and that `git diff --check` found only an upstream trailing space at `assets/pdf-fonts/OFL.txt:21`. Those original licensed bytes and provenance are preserved; this is a recorded license-file whitespace exception, not a reason to rewrite the supplied license. Candidate build/runtime acceptance is owned and recorded separately by the parent.

## Release acceptance remains separate

Follow `overnight-release-staging-plan.md`: preserve the active source and older checkout, create the new independent local candidate, explicitly exclude runtime records and the historical backup from the new tip, verify hashes/tracked paths, then install/build/test that candidate with isolated synthetic fixtures. Do not copy old archives blindly or treat stale cached remote refs as current GitHub truth. Review actual remote/hosting linkage before an authorized push because a push may trigger deployment.

The compiled app passed documented batch-1–9 local groups, including representative three-engine popup/native-PDF/focus checks and automated accessibility/reflow scans. This lane has not rerun them, and those results do not establish the candidate's build, current cloud permissions, inbox delivery, production security or real-device/assistive-technology completeness. Live-provider verification, production deployment and history/privacy decisions remain outside this offline lane.

## Final recovery/auth lint review

The parent's broader candidate ESLint pass identified two existing errors in `app/error.tsx` and `components/AuthCallback.tsx`. Both behaviors are intentional external-boundary handling, so each now has a single-line explained suppression rather than a runtime workaround:

- The error boundary's ordinary `/` anchor performs full document navigation. Replacing it with client routing could fail to recover when that router is itself broken. The existing retry button still uses the installed Next 16.4 `retry` API. Only the `no-html-link-for-pages` finding is suppressed on the fallback anchor.
- The email callback reads the browser URL once, strips authorization data using `history.replaceState`, then sets the missing-link error when no code exists. This synchronizes external browser state after mount; it is not a value derived from other React state. Only that `set-state-in-effect` finding is suppressed. No artificial timeout, promise delay, fetch, server auth change or PKCE change was introduced.

Installed Next error-file and Link documentation were read before this decision. `tests/auth-recovery-boundaries.cjs` adds five synthetic behavioral groups: URL stripping before a single exchange despite repeated effect setup, missing/expired link handling, native workspace navigation, retry behavior, private diagnostics and unmount guard. Those five groups and the existing 20 account-auth mock checks passed without provider/network/email calls. Scoped ESLint passes with zero errors; the two pre-existing unoptimized local-logo `<img>` warnings remain explicit. Evidence: `compiled-verification-batch-10/recovery-lint/{boundaries,account-auth,lint}.log`. App changes contain explanatory comments/suppressions only; parent owns candidate copy, refreshed manifest and rebuild verification.

The existing `tests/browser-auth.cjs` now accepts `ARTIFACT_DIR` and adds an explicit missing-code callback check: query/fragment removed, recovery message shown, and no account-exchange request. It is prepared for the parent's rebuilt local candidate with `AUTH_TEST_URL` set explicitly; it has not been counted as a new browser pass by this lane. The old optional `AUTH_TEST_PRODUCTION` flag is not needed or used.
