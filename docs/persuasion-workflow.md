# Persuasion-led quiz creation

The marketing studio now supports creator-side editing and a deterministic conversation review before saving. Question and option IDs remain stable during edits, preserving scoring. Compiler-generated answer reasons update with answer labels; custom reasons are left intact. Empty or duplicate answer labels cannot be saved from this preview.

Generation instructions ask for a sequence from goals through obstacles and decision criteria to genuine fit. The private purpose describes each question's role. Prompts are guidance, not a guarantee of model output quality or conversion lift.

The copy reviewer flags repeated questions, long titles, a small set of leading phrases, shaming language, promise-like claims, duplicate/blank answers and missing neutral choices. It is deliberately advisory: it is neither a complete language audit nor a scientific persuasion score. It does not modify answers, weights or consent. It runs locally for both AI and non-AI drafts.

Validation: compiler tests cover all three quiz modes and neutral-result handling; provider tests use mocks. The browser regression checks a leading phrase triggers a warning, revising it removes the warning, the edited title persists, and published scoring remains correct. Real Gemini generation and external CRM delivery still require production verification.

## Recovery improvements
Unsaved previews and edited copy are backed up in sessionStorage and validated against FormSchema before restoration. This is same-tab recovery, not cloud storage; closing the tab can clear it. Successful account save clears the local brief and preview. Simulation answers deliberately reset after reload. A storage failure shows a warning rather than implying backup succeeded.

AI network errors and timeouts now return actionable 502/504 messages; malformed provider JSON is handled as a failed draft rather than an unhandled parsing error. No automatic AI retry is performed, avoiding unexpected repeat generation costs.

Validated: provider failure fixtures (including timeout/network/malformed JSON), build, core scoring regressions, packaging, and six local Playwright suites covering marketing draft recovery, per-answer scoring, scorecard results, analytics, guest creation and sharing. CRM and Stripe are explicitly deferred. Live provider verification remains pending; the demo recording, experimentation/revenue features and independent beta usability assessment are not represented as complete.
