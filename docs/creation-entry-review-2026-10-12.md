# Creation entry and manual building — 12 October 2026

## Problem and resulting behavior

The public create route could silently reopen a guest wizard draft, hiding blank, template, and AI entry paths. A returning visitor could reasonably conclude that the wizard was the only supported approach.

The create route now always shows four distinct methods: Start blank, Use a template, Guided wizard, and Create with AI. Existing browser drafts have a separate Continue editing action. Shared workspace cards and homepage shortcuts expose the same methods early. Blank creation opens an empty manual editor with first-question buttons. The wizard gets a dedicated goal-selection route. AI gets an explicit entry page with free-account messaging and narrowly allowlisted auth returns.

Existing draft data is preserved when choosing another method. Session copies have recovery priority, corrupt copies fall back safely, and only a real reload of the matching builder document restores that route once. A client-side visit after reloading the chooser cannot accidentally reopen an old blank/wizard draft.

## Review evidence

The user’s Fillout blank editor and New Form chooser were visually reviewed without modifying a competitor form. Pippi’s live before-state was captured; revised screens were checked locally at desktop and mobile sizes. The external report and screenshots are in `outputs/pippi-creation-review-2026-10-12/Creation-Experience-Review.md` outside the release tree.

This improves discovery and the first manual action. The full Pippi editor still presents more simultaneous controls than Fillout. No claim is made that a usability study or complete competitor-parity test was performed.

## Validation

- Existing scoring/persistence regression suite: 25 checks passed.
- TypeScript: passed.
- Production build of the staged release checkout: passed with all cloud/AI/email settings disabled.
- New draft-recovery helper regressions: passed, including exact reload path, once-only restoration, storage failures, session precedence, and no pointer mutation.
- New auth-return regressions: passed. Only `/create/ai` and `/create/marketing` are accepted. Password reset and recovery remain authoritative.
- New creation browser flow: passed on isolated localhost data. All four methods remained visible on fresh/existing/reloaded chooser visits. Manual multiple-choice and short-answer creation, reload persistence, explicit wizard/resume, retained prior drafts, template preview, and AI account gate/sign-in return passed.
- Six accessibility/reflow scans reported zero violations on the new chooser/gate views. This is automated coverage of those views, not a whole-product accessibility certification.
- New auth browser suite: four groups passed with six mocked account requests, zero real emails, and zero AI calls; covers same-tab signup callback, immediate signup return, URL token stripping, and recovery/reset priority.
- Existing guest-builder and four-goal launch regressions passed with isolated test records and exact test-owned cleanup.
- New/changed creation files passed scoped ESLint with no warnings. Auth components retain three pre-existing image optimization warnings.

A title-only card accessibility label failed the initial scan and was replaced with its natural visible text. An initial local production build stalled under sandbox restrictions; the isolated rerun passed. Original test failures and rerun evidence are retained outside the repository.

## Limits and rollout state

These are local and staged-code results. Production has not been changed by this task. No live email, cloud signup, real AI generation, CRM, payment, customer record, or provider setting was touched. The existing AI generation API is reused, but only its entry/auth navigation was exercised here.

Signup confirmation opened in another tab can fall back to the workspace because the navigation preference is tab-scoped. The original sign-in link retains an explicit safe return destination.
