# Creation starting page acceptance

The expected behavior below comes from the approved specification, independently of the component's implementation. Automated rendering and storage-contract checks live in `tests/creation-landing.cjs`. Browser checks must be performed against a compiled build with synthetic storage and external transports disabled. Static rendering does not prove responsive layout or interaction.

## Automated coverage

- Every enabled type displays a real authored template of the advertised type and its actual template title and example copy.
- Each type links to its filtered templates, typed AI destination, and typed guided destination; the AI return destination is accepted by the existing authentication helper.
- Blank links deliberately omit type so the existing builder asks again.
- Feature-gated types are absent from the chooser.
- Resume is absent without a valid supplied draft; otherwise the destination explicitly pins the displayed draft ID, independent of another tab changing the latest-draft pointer.
- Existing recovery tolerates absent, corrupt, and blocked storage. Rendering does not read browser storage, invoke selection, or mutate preview metadata.

## Independent browser scenarios

1. Open `/create` without storage. Personality is selected when enabled. No draft is created. Inspect all six types: each changes photograph, example result, explanation, next step and template destination without scrolling unexpectedly. Verify enabled-type fallback with outcome creation disabled.
2. Select Diagnostic, reload, and navigate Back after selecting Knowledge. The selected type and URL remain consistent. The main button opens only Diagnostic templates when Diagnostic is selected.
3. Click Start from blank while any type is selected. The next screen asks for type again, creates nothing until selection, and then opens an empty quiz of the newly chosen type. Reload restores that same blank draft.
4. Seed a traveller draft A, open `/create`, then change the latest-draft pointer to B in another tab. Resume must still open A as displayed. With no valid draft, hide the resume section while My quizzes remains reachable.
5. Test unavailable local/session storage, corrupt draft JSON, missing draft records and long draft titles. No starting-page crash; no fabricated resume destination.
6. Follow Create with AI as guest, complete mocked sign-in and verify selected type survives. Guided setup must also receive that type. Existing editor draft recovery and account saving continue to work.
7. Open a template, inspect its preview, then use it. Merely viewing creates no draft. Using creates a fresh ID; editing and reloading recovers that quiz without altering source templates or other drafts.

## Responsive and accessibility checks

Test 320, 390, 768, 834, 1024 and 1440 CSS pixels, landscape orientation, and 200% zoom. All labels wrap, no horizontal overflow, targets are at least 44px, photo crops preserve subjects, and image text remains readable. Desktop has two columns. Tablet wraps the shortcut strip. Mobile stacks all six choices and the preview, shows View example, and provides a safe-area bottom template action. The support widget and sticky CTA cannot cover each other or underlying controls.

Keyboard-only: all shortcuts, type choices, View example, secondary creation links and primary action are reachable with visible focus. Selection state is announced; moving type does not steal focus. View example moves to the relevant preview. Check reduced motion and screen-reader labels.

Capture the same desktop selected state as the approved source, compare together in one visual input, and repeat after any P0/P1/P2 fix. Capture mobile separately against the specified adaptation. Record browser/viewport, screenshot paths, console errors and findings. Chromium, Firefox and WebKit must be reported individually; unavailable environments remain explicit verification gaps.

## Integrated execution
Starting revision931a5e6. Lead integrated UI, metadata/assets and independent tests sequentially. QA findings (route prop sync, mobile reading order,320px image overflow) fixed. New acceptance, outcomes, templates, workspace, reliability, V2, TypeScript and webpack production build passed. Lint:0errors/67existingwarnings. Browser evidence and remaining matrix gaps are recorded in root design-qa.md. Cloud credentials disabled through isolated local runner; synthetic draft only. Final commit identifies source tested; no production deployment.

## Hover and image refinement
Mouse hover and keyboard focus preview a type without changing confirmed selection/history; click confirms it. Leaving the page content restores the confirmed preview. Touch selection remains click-based. Visible preview CTA follows the previewed type. Image layers remain mounted and eager-loaded; deduplicated local WebP assets bypass first-request transformation. Three new environment images contain hands/settings and no visible faces,960x640 at47–64KB each. Chrome verified actual mouse preview with unchanged URL/pressed selection, click confirmation, all4unique images fully loaded and empty error logs. New handler tests, templates/workspace suites, TypeScript, lint(0errors/67existingwarnings), production build passed. Screenshot /tmp/hover-preview.png. Not deployed.
