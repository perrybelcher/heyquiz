# Visual brand kits — 12 October 2026

## Implemented locally

Creators can set their own brand name and logo, choose seven device font stacks independently for headings and body text, adjust readable type sizes and logo height, and hide Pippi attribution in the quiz. Quiz browser titles now use the quiz title; icon metadata uses the selected logo or a neutral quiz icon. Existing palette, font-family and corner settings remain compatible.

Visual kits are separate from marketing/offer briefs. A signed-in creator can save a kit, preview it before applying to a quiz, and explicitly confirm updating a reusable kit. Quizzes retain copied themes: updating a kit does not mutate existing drafts or published snapshots. Guests can customize a quiz but must sign in to save account-wide kits.

API records are scoped to the authenticated owner using existing server-only storage. No database migration, cloud/RLS change, provider or dependency was added. Origin checks, UUID validation, 16 KB payload limit, a 50-kit cap, image URL validation, and optimistic revision checks protect writes. Unsupported or credential-bearing logo URLs are rejected.

## Verification

- `tests/visual-brand-kits.cjs`: schema compatibility, safe URLs, accessible naming, typography bounds, independent snapshots, legacy font fallback and button contrast pass.
- `tests/browser-visual-brand-kits.cjs`: isolated local Playwright passes authentication/ownership/origin/validation checks; save, reuse, cancel and confirmed update; stale revision rejection; quiz independence; persisted/published logo and typography; mobile width; browser metadata; hidden header/footer attribution; and nested-picker Escape preserving unsaved theme edits.
- Existing `tests/browser-theme.cjs` passes cancel, hex validation, palette/font/corner persistence, publication rendering and mobile dialog width. Updated its route through the current guided Design step and added synthetic quiz cleanup.
- Targeted ESLint: zero errors.
- Independent agent review found and prompted fixes for nested-dialog Escape, missing responsive heading scaling, and inherited player metadata.
- Visual evidence inspected at 390 px; screenshots copied to the overnight evidence folder.
- Shared production build is tracked in `overnight-progress-2026-10-12.md`.

## Boundaries

Device font appearance varies by OS. No remote/custom font loader. Kits currently have save/update/reuse, not a management/delete screen. Browser-local automated tests do not certify remote storage or every browser. Real upload transport was not exercised in this batch. No production deployment or customer data was touched.
