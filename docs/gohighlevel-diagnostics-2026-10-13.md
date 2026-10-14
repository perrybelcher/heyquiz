# GoHighLevel diagnostics — 13 October 2026

GoHighLevel uses the direct sub-account private integration token connector, not Nango. No live account failure has been reproduced in this pass.

Changes: trim pasted Location IDs; provide explicit direct-connection setup and write-scope guidance; explain that saving does not verify delivery and synthetic tests create CRM contacts; map HighLevel 400/401/403/404/422 failures to actionable messages without revealing provider bodies; use Pippi as new contact source.

Verification: 22 integration checks passed using isolated synthetic storage and mocked HTTP, including token rejection, missing permission, invalid data, missing destination, tag-preserving retry, consent and privacy guards. TypeScript and targeted ESLint passed. No live CRM writes, token changes, or deployment performed.

Remaining: obtain the actual failing step/error and verify the configured sub-account/token and an explicitly approved end-to-end test. These changes improve setup and diagnosis; they do not establish that the reported live issue is resolved.
