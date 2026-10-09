# Product design refresh — 2026-10-10

Redesigned the workspace overview, quiz starter cards, library surfaces, guided editor navigation/sheet, and conversion analytics. Shared styling is scoped to product surfaces so respondent theme settings remain independent. Palette: warm ivory, deep red, charcoal, muted green; consistent borders, spacing, and restrained depth.

Reporting adds a completion summary and tracking coverage from existing analytics values. No changes to calculation or attribution semantics. Conversion funnel, daily activity, question performance, segments, date filters, export, measurement notes and empty/error states remain available. Synthetic session screenshots are not customer performance claims.

Visual inspection found mobile advanced-toolbar clipping; tabs now scroll and actions wrap, with bounded vertical scrolling for smaller screens. Reduced-motion handling and keyboard focus styles remain in place. This is not a full accessibility certification.

Validation: production build and TypeScript; 15 analytics API/browser checks including date range, CSV, empty/error handling, tracking deduplication and mobile overflow; guided editor state/save/theme regression; desktop/mobile workspace and reporting screenshots with synthetic local sessions. Visual artifacts in /tmp/pippi-workspace-desktop.png, /tmp/pippi-workspace-mobile.png, /tmp/pippi-report-desktop.png, /tmp/pippi-report-mobile.png, /tmp/pippi-report-detail-mobile.png.

Public reference research: perspective.co, scoreapp.com, involve.me product pages. No claim that authenticated competitor applications were fully audited or that aesthetic superiority has been objectively established. Human usability sessions remain necessary.
