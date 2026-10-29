# Pippi V2 rollout and recovery runbook

## Current status

V2 is implemented behind server-side interface selection. The application defaults to Classic when the rollout variable is absent or invalid. This implementation work did not deploy a release, enable production beta access, expand a customer cohort, or change the production default.

Local checks are evidence for the implementation, not production release approval. See [v2-parity.md](./v2-parity.md) for the test and browser evidence and the remaining acceptance matrix. Customer beta must remain disabled until the documented release gates are met.

## Configuration and preference behavior

Configure these **server-only** environment variables on the application service. Do not give them a `NEXT_PUBLIC_` prefix or expose the allowlist in browser code.

```dotenv
PIPPI_INTERFACE_ROLLOUT=off
PIPPI_INTERFACE_ALLOWLIST=
```

`PIPPI_INTERFACE_ALLOWLIST` is a comma-separated list of the stable account IDs used by `requireUser().id`. Whitespace is trimmed. Use verified account IDs, not email addresses, names, browser `accountKey` values, or profile record hashes.

| Mode | Eligible accounts | Effective interface |
| --- | --- | --- |
| `off` | None | Classic for everyone, even if the saved preference is V2 |
| `invite` | Exact IDs in the allowlist | Classic until an eligible account explicitly selects V2 |
| `opt-in` | Every authenticated account | Classic unless the account explicitly selected V2 |
| `default-v2` | Every authenticated account | V2 unless the account explicitly selected Classic |

An absent or unrecognized mode resolves to `off`. A preference of `null` follows the mode's default. Preferences are stored as separately versioned, owner-bound `interface_preferences` records in the existing record store. No quiz-format migration is involved. Do not delete preference records to perform rollback: explicit Classic choices must survive later rollout changes.

Resolution happens on the server for creator pages. Ineligible users receive Classic without a preference read. An eligible user's preference read failure also renders Classic, preserving the record. Preference API errors remain visible instead of pretending a write succeeded.

Changing environment configuration must reach **all serving instances**. Apply the hosting provider's normal restart/redeploy mechanism when required; changing a dashboard value alone is not proof that running instances use it. The currently mounted interface does not automatically reload. Users see the new resolution on navigation or reload. There is no remotely forced destruction of open editor drafts.

## Release sequence and gates

1. **Prepare staging.** Use an environment with a separate record store, disposable quizzes, and test integration credentials. Confirm these boundaries before any test that writes or publishes. Start with `off`; test Classic first, then use `invite` for two synthetic accounts with only one allowlisted.
2. **Complete staging acceptance.** Run the parity matrix, including V1/V2 schema round trips, all field types, save/recovery failures, sessions and account switching, publishing, results/contacts, mobile/keyboard flows, and Chrome/Safari/Firefox. Complete Product Design comparisons for the selected editor and element-picker references and review the rest of the creator workspace. Rehearse both recovery mechanisms below. Resolve or explain every baseline regression; no core-workflow, data-loss, account-isolation, saving, or publication blockers may remain.
3. **Internal production beta.** After a separate release decision, deploy with `invite` and only verified internal account IDs. Each tester opts in through Profile. Verify a non-allowlisted production test account still sees Classic. Check production operational logs and confirm data isolation without modifying customer quizzes.
4. **Invited customer beta.** Add only the named approved cohort. Retain the Beta label, profile switch, and independent recovery route. Review feedback, switchbacks, errors, and successful task counts together.
5. **Open opt-in.** After at least one week of meaningful beta use, no critical incidents, and continued satisfaction of the release gates, make a separate release decision to use `opt-in`. Elapsed time alone is not acceptance; a week with insufficient successful usage does not establish reliability.
6. **Make V2 the default.** Requires explicit release approval. Set `default-v2` and verify users with `null`, explicit V2, and explicit Classic preferences. Explicit Classic preferences must remain Classic.
7. **Retire Classic separately.** Keep Classic available for at least 30 days after the default change. Removal requires its own compatibility review and release decision; do not remove it as cleanup during beta.

Before every expansion, record the release identifier, configuration, eligible cohort, test evidence, unresolved issues, usage sample sizes, and the person authorizing the release. Do not put private account IDs or credentials in this repository's public-facing documentation.

## Recovery and emergency rollback

### Individual account: return to Classic

1. If the workspace is working, finish saving edits and open **Profile → Interface → Classic → Save and switch interface**. Existing navigation guards run before the preference write; cancelled or failed preparation prevents the switch.
2. If V2 fails to render, open `/interface-recovery` directly on the same Pippi deployment. This page is outside the V2 shell and requires the usual signed-in account. Save work in other tabs before continuing.
3. Select **Use Classic**. The page reads the current preference revision, sends an account-bound PATCH selecting `v1`, and redirects to `/` only after the saved preference is confirmed.
4. Verify the Classic workspace appears. Open Profile and verify Classic is the current interface. Other open tabs retain their mounted interface until navigation/reload; finish or recover their drafts before reloading them.
5. On a revision conflict, retry so the recovery page reads the latest revision. On authentication/account errors, sign in to the original account. On a record-store outage, this account-level recovery cannot confirm a write; use the server override below rather than claiming recovery succeeded.

### All accounts: emergency server override

Use this for a confirmed V2 data-loss or publication incident, or a severe V2 failure that prevents safe work.

1. Stop further cohort expansion. Record the affected release and incident evidence without copying quiz answers or contact details into logs.
2. Set `PIPPI_INTERFACE_ROLLOUT=off` for the affected environment. Keep the allowlist and preference records intact.
3. Apply/restart/redeploy configuration through the established hosting process so **every active instance** reads `off`. Do not roll back quiz data or remove preference records as part of this action.
4. On a fresh navigation, verify Classic for an account that previously chose V2 and for another account. Check at least the dashboard, an editor, and Profile. A working preference API should return `effectiveVersion: "v1"` and `eligible: false`; its `preferredVersion` may correctly remain `"v2"`. If storage is unavailable, verify the creator shell directly because the `off` resolver bypasses preference storage.
5. Ask affected testers to stop the failing action and save/recover drafts before navigating or reloading. Already mounted V2 tabs are not immediately disabled by the server override. If the incident is in shared save/publish behavior, interface fallback alone may be insufficient: use the application's established incident/deployment rollback process and treat data recovery as a separate operation.
6. Reproduce and fix the issue on staging. Review affected records and existing checkpoints before any restoration. A presentation rollback does not undo an incorrect write or publication.
7. Keep production on `off` until a separately approved restart of internal beta. Re-enable `invite` first and verify the fix and compatibility matrix. Saved V2 preferences will become active again for eligible accounts when V2 is re-enabled, so review the allowlist before that change.

### Staging rehearsal to record before customer beta

Use synthetic accounts A and B and an isolated quiz. Under `invite`, allow A only, opt A into V2, and verify B remains Classic even on direct creator URLs. Save a V2 edit, switch A to Classic, and confirm the full quiz data survives. Return A to V2, exercise `/interface-recovery`, and verify its explicit Classic preference. Opt A into V2 again, apply `off` to the running deployment, and verify A and B both render Classic on fresh navigation while A's stored V2 preference remains intact. Restore staging to `off` after the rehearsal and attach evidence of each result.

## Monitoring and executed evidence

First-party `/api/interface-events` records versioned editor-open, confirmed/failed save, confirmed/failed publication, and switch-to-Classic observations. It accepts only the event enum and interface version. Review event counts and denominators over a fixed UTC period, alongside application errors and tester feedback. Do not infer unique users or zero errors from missing events. The detailed aggregation and privacy limitations are documented in [v2-parity.md](./v2-parity.md).

**Executed locally:**

- `node tests/interface-rollout.cjs` passed mocked-record checks for default-off, invite allowlisting, opt-in/default-v2 behavior, account binding, stale revisions, outage fallback/preservation, and the off override preserving saved V2 preference. Rerun by Agent A on 2026-10-29.
- The local in-app browser verified a successful Profile V2 → Classic → V2 switch with the corresponding shell and current-interface selection after each navigation.
- The recorded isolated-loopback HTTP test verified a 51-field V2 → Classic → V2 storage round trip, stale write rejection, wrong-account preference rejection, and unchanged published visitor content when switching interfaces.
- Navigation tests recorded in the parity report verify cancellation before preference write, save → preference → navigation order, failure handling, and concurrent-action locking.

**Still required before release:** hosted staging with real authentication and two synthetic accounts; actual environment-change/restart rollback across serving instances; independent recovery-route browser rehearsal; complete browser/visual acceptance matrix; production invite verification; customer beta observation; and all expansion/default-change approvals. Mocked configuration tests and a local Profile switch do not establish that hosted rollback has been rehearsed.

### Final local rehearsal update

Lead exercised `/interface-recovery` in the local browser: Use Classic saved the preference and redirected to the Classic dashboard. This supersedes the earlier pending local recovery-route item. Hosted/global-override rehearsal remains pending.
