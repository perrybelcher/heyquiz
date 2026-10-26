# Integration delivery after response deletion

## Confirmed defect and repair

An independent review reproduced a queued integration delivering its frozen contact and answers after the owner deleted the source response. The isolated reproduction used the actual records adapter and a mocked destination: deletion succeeded, yet the subsequent delivery made one outbound call and became `delivered`.

Delivery now requires the retained response to match the job's owner, quiz, response identity and captured contact. The check runs before every outbound request, including CRM lookups, upserts and follow-up tags. An unavailable or changed source becomes `skipped`; manual retry cannot requeue it. Temporary storage failures remain retryable. Valid sources keep their frozen events, mappings and idempotency keys. Explicit synthetic connection tests remain separate.

Deletion also writes a minimal owner-bound receipt before removing the response. The receipt blocks delivery if a previously interrupted submission recreates that response ID. It contains no contact details, answers, credentials or destinations, and uses the existing generic records adapter without a migration.

This cannot recall requests already handed to the network or remove contacts already accepted by a provider. It does not implement transactional deletion of every response-related record. A separate review confirmed that an in-flight submission writer can recreate the response row; the new receipt prevents that row from reviving integration delivery, while broader response lifecycle consistency remains follow-up work.

## Scope and verification

The coordinator integrated the receipt and deletion path; one agent implemented delivery guards and regression cases, another preserved existing transport/recovery fixtures, and a separate reviewer reproduced and reviewed the repair independently. Tests use temporary synthetic records and injected destinations. No live provider calls, customer-data changes, credential changes or scheduler changes are needed.

The integration suite retains all 23 existing checks, with fixtures now persisting the source response as the production submit/contact routes do. The new lifecycle suite is included in `npm run test:integrations`. Recovery fixtures recognize and validate deletion receipts, including restored owner/form/response binding and rejection of unexpected private fields.

Final local results:

- All 23 existing integration checks and 24 new lifecycle groups passed, including source/receipt outages, corruption, wrong owners/forms, manual retry, recreated response IDs, interruption between provider operations, and explicitly configured all-contact webhooks.
- Nango/HubSpot (15), provider adapters (43), publication pause (9), report management, and the synthetic recovery rehearsal (27) passed. Existing general regression (25), session/save reliability, and mocked result-email suites also passed.
- Global ESLint without errors, TypeScript, `git diff --check`, and the Next.js 16.4.3 production build passed. The restricted build worker stalled; the rerun outside the sandbox completed successfully.
- The independent reviewer exercised the actual owner DELETE route, manual retry route and scheduled worker route with isolated filesystem records, synthetic authentication and an injected mock sender. Deleted responses produced zero sends; manual retry returned 410; a deterministic in-flight writer recreating the source still could not revive outbound delivery; a retained-source control delivered once. Evidence: `/private/tmp/pippi-independent-delivery-acceptance.json`. No blocking finding remains in this bounded repair.

These local acceptance results were recorded before release. Deployment status is verified separately. No production fault injection or real-provider transmission was performed during validation.

Another confirmed editor issue is queued separately: Advanced mode permits deleting a numeric input used by a calculation, leaving its formula intact and silently changing the result; Basic mode already blocks that removal. No scoring, calculation or editor behavior is changed by this delivery patch.
