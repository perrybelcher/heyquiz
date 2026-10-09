# Pippi error-alert runbook

## Scope

Vercel project: heyquiz (public domain www.pippiapp.com).
Rule: Pippi server errors. Trigger: route-level 5xx error anomalies. Scope: heyquiz only.

Vercel anomaly detection needs sufficient traffic and deviation from a baseline. A single failure in a low-traffic beta may not trigger an alert. Custom pippi.failure log events and client reports returning HTTP 200 do not themselves trigger the 5xx rule. Consult https://vercel.com/docs/alerts for the current detection behavior.

## When notified

1. Open the alert and note route, time, deployment and HTTP status.
2. Open Vercel Logs for heyquiz and that time. Search pippi.failure or the user's support reference.
3. Determine whether signup, save, publish, submission or results are affected. Reproduce with a dedicated QA account and fictional data.
4. If a deployment introduced a blocking regression, roll back to the last verified deployment. Confirm the critical flow afterward.
5. Check whether submissions already succeeded before replaying failed operations. Never manually duplicate leads to resolve a lost response.
6. Record the fix and its regression test in the issue tracker or beta scorecard.

Never paste passwords, tokens, cookies, confirmation URLs, or personal quiz/contact data into incident messages. Keep alert payloads limited to operational metadata.

## Open items

- Configured and saved 2026-10-10: medium/high severities, personal email enabled, automatic team-owner subscriptions disabled. Rule ID ar_01a122e5-1271-700d-b86b-2cb566d1fe9f. Vercel reported Alert rule created. A vendor test email reached perrybelcher@gmail.com Inbox with subject [TEST] High severity: 5xx error rate alert for project heyquiz. This verifies notification delivery, not the triggering of a real incident.
- Physical iPhone and Android checks must be performed by a person with those devices.
- Supabase leaked-password protection is unavailable on the current Free plan; enabling the native feature requires a Pro upgrade. No upgrade is authorized by this runbook. See https://supabase.com/docs/guides/auth/password-security.
- Human beta session plan: docs/human-beta-kit.md.
