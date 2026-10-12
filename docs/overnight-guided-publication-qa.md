# Independent guided publication QA — batch18

12 October 2026. This lane owns only `tests/browser-guided-publication.cjs` and this note. Application fixes belong to the editor lane; the publication-receipt race and parser have a separate model/API owner. Root owns staging, builds and the local compiled server. No deployment or production readiness is implied.

## Preserved before evidence

The final batch17 candidate reproduced a broken ordinary-creator path: guided **Embed & Share** closed its confirmation but left the guided editor visible, with no Share heading or embed region and focus on BODY. A saved mobile title edit differed from the retained published title while the label still read **Saved · Published quiz**. The success overlay had no dialog semantics.

The isolated diagnostic, JSON result and three screenshots remain under [`guided-share-before`](../../pippi-overnight-2026-10-12/guided-share-before/). Its synthetic quiz and publication were cleaned up; it recorded zero respondent starts, experiment mutations, external requests and page errors. This is the evidence behind the [bounded improvement plan](overnight-after-evidence-priority.md), not a hypothetical feature request.

## Prepared independent browser checks

- Real `/create/blank` → guided creation of a choice question → account claim → save-first private preview. The initial blank is asserted to contain zero questions.
- Both readiness cancellation paths and an injected HTTP503 preserve a draft and produce no success dialog. A real publication followed by a malformed200 receipt produces an ambiguous-confirmation error, preserves the draft and requires a reload to establish the actual publication; the test does not equate an error with a failed server write.
- The real success dialog copies the exact URL on success, selects it on rejected/missing clipboard support, and does not claim Copied on failure. A delayed rejection preserves a newer deliberate focus selection.
- Embed & Share reaches the real Share heading, moves focus to it and exposes the established automatic/fixed/popup modes. Back to guided Publish returns to the correct step and focuses its heading without replacing the draft. A held animation-frame return must yield to a newer explicit guided step and title focus.
- Saved edits, reload and owner preview retain a separate draft/live title. Cancelled pause is nonmutating; actual pause removes the public snapshot; republish restores the same URL.
- Five native modal sessions exercise 1440/320/390px, Escape/Close/Done, forward/backward keyboard wrapping and both responsive resize directions. Mobile cases invoke the actual mobile Publish control, so its disappearance at desktop size tests the replacement-opener fallback.
- A second full flow selects an enriched template through the real library, edits its title and repeats claim/preview/publish/share/return. The retained publication must preserve its question definitions, scoring and result sections. Guided status and horizontal fit are checked at all three widths.
- Five scoped settled modal accessibility scans per engine record both violations and incomplete checks. Synthetic forms and their own retirement receipts are removed. The harness blocks and asserts zero public/preview starts, experiment mutations, providers and external requests; it also asserts no page errors.

Chrome and Firefox use ordinary Tab. On the existing macOS WebKit runtime, a preserved plain-HTML diagnostic in batch17 established that Option+Tab traverses all controls; this suite transparently records `Alt+Tab` / `Alt+Shift+Tab` for that engine. The final success dialog also explicitly handles ordinary Tab across its enabled controls; this suite does not separately claim a WebKit plain-Tab pass. It does not claim physical-device or screen-reader coverage.

## Current verification status

**Final compiled acceptance passed in Chrome, Firefox and WebKit.** The matching runtime was root's final batch18 build (`build-batch-18-final.log`, `candidate-runtime-source-batch-18-final.json`, local3164/session9851). Node syntax and scoped ESLint checks pass. Root/model-owned held-save and publication-receipt race tests are separate and should not be counted as cases from this browser suite.

| Final engine | Grouped creator checks | Focus assertions | Scoped modal scans | Violations / incomplete |
| --- | ---: | ---: | ---: | ---: |
| Chromium, installed Chrome channel | 5 | 28 | 5 | 0 / 0 |
| Firefox | 5 | 28 | 5 | 0 / 0 |
| WebKit | 5 | 28 | 5 | 0 / 0 |

These repeat the same cases across engines, not15 unique feature groups. Every run recorded zero public/preview starts, experiment mutations, provider/external requests and page errors. All six created quizzes across the three runs were removed with200 responses; their form and publication records were confirmed absent. The captured own retirement receipts were also removed.

Final logs, full results, screenshots and cleanup details are under [`guided-publication`](../../pippi-overnight-2026-10-12/compiled-verification-batch-18/guided-publication/), in `chromium-final`, `firefox-final` and `webkit-final`. Six selected final screenshots were visually inspected: Chrome320 confirmation,390 Share and320 guided Publish; Firefox390 confirmation; WebKit320 confirmation and390 Share. They show readable confirmation actions, a real sharing destination and explicit publication state. This is selected visual evidence, not every scroll position or device.

The first strict Chromium run needed a test-only locator correction: the503 message is direct text inside its alert rather than a nested element. Initial log, screenshot and result were preserved. The second strict run reproduced an actual return-focus defect: Share worked, but Back to guided Publish displayed step5 without focusing its heading. The UI owner fixed the mount/commit timing with a separately guarded post-commit focus request. The strict heading assertion remains.

An explicitly authorised external diagnostic bypassed only that known return-heading assertion to inspect later behavior. It completed24 other focus assertions and5 scoped scans with zero violations, and the remaining clipboard/status/pause/resize/template flows passed. Its JSON explicitly records `acceptance: false`; this is **not acceptance evidence**. All final strict runs retained the return-heading assertion and added the superseded-return cancellation check; both passed.

Run from the staged candidate only after root starts the matching compiled build:

```sh
BROWSER=chromium TEST_BASE_URL=http://127.0.0.1:3164 \
HEYQUIZ_DATA_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/release-test-data \
ARTIFACT_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/compiled-verification-batch-18/guided-publication/chromium \
node tests/browser-guided-publication.cjs
```

Use the same explicit local environment with all cloud aliases blank for Firefox and WebKit, changing the engine and evidence directory. Preserve initial failures and use the same strict assertions on retries. Repeated engine runs are the same behavioral coverage, not three distinct feature sets.

The suite does not cover live authentication mail, actual host embedding, arbitrary creator data, other-tab publication transactions or unaided human usability. Existing publication/embed regressions and the original human/production release gates remain separate.
