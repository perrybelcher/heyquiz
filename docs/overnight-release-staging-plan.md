# Read-only release staging audit — 12 October 2026

Audit point: 02:16 UTC, while the parent was finishing batch-9 QA. This document is a plan, not a staging operation or a deployment approval. Only this Markdown file was created by the audit. No checkout, file copy, index/branch change, commit, fetch, push, provider call or deployment was performed. No credentials or runtime record contents were inspected.

## Source and Git provenance

**Active development source:** `/Users/perry/Documents/Codex/2026-10-06/gr/outputs/heyquiz`. This directory has no `.git` checkout. The 11 October source inventory, competitive review and overnight progress log all identify it as the working application. The README describes it as an upgrade of the supplied HeyQuiz backup. The pre-overnight manifest has 355 files, so the overnight work started from an already substantially developed application; its delta alone cannot reconstruct the current app from the older Git checkout.

**Older Git checkout:** `/Users/perry/Documents/Codex/2026-10-06/gr/work/heyquiz-github`. Its working tree is clean at the audit point. It contains one worktree and one local branch, `main`. The remote URL is `https://github.com/perrybelcher/heyquiz.git`. This is the configured local remote, not verification of current GitHub state or the project/domain currently connected to hosting.

| Local reference | Commit | Observation |
| --- | --- | --- |
| `main` / `HEAD` | `492902399c483f7ab74574d800c854bed33ff558` | 7 October MVP commit |
| cached `origin/main` | `7688195ad821a1f75fe1e2ca4d79ea6fce4d1118` | Separate 7 October MVP commit |
| common parent | `6c27dd8c19d4a067114e94444e844aab4625468e` | Original upload |
| both MVP trees | `b93be959a1063adefb6c38e2833d8c30658219ac` | Exactly identical file trees |

`main` is one ahead/one behind cached `origin/main`, but `git diff main origin/main` is empty. Do not reset or merge the old checkout merely to resolve those counters. The cached remote has not been refreshed by this audit and is not authoritative about live GitHub or production.

A broad source-root inventory found 524 current candidate files versus 87 old tracked paths: 442 additions, 42 differing common paths, 40 identical paths and five old-only/intentionally excluded paths. This inventory included QA documentation and is **not** the approved release manifest. Counts will change with the final handoff. Crucially, a blind copy of the old checkout over active source would discard substantial existing work, including work predating this overnight session.

## Recovery archives are not release inputs

The local baseline and successive checkpoint archives preserve useful recovery history. Their pathname inventories need correction before they can be described as source-only:

- All eight existing manifests (baseline, initial checkpoint, batches 3–8) include `data/forms.json` and `data/submissions.json`.
- They also include 36 `.log` files under `docs/qa-2026-10-09`, its `initial-results.json`, and generated `next-env.d.ts`.
- No manifest pathname matched `.env*`, `.vercel`, `.aws`, `.ssh`, PEM/key stores, `.git`, `.next`, `node_modules`, `.heyquiz-data`, `test-data`, `coverage` or `*.tsbuildinfo`. This is a pathname-only check; it does not prove file contents contain no sensitive material.
- The baseline and batch-8 archive member lists confirm the two `data/` files. The checkpoint script includes them because it accepts keys from the baseline manifest, even though its comment says mutable records are excluded.
- The old Git checkout already tracks `heyquiz-full-backup.zip`. Its member names also include `data/forms.json` and `data/submissions.json`. Its record contents were not opened. Removing that ZIP from a future branch tip would not remove it from existing history; do not claim otherwise or rewrite history automatically.

Parent was informed and is correcting the new checkpoint's exclusions and active `.gitignore`, while retaining earlier artifacts as private local recovery copies. At audit start, the active `.gitignore` lacked the older checkout's explicit `/data/` rule. Verify the final correction rather than assuming it occurred.

**Never overlay a source archive directly into a release checkout.** Preserve existing archives locally, mark them private recovery artifacts, and construct a new allowlisted release inventory from the frozen active source. The earlier archives and old Git history need a separate content/privacy review before anyone chooses to publish them; this audit does not establish whether any records are private or whether the remote repository is public.

## Concrete isolated staging approach

These are future steps for the parent once staging is authorized and the final source is frozen. They have not been executed.

1. Record hashes for the final active source, final combined build/test evidence, and the old checkout's current branch, refs, index and status. Preserve the final recovery checkpoint separately. Treat `.env.local`, existing runtime data and the old `.git` directory as untouchable source material.
2. Create a **new independent local clone**, not a worktree that shares and changes the older checkout's Git metadata. A suitable new location is `/Users/perry/Documents/Codex/2026-10-06/gr/work/pippi-release-2026-10-12`, only if that path does not already exist. `git clone --no-hardlinks --no-checkout /Users/perry/Documents/Codex/2026-10-06/gr/work/heyquiz-github <new-path>` is a local-only way to preserve available history without hard-linking its object store. Keep the active source and old checkout unchanged.
3. In the new clone only, create a candidate branch such as `release/pippi-2026-10-12` from the recorded cached `7688195…` commit for an **offline review base**. Record that it is stale/unverified. Do not point this clone at the network, fetch or push until the later authorized remote verification. No reset, force push or history rewrite is needed.
4. Copy only entries in the reviewed release manifest from active source into the new candidate. Match every copied file's SHA-256 and reject symlinks/path traversal. Stage only that explicit path list. Do not use recursive archive extraction, `git add .`, or `rsync --delete` as a substitute for a reviewed manifest.
5. Review old tracked paths missing from active source separately. Current special cases are the tracked backup ZIP and three old docs (`heyquiz-contacts-verification.json`, `heyquiz-mvp-status.md`, `heyquiz-persuasion-core.md`); preserve their originals and history, then decide explicitly whether they belong in an archival docs location or should be removed from the candidate tip. `.env.example` is a separate deliberate exception described below. Never infer deletions from a directory copy.
6. Add/review ignore rules in the candidate that cover the complete exclusion list below, including `/data/` and QA artifacts. Verify both `git diff --cached --name-only` and the final `git ls-files`, because ignore rules do not remove files already tracked. Run a non-echoing sensitive-content scan over the candidate and independently review the existing backup/history issue. A clean tip is not proof of clean history.
7. Build and test **the candidate tree**, with fresh generated output and isolated synthetic data. The compiled active app's success is evidence to reproduce, not proof that the copied candidate is complete. Record the candidate tree/hash plus test artifacts outside the repository. Keep the old and active sources available for comparison.
8. Only after later user-authorized network/release work: verify the actual GitHub default branch/latest commit and hosting project's repository, root directory, production branch and domain. If the remote has moved, integrate the candidate on a separate branch in the new clone and review all conflicts. Do not force the stale local base over newer remote work. Prepare a reviewable PR/preview and a rollback reference before any production promotion. A push can trigger hosting automatically, so determine those hooks before pushing.

## Exact inclusion and exclusion policy

The manifest must include application source under `app/`, `components/`, `hooks/`, `lib/`; reviewed test source/fixtures under `tests/`; code under `scripts/`; migration source under `database/`; intended public assets under `public/`; and all five licensed PDF-font assets under `assets/pdf-fonts/` (both TTFs, OFL, provenance and README). Include reviewed Markdown documentation, `AGENTS.md`, `README.md`, `.gitignore`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `instrumentation.ts`, `next.config.ts`, `tsconfig.json` and the existing `test-framer.tsx` only if retained intentionally. No file outside the manifest is copied automatically.

| Exclude from candidate source and Git index | Reason / exception |
| --- | --- |
| `.env*` | Credentials/configuration. Only a separately reviewed **placeholder-only** `.env.example` may be included. Never copy `.env.local`. |
| `data/**`, `.heyquiz-data/**`, any `test-data/**`, runtime uploads/media/records | Imported or mutable records; use isolated synthetic data at test time. `public/`'s reviewed app assets are distinct. |
| `.git/**`, `.vercel/**`, `.aws/**`, `.ssh/**`, package-manager credential files, `*.pem`, `*.key`, `*.p12`, `*.pfx` | Preserve the candidate's own Git metadata; no source/host credentials or deployment linking config. |
| `node_modules/**`, `.next/**`, `out/**`, `build/**`, `coverage/**`, `*.tsbuildinfo`, `next-env.d.ts` | Generated dependencies/build/type files; regenerate from the lockfile. |
| `docs/qa-*/**`, `*.log`, HAR/traces, `test-results/**`, `playwright-report/**`, browser storage state, downloaded test reports/screenshots | Raw QA evidence stays in the private sibling evidence directory. Reviewed source tests and narrative Markdown handoffs may be included separately. |
| ZIP/tar checkpoints, `heyquiz-full-backup.zip`, source manifests/evidence dumps, unrelated PDFs/attachments | Recovery/reference artifacts are not application release assets. Reviewed font provenance JSON is an explicit legitimate asset. |
| `.DS_Store`, editor/cache/temp files and unexpected symlinks | Machine-specific or unreviewed material. |

The active `next.config.ts` also excludes runtime data/docs/tests/environment files from server output tracing and includes `assets/pdf-fonts/*` for the PDF route. Preserve both rules. Git exclusions and runtime packaging exclusions are separate gates; neither replaces the other.

## Candidate verification gates

1. **Inventory/installation:** final manifest hashes match copied files; no excluded tracked path, broken asset or unexpected symlink; lockfile and package versions match. Install the locked dependencies in the candidate with lifecycle scripts disabled unless a specific reviewed requirement says otherwise. Do not reuse/copy active `node_modules` or `.next` as proof of a clean installation. Record Node/package-manager versions.
2. **Static/source:** scoped or complete lint with warnings recorded, `npx tsc --noEmit --incremental false`, then `npm run build`. Do not claim all QA from `npm test`: that script runs only `tests/regression.cjs`, not the full overnight suite.
3. **Pure/API regression:** rerun the documented batch-1–9 suites for draft history/guided editing; journey expectations; landing/result layouts; brand kits; analytics and visits; contact filters/context/answers; experiment lifecycle/plans; report revocation; synthetic email disabled/claim/retry behavior; inline/popup embeds; PDF model/access/renderer; and template fixtures/catalog. The feature handoffs identify exact filenames and fixture bounds. For batch9 specifically: `tests/contact-answer-cohort.cjs`, `tests/contact-answer-api.cjs`, `tests/popup-embed.cjs`, `tests/embed.cjs`, `tests/template-campaigns-batch9.cjs`, `tests/template-campaigns.cjs`, `tests/template-campaigns-batch8.cjs`, `tests/template-catalog.cjs`, `tests/launch-templates.cjs`.
4. **Compiled packaging:** run `tests/result-pdf-packaging.cjs` against the candidate build without `ALLOW_INCOMPLETE_TRACE`. Require bundled licensed font hashes, no unexpected records/docs/environment files, zero external reads/network and successful authorization/fallback/recovery cases. Preserve dependency-trace exclusions after any hosting config change.
5. **Compiled local browser:** use an explicit localhost base and dedicated data directory; blank all five supported cloud variables in the test/server environment. Recheck guest create→account save, autosave recovery, preview, publish/pause/republish, public completion/capture, report creation/revocation/PDF, scoped contact export, experiments, analytics and campaign invariance. Run popup/inline and keyboard focus on Chrome/Firefox/WebKit as documented. Include 320/390px, 200%-equivalent reflow and settled automated accessibility checks; keep manual limitations stated. Serialize suites against shared start/PDF limit windows instead of weakening rate limits. Avoid blindly running `live-*` scripts or old defaults against an existing service.
6. **Cleanup/record:** remove only synthetic fixtures created by the run. Keep full logs, first failures, screenshots, PDFs and sanitized results outside the candidate. Compare the original checkout's refs/status with the pre-staging record to confirm it remains unchanged. Freeze the candidate after the final build; subsequent source fixes require a new build and relevant checks.

## Facts that still block a production-readiness claim

- Final batch-9 QA/checkpoint was still in progress when this audit began. The candidate does not yet exist or have its own clean build. No upstream freshness, hosting linkage or production commit was checked.
- The existing recovery archives and tracked backup require the exclusion/privacy treatment above. The active ignore-rule omission must be corrected. These are factual staging issues, not proof of a public data leak.
- Contacts client and API must ship together: current nonempty responses require `contextByResponse` and `answerCohort`; older payloads intentionally fail safely rather than export misleading cohorts. Rollback must likewise keep the pair compatible. The embed loader/player/CSS and PDF route/font assets also belong to the same tested release.
- Cloud storage/auth/permissions and real signup-confirmation delivery were not exercised by this overnight local work. A later authorized preview needs isolated synthetic account/quiz/response tests, including cross-owner isolation, signup/recovery, save/publish/pause/submit and saved-report revocation. Do not use ephemeral local storage for serverless production or import local backup records implicitly. The generic records-table schema exists; this audit does not establish the deployed schema/configuration or call for blindly rerunning SQL.
- Production must keep local-mode login off, retain correctly configured server-only signing/storage settings and preserve the intended stable signing secret across release/rollback. Do not copy local test flags, secrets or synthetic records into hosting. Synthetic result email is intentionally unavailable on Vercel/cloud and is **not** real email delivery; its tests do not resolve account-email delivery or authorize activating a provider.
- The current README's statement that signup/recovery are unimplemented is stale relative to the active `/signup`, `/forgot-password` and `/reset-password` pages. Update release-facing documentation from current source and verified scope, without erasing older evidence or claiming an unperformed cloud test.

Known bounds are not new defects or reasons to discard the work: retained-record scans, process-local rate limits, native PDF script/asset limitations, representative rather than exhaustive UI coverage, 18/43 enriched campaigns, and deferred real result email/CRM/Stripe. Accounts remain free. Release notes should distinguish those limits from passed local acceptance and should not claim complete competitive parity.

## Handoff

The safe next action is a clean, independently preserved **allowlisted release candidate**, followed by its own compiled checks and an explicit review of the actual remote/hosting state before any authorized push or deployment. Do not use the old checkout as the current source, and do not treat any existing archive as a ready-to-publish source bundle. This audit intentionally leaves both working trees, all recovery artifacts and all Git history untouched.
