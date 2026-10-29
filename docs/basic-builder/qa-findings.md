# Independent Basic builder QA

Reviewed specification independently against integrated source. No evaluator-derived expected answers; literal fixture expectations are in `tests/basic-independent-qa.cjs`.

## Resolved findings

- **P1 Preview transport side effects:** image upload and audio recording mounted `AttachmentField`; file-only guard was incomplete. Author now guards all three attachment types, captcha and embedded video. Tests throw if guarded components mount.
- **P1 Existing add/exclude rules overwritten:** valid paired add/exclude mappings share question/answer/target; editing by tuple selected the wrong rule. Author added exact rule-ID editing and collision protection. Independent paired-rule fixture confirms exclusion stays authoritative and clearing one preserves the other.
- **P1 Cross-step checklist navigation race:** selected-question callback rewrote captured Basic UI state after step change. Lead separated selection from state overwrite. Browser cross-step focus check remains with lead.
- **P2 Duplicate question heading:** both controller and question editor rendered Question X of Y headings. Lead removed redundant heading.
- **P2 Blank score band coercion:** clearing existing shared band range became zero via Number(''). Author now retains previous numeric value for blank and rejects noninteger/out-of-range band values.

## Pending review at handoff

- **P2 Duplicate preview mounts:** shell mounts desktop and dialog preview simultaneously; participant controls use field/question IDs for DOM IDs and radio group names. Lead notified to mount only the visible preview or namespace isolated instances.
- **P2 Knowledge appearance fields:** preview omitted editable badge/CTA. Preview author notified and preparing fix.

## Executed acceptance

`node tests/basic-independent-qa.cjs`: **6 groups passed**.

- Literal multiple mappings, valid add+exclude pair, exact rule edits, neutral clearing.
- Scorecard zero versus unscored blank, incomplete coverage and full score.
- Actual knowledge question editor handlers: points, cleared points, explanation/key preservation.
- Actual feedback editor handlers: score range changes and blank preservation.
- All six authored comprehensive templates: question 30 edit, reorder, serialize/reload model, delete and valid references.
- Qualification renamed answer IDs, numeric boundary 50/51, unknown inputs and question deletion cleanup.

Browser screenshots, responsive/keyboard checks, integration mode/reload/publication flow and final design comparison are owned by the lead. This source/fixture review does not claim those have passed.

## Final resolution

Both presentation findings are resolved: responsive shell mounts only the visible preview, and knowledge appearance includes configured badge/CTA. The lead verified a single preview instance and no duplicate DOM IDs in the mobile dialog, plus exact question-30 checklist focus across steps. Visual revisions corrected oversized preview text, footer overflow, and clipped mobile mode controls. Floating support is replaced by Help & support in More editor tools while Basic is open.
