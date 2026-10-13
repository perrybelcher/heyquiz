# Creator outcome events

Consent-gated, fixed-name Clarity events; no form IDs, email addresses, answers, error strings or other payloads.

- draft_saved: confirmed guest claim or successful account PUT processed. No event for unchanged/no-op saves or browser-only backup.
- save_auth_required: save attempt returned401.
- save_failed: client could not complete/confirm save; not proof that the server did not persist data (network loss can be ambiguous).
- publish_succeeded: valid publication receipt parsed.
- publish_failed: publish request did not produce a successful response; network failures can be ambiguous.
- publish_unconfirmed: success response received but publication receipt could not be verified.

Analytics exceptions are swallowed so a vendor failure never converts a successful operation into a UI failure. Existing consent, route exclusions, masking and stop controls remain. Counts represent requests/receipts, not unique creators or completed quizzes.

Verification: production build/TypeScript passed; six privacy groups passed including fixed payload shapes and vendor throwing. Scoped lint has zero errors and one pre-existing navigation warning. Browser regression results are recorded in the task handoff. This change does not prove Clarity ingestion of these new event names until deployment and a consented real action are observed.
