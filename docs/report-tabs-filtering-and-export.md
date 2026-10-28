# Reports tabs, filtering and CSV export

Implemented locally; deployment is a separate action.

## Behavior

- Reports default to Analytics, preserving the previous entry view. Analytics and Responses are keyboard-accessible tabs with explicit ARIA relationships. Hidden panels stay mounted so changing tabs does not reset either panel's filters. Changing to a different quiz resets its report view state.
- Responses render 25 records per page. Search/date changes reset pagination; refreshes and smaller result sets clamp the current page safely. This is client-side pagination of the existing authorized response snapshot, not a new database-pagination API.
- Response dates are inclusive UTC calendar dates based on submission time. Analytics keeps its existing session date range and cohort filters. Invalid/reversed ranges show an error and prevent a matching export. Unknown legacy dates remain available without a date filter and in all-response exports.
- CSV export defaults to all matching records across every page; an explicit selector also offers all responses ignoring search/date filters. Export is disabled while refreshing or when the selected scope is empty. Matching exports are disabled for invalid dates.
- New direct CSVs include identity/contact fields, saved outcome, meaningful existing score values, category scores and saved answer snapshots. Renamed/deleted questions retain historical wording in separate columns. Legacy raw answers without grading remain exportable. Valid timestamps are normalized to UTC. Cells escape quotes, line breaks and spreadsheet formula prefixes; browser downloads use UTF-8 with a BOM.
- Existing Advanced management/export tools remain available through Manage responses and retain their existing format. No scoring, branching, analytics formulas, respondent flow, database schema or publication changes. No dependencies, migrations or environment changes. Viewing/filtering/exporting does not mutate quiz/response records.
- The report header stacks actions below its title on small screens to avoid squeezing the title. Existing desktop styling is retained.

## Validation

- `npm test`: existing regressions plus UTC/date validation, search, pagination/clamping, all-page exports, legacy/historical answers, structured values, score interpretation, formula and quote/newline escaping.
- `npm run test:workspace`: shared navigation/profile contracts and account isolation.
- Lint: zero errors, existing warnings. TypeScript and production build pass.
- Isolated compiled loopback app with Supabase disabled: `tests/browser-report-tabs.cjs` exercises keyboard/ARIA tab behavior, retained filters across tabs/refresh, pagination, invalid/empty ranges, actual matching/all CSV downloads, legacy snapshots, mobile fit, authentication and absence of quiz mutations.
- Workspace browser journeys retain navigation/save protection/profile/mobile behavior. Existing usability and Contacts browser cases were updated to use the Responses tab and paginated counts.

Browser scripts require explicit loopback TEST_BASE_URL, isolated HEYQUIZ_DATA_DIR and ARTIFACT_DIR. No production records were changed.

## Rollback

No record changes or migrations are required. Reverting this patch restores the single-page report layout; original Advanced export/management and all saved records remain intact. Tab/search/date selections are view state, not stored quiz settings.
