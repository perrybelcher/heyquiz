# Image and choice scoring controls

Image choices now show answer-level scoring beside the image in Advanced, for
both single-image and multiple-image questions. The controls edit existing
marketing rules; question, answer and rule identifiers remain stable. Basic's
current association editor is preserved, including blank versus scored zero.

Advanced also exposes explicit correct-answer controls for segmented, switch,
thumbs and like/dislike questions. A survey's switch preview no longer changes
its hidden knowledge answer key when clicked. Existing knowledge-image answer
keys and question points remain supported.

Points and exclusion associations can coexist. Exclusions take precedence in the
controls and the scoring engine. Toggling an exclusion preserves the original
points association and restores it when the exclusion is removed. Other rules,
IDs and reasons are retained. No schema or scoring-engine change is required.

Numeric ratings, NPS, sliders and matrices do not gain new scorecard mappings in
this release. Unsupported fields explain the existing choice-field requirement;
display-only elements do not display a misleading scoring warning.

## Verification

- `npm run test:image-scoring`: all ten choice types; image/text parity, correct
  answers, partial credit, penalties, duplicate choices, zero and neutral evidence.
- Existing scoring/analytics, scorecard, guided-editing, Basic-field and independent
  Basic acceptance tests, core regression suite, TypeScript and production build.
- Targeted ESLint: no errors; existing editor unused-import/image warnings remain.
- `npm run test:browser-image-scoring` requires an explicit loopback
  `TEST_BASE_URL`, isolated `HEYQUIZ_DATA_DIR` and `ARTIFACT_DIR`. The server must
  have local authentication and `PIPPI_INTERFACE_ROLLOUT=default-v2`, all cloud
  storage aliases disabled, and external provider traffic blocked.
- The browser matrix uses eighteen synthetic quizzes across Classic and V2. It
  edits, saves, reloads and switches Basic/Advanced, checks mobile overflow,
  exercises exclusion precedence and restoration, and submits real preview
  attempts to verify the server's final score. It does not publish quizzes or
  send real contacts, emails or provider events.

Deployment and read-only production smoke verification are separate release
steps; local test success alone is not evidence that a feature is live.
