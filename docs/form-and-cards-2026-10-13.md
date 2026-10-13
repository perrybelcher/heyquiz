# Form and Cards — 13 October 2026

- Creator presentation choices now read Cards · One question at a time and Form · Fields together by page.
- Cards automatically advance 250 ms after a valid single-choice selection. Text and multi-answer fields retain Next. Single-choice cards announce auto-advance; final cards explain that choosing submits when answer review is disabled.
- Next remains available for previously answered cards, optional fields and immediate-feedback explanations. Back allows answer changes. Form presentation never auto-advances after a field selection.
- Navigation resolves branching using the newly selected answers, not a stale render. Latest answers are updated before final-card submission. Pending timers are cancelled on manual Next, Back, page jumps, retake and unmount. Immediate grading pauses for its explanation.
- Local build and TypeScript passed. Chromium synthetic tests passed for fresh-answer branching, automatic navigation, Back/reselection, manual text Next and final answer persistence. Grouped form/help/walkthrough acceptance also passed. No production or real-provider verification and no deployment.
- Preview remains at http://127.0.0.1:3176/create/blank.
