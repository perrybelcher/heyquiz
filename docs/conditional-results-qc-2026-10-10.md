# Conditional results designer

## Behavior
Marketing → Results designer supports up to 12 reorderable text, image, testimonial, FAQ, CTA, and video sections. Existing quizzes are unchanged unless sections are added.

Each section can appear on every result, on a selected product/segment result, or within an inclusive overall/category score range. Server evaluation filters sections before saving or returning the result. A missing score never matches a range. Conditions and hidden sections are not returned to the visitor; content is also omitted from public question payloads. Scorecard overall conditions require score-based results to be enabled.

Videos accept supported HTTPS YouTube and Vimeo links, normalized to exact allowed embed hosts. No arbitrary iframe/HTML input. Embeds load only after an explicit visitor click; no autoplay is requested. Unsupported links and invalid/deleted condition targets prevent publication. New CTA sections use existing aggregate offer-click tracking.

## Validation
- Production build and TypeScript passed.
- Result section unit tests cover all three marketing types, outcome matching, 0/49/50/100 boundaries, unknown coverage, public redaction, invalid/deleted targets, URL rejection, duplicate IDs and draft/publication validation.
- Existing score-band regression passed.
- Browser verification is recorded below after completion.

## Limits
This release does not add video uploads, private Vimeo-link support, arbitrary embeds, PDF layout editing, or per-button analytics. Provider playback availability still depends on the video's own embedding/privacy settings. Browser video tests intercept the iframe with a fixture; they test Pippi's click-to-load behavior rather than external playback.

Playwright Chrome passed against a local production build: section editing, reordering, autosave/reload, publication, server-selected result content, FAQ rendering, video absence before click, correct embed URL after click, hiding the video when simulated scores change, CTA tracking, analytics segment and 390px overflow check. Initial run required correcting a test label selector. Screenshot: /tmp/pippi-result-sections.png.
