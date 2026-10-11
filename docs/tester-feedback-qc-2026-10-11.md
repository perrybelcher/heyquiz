# Tester feedback fixes — 2026-10-11

Autosave now retries interrupted authenticated edits on online, focus, and visibility-return events. Automatic retry skips known conflict/validation failures and uses the same revision checks as normal saves. Guest drafts still require explicit account/save action. Local-backup status is based on successful browser writes for the current form fingerprint; it does not claim server persistence. Both editor modes distinguish local-only saving when authentication is required. Existing unsaved-navigation warnings remain.

Workspace action popup dismisses on outside pointer interaction or Escape; Escape restores trigger focus. Missing AI configuration now explains service unavailability instead of telling ordinary users to enter a server API key.

Checks: TypeScript, production build, browser-tester-feedback.cjs (Escape/focus/outside dismissal, expired session with local copy, automatic resume after sign-in, network failure and online resume), browser-draft-protection.cjs (two-tab isolation, reload recovery, successful restore, stale revision rejection and unavailable storage warnings). Synthetic local data only. No database schema changes. Event-driven retries do not claim proactive session refresh or background timed retries.
