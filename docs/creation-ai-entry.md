# Explicit AI creation entry

The `/create/ai` server page now checks the current session and renders an explicit free-account gate for guests. It offers two distinct paths: marketing recommendations/scorecards at `/create/marketing`, or a knowledge-quiz brief. The marketing page has the same explicit gate instead of an unexplained redirect. Server-side authentication remains enforced by the existing APIs.

Authenticated knowledge creation reuses `/api/agent/generate` with only `topic` and `numQuestions`. No request runs automatically. The brief accepts 3–4,000 characters; the UI offers 5, 10, 15 or 20 questions. An in-flight guard prevents repeated submissions, generated drafts are saved by the existing API, and navigation uses a validated form ID plus the expected matching editor route. The copy asks the creator to review questions and the answer key before publishing. Nothing publishes automatically. An unavailable AI configuration offers a return to manual/template creation, and marketing retains its existing starter fallback. No provider keys are exposed to the client.

## Authentication return

`lib/creation-auth-return.ts` permits exactly `/create/ai` and `/create/marketing`. Foreign URLs, protocol-relative/backslash paths, suffixes, fragments, query strings, repeated `next` parameters, and other paths are not accepted. Sign-in honors the explicit query destination. Links between signup, sign-in and confirmation resend retain that allowlisted destination.

Signup/resend remembers only the navigation destination and a 24-hour expiry in sessionStorage. A successful ordinary signup callback can consume it once. It contains no credentials or authorization tokens. The existing PKCE exchange and early URL-code stripping remain unchanged. Password recovery keeps `/reset-password`; reset completion keeps its existing sign-in flow and takes precedence over a creation preference. An explicit invalid `next` cannot fall back to a previous stored value.

This return preference is tab-scoped. A confirmation opened in a separate tab/browser, blocked storage, or an expired preference returns to the normal workspace. The signup page's explicit sign-in link still contains the intended destination. This does not weaken the existing browser-bound authentication requirement or promise cross-device continuity. No backend auth or signed-flow contract changed.

## Validation

- `node tests/creation-auth-return.cjs`: passed exact-path, duplicate/foreign rejection, explicit destination/reset precedence, one-use callback return, recovery preservation, expiry/corruption, blocked storage and separate-tab fallback.
- `npx tsc --noEmit --incremental false`: passed on combined active source. Targeted ESLint: zero errors; three existing image-element warnings in the auth components, no new warnings.
- `tests/browser-creation-auth-return.cjs` on isolated local port 3170: four groups passed, covering guest gate/no automatic AI, same-tab callback with early URL stripping, immediate signup marketing return, and recovery/reset precedence. Six mocked account actions, zero AI requests and zero real emails. Mobile screenshot inspected at 390px: readable cards and controls, no clipping. Evidence: `../pippi-creation-review-2026-10-12/tests/creation-auth-final.log` and `tests/creation-auth/`. The first attempt failed at sandbox Chrome launch before any page; its log is retained.
- Creation chooser/browser integration is tested by the independent creation QA lane after the parent compiles the combined source. No real AI calls or emails are part of these tests.

## Scope and limitations

No existing drafts are read, deleted or replaced by this page. The AI brief itself is not persisted across a lost session or navigation; the page preserves typed input on ordinary request errors. An uncertain response may already have created a saved draft, so the UI provides a workspace check rather than automatically retrying. The existing API's operational request/model limits remain unchanged.
