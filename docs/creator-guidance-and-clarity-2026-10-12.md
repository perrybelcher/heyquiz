# Creator guidance and Microsoft Clarity

## Changes
- A visible next-step card surfaces the first required setup fix, then recommended reviews, using existing checklist navigation/focus. It distinguishes recommendations from publication gates and explains Save / Preview / Publish.
- Manual editor offers a Setup checklist entry. Guided Questions includes scoring-mode selection and plain-language mode help.
- Answer examples explain exact point contributions, exclusions, unscored answers, and unreachable branches. Multi-answer questions support combinations. The partial result is explicitly not a complete-journey prediction; production scoring is unchanged.
- Microsoft Clarity project `ywmhuufnta` (Pippi) is wired into the production creator screens. Strict masking was selected and verified in the actual Clarity dashboard.

## Collection controls
No tag loads before explicit browser opt-in. Advertising storage is denied. Root HTML is masked before script loading; no identity API, answer payload, user-supplied event label, or contact identifier is sent by our instrumentation. Event names are allowlisted. Account/recovery, public players, private result links, query/fragment URLs, development and preview hosts are excluded. Sensitive incoming referrers are excluded. Contacts, Results and Integrations stop recording synchronously before rendering. Leaving eligible routes stops collection; it does not restart in that document. Withdrawing consent is available through Analytics preferences; a later opt-in can resume on a fresh eligible page. The optional analytics notice explains this scope.

Configuration: the verified project ID is the default public identifier. Override with `NEXT_PUBLIC_CLARITY_PROJECT_ID`; disable via `NEXT_PUBLIC_CLARITY_ENABLED=false` and rebuild. These are public configuration, not credentials. No extra package, paid plan or provider credential is required.

## Local verification
- Production build and TypeScript passed; scoped lint has no errors (15 existing EditorStudio warnings).
- 25 existing regression cases, 10 guided-checklist groups and 5 new privacy/runtime groups passed.
- Compiled Chrome: individual points, exclusions, neutral selections, multiple-answer combinations, next-action focus and mode help; screenshots at320/390/1440 inspected for reflow.
- Compiled Chrome with every production-host request proxied to localhost: consent/withdrawal, GPC, tag absent on local/private/account routes, fixed creation event and masked root. Vendor tag replaced with a stub; no provider telemetry in those tests.
- Existing compiled guided-checklist navigation/focus/reorder/reload regression passed.
- Existing manual creator save/key/points/theme/claim/autosave/reload regression passed; desktop/mobile scoped axe checks report no violations.

Initial development proxy rehearsal did not hydrate with the blocked dev websocket; the compiled rehearsal passed. One test awaited a focus transition too early and was corrected to wait for the actual focused control. One checklist invocation omitted the mandatory data-directory environment and refused to run before any fixtures. These are test setup failures, not production acceptance.

## Limits and next verification
These checks are synthetic browser tests, not human usability research. Real vendor recording ingestion and masking must be checked after release; a loaded tag alone is not a confirmed recording. iCloud inbox placement remains unresolved. CRM and Stripe remain deferred. No database/schema changes, real emails or credential changes are part of this pass.

Evidence: `outputs/pippi-clarity-2026-10-12/strict-masking.png` and `/private/tmp/pippi-clarity-qa/` local artifacts. Deployment identity and hosted acceptance are recorded separately after release.
