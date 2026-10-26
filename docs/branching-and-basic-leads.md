# Branch preservation and Basic lead collection

Release verification is tracked by the Git commit and Vercel production deployment status.

## Behavior

- Basic and Advanced answer renaming use the same immutable helper. Unambiguous exact/negated wording conditions move to the existing stable answer ID, preserving routing. Each option's condition result is compared before/after the edit. Ambiguous, substring, or newly matching conditions that would alter routing block the rename with an explanation; the old answer remains intact.
- Exact-answer branching selectors display stable IDs and unique legacy labels correctly. Explicit answer selections store existing answer IDs. Legacy ambiguous/unknown values remain visible as saved conditions for review. Substring and numeric comparison behavior is unchanged.
- Basic Publish exposes existing capture settings: before/after results, required/optional, name/phone field requirements, heading/description/button copy, privacy URL, and separate optional marketing consent.
- New Basic capture retains its existing marketing-off default; existing quizzes retain their own settings. Disabling/re-enabling capture does not erase configuration. Switching capture placement makes it optional, as required by the existing schema. Custom button wording is retained; built-in button text adapts to timing.
- The contact preview reuses the respondent component inside a disabled fieldset. No details can be submitted from this preview. The existing privacy-checklist target retains its field registration.

No changes to schema, scoring, respondent capture endpoints, integrations, consent semantics, or publication snapshots. No database migrations, dependencies or environment changes. Draft edits become live only through explicit publication.

## Verification

- `npm test`: regression, choice publication, actual Advanced rename handler, routing preservation and Basic capture controls.
- Guided editing, guided checklist and publication readiness suites.
- Workspace and session/save/recovery reliability suites.
- All 19 contact API regressions pass, including before/after-results capture, independent marketing consent, retries and preview isolation. Updated the obsolete storage-error assertion to require the existing safe retryable 503 response.
- Lint: no errors; 68 existing warnings. TypeScript and production build pass.
- Compiled loopback app, isolated synthetic records, Supabase disabled: `tests/browser-basic-leads.cjs` verifies rename/save/reload, rule selector, privacy checklist focus, Basic capture settings, disabled mobile preview, explicit test publication, actual respondent completion without marketing consent, and blocked unsafe edits in Basic/Advanced.

Test scripts require a loopback URL and explicit isolated data/artifact directories. No production quiz/contact data was changed. Existing legacy rules are not bulk migrated. Rollback leaves saved IDs compatible with the existing rule engine.
