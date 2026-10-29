# Pippi V2 design QA — 2026-10-29

Status: local implementation review complete; customer-release approval pending the staging and cross-browser gates in v2-rollout.md. No production deployment performed.

## Reference comparison

Reviewed both supplied Product Design PNGs alongside actual 1600×1050 browser captures: `v2-evidence/pippi-v2-editor.png` and `v2-evidence/pippi-v2-picker.png`. The captures are working application UI, not generated mockups. Reference filenames: exec-9f743f19-ffde-44f2-b007-fb2636fbcb21.png (editor), exec-7a82559e-9ec1-4f2c-897c-6b98262f36eb.png (picker), in the supplied generated_images directory.

The implementation preserves the charcoal rail, existing Pippi logo, burgundy actions, warm canvas, left outline, focused question editor, right inspector, and Build/Design/Connect/Results structure. The picker preserves insertion context, left categories, searchable two-column field choices, keyboard hints and close control. All 51 supported fields remain available.

## Findings resolved

- P1: Initial editor rendered too much Classic chrome and all questions at once. Replaced with selected-question presentation; page settings are collapsed and existing inspector reused.
- P2: Picker obscured the outline at desktop widths. Anchored it after the outline at wide widths.
- P2: Common question types were buried. Reordered first options while retaining every registered type and cross-category search.
- P1: Interleaved page storage could cause reorder to appear ineffective. Added visual-to-storage insertion mapping and regression cases; page-local arrow moves now respect displayed ordering.
- P2: SVG logo did not render in browser. Reused the existing logo artwork as a PNG asset.

## Intentional differences

Counts, publication status, names and field labels come from real state. The saved fixture has six questions after the verified insertion, not the five illustrative questions. Unsupported mock controls such as selection limits were not invented. Existing field-specific controls and editable answer inputs remain functional; scoring is exposed in the toolbar. Decorative background shapes were omitted. The inspector and supporting workflows retain existing working form controls rather than claiming pixel-identical reproduction. No unresolved blocker was observed in the two captured desktop states; this is not certification of every field/browser combination.

## Browser evidence

- Keyboard search → arrow → Enter inserted exactly one short-answer question after selected question 2, selected it, closed the dialog and focused its title.
- Renamed that question, confirmed save, published with existing readiness confirmation, completed all six questions through the real visitor renderer, and verified one stored response plus 1/1 completion in Results. Disposable local data only.
- Profile V2 → Classic → V2, template filtering and mobile help navigation checked by workspace agent.
- Shell-independent `/interface-recovery` → Use Classic successfully saved preference and redirected to Classic dashboard.
- Screenshots in `v2-evidence/`: editor, picker, results, profile, templates and mobile help.

## Remaining release checks

Full Chrome/Safari/Firefox matrix, tablet/editor mobile Flow/Edit/Settings checks, keyboard-only coverage of every panel, hosted session expiry/offline recovery and production-like staging integrations remain pending. A viewport override attempted during final editor review did not affect the captured tab, so no mobile-editor pass is claimed. Full remaining workspace visual audit must run on staging. Keep rollout off until the applicable gates pass.
