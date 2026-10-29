# Basic quiz builder — design 1 QA

final result: passed

Source visual: `/Users/cornevanwilligen/.codex/generated_images/01a17e8c-e612-7432-ae5c-558ddbaa6491/exec-511a1102-0382-48b4-a8d6-492be03470d8.png` (1487 × 1058 pixels).
Implementation: `http://127.0.0.1:3198/editor/quiz-oao2V9iPXP` (synthetic local account and data).
Evidence: `docs/basic-builder/screenshots/desktop.jpg` (1440 × 1000), `mobile.jpg` (390 × 844), `tablet.jpg` (768 × 1000). CSS and screenshot density 1. Source and desktop capture were opened together in one comparison input; they were compared proportionally, accounting for the retained 76px workspace header. The actual template uses the reference question as question 1, rather than the mock's illustrative question 5. No claim of pixel identity.

## Findings and resolution history

1. Missing utility styles in the prior webpack build: extended the existing Next CSS loader chain with the same Tailwind loader as Turbopack. Compiled CSS and actual rendering verified.
2. Oversized bold participant body/options and native progress: limited heading styles to headings and restored body typography; styled the native progress element.
3. Footer below viewport/support launcher overlap: bounded editor columns using the actual remaining flex height. Footer bottom 979px at 1000px viewport; Help & support remains in More editor tools while the floating launcher is hidden.
4. Mobile Advanced button clipped: mode switch now has its own full-width row; both targets measure 44px tall even at 320px.
5. Duplicate preview mounts: only the active desktop or compact modal preview mounts. Browser check found one preview and no duplicate IDs in the modal. Escape restores its trigger.
6. Excessively tall answer associations: points and result stay visible; optional reasons/exclusions/removal are under labelled details. Existing exclusions retain a visible badge. This preserves multiple mappings, unlike the simplified mock.

Final source/desktop/tablet comparison found no unresolved P0/P1/P2 presentation issues within the approved full-field scope. Focused control checks used browser screenshots and DOM geometry for mode controls, footer, points, preview controls and outline. All five steps use the same shell.

## Fidelity surfaces

- Typography: existing Pippi sans family, distinct headings/body/helper copy, corrected preview inheritance. Labels wrap on narrow screens.
- Layout: three desktop columns, two tablet columns with preview dialog, mobile question drawer. Stable desktop footer and independent scroll regions.
- Colours/tokens: warm neutral surfaces, restrained borders, burgundy selection/actions. Participant preview retains the quiz's own authored theme.
- Assets: existing Pippi SVG logo and library icons; no fabricated raster assets or screenshot UI. No new photography is necessary in this editor design.
- Copy: real template questions/results, explicit Appearance preview, correct scoring semantics and separate question/step navigation. Extra help/points and two navigation rows intentionally exceed the mock's simplified content.

## Acceptance and limits

Checked widths 320, 390, 768, 1024, 1440 with no document horizontal overflow. Checked 720×500 reflow equivalent to a 1440×1000 desktop at 200%; native browser zoom was not independently exercised. Keyboard activation, question drawer search, Escape/focus return, exact checklist target focus and full 30-question participant flow passed in the in-app Chromium browser. Firefox/WebKit are not exposed by this browser session and remain unverified, not passed. No production verification is implied by this local report.

P3 follow-up: optional future density tuning for questions with many associations. The complete fields necessarily require more vertical space than the illustrative single-result dropdown mock.
