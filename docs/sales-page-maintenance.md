# Quiznick sales page maintenance

## Entry points and ownership

- `app/welcome/page.tsx` always renders the public sales page, even for signed-in users. It owns the canonical URL and social preview metadata.
- `app/page.tsx` resolves the session per request. Guests see the sales page; authenticated users receive their own dashboard. Keep this route dynamic and keep private form reads behind the user check.
- `components/SalesPage.tsx` is the shared server component. It owns the section order, static copy, navigation anchors, availability disclosures, and illustrative analytics.
- `components/JourneyShowcase.tsx` and `components/SalesDemo.tsx` are the only sales-page components that need client state.

## Public demos: important boundaries

Both demos use `marketingTemplate` and `evaluateMarketing`. They do not use the live quiz start/submit/contact endpoints, create attempts, send tracking events, or trigger CRM jobs. Answers are held only in React state and disappear on reload. Do not replace them with a live published quiz as a cosmetic change.

The journey showcase supplies fixed answers for product finder, segmentation, and scorecard templates. Its question and option IDs are coupled to `lib/marketing-templates.ts`. If those templates change, update the fixtures and verify all three outcomes. The apparent outcome CTA is deliberately a non-interactive illustration; it is not a checkout or working offer link.

The product finder lets visitors answer all three questions, return to previous questions, and restart. Its final step evaluates the current answers. A 17-inch laptop answer excludes all example bags and produces a fallback. Preserve this path: the demo should show that a responsible recommendation can be “no match.”

Focus moves to the new heading after an explicit step transition through a guarded layout effect. It must not move on initial mount. The heading remains outside the normal tab sequence with `tabIndex={-1}`. Do not restore the former animation-frame focus callback; it can race the next keyboard interaction.

## Styling and cascade

`components/SalesPage.css` is a global stylesheet with every product selector scoped to `.hq-sales-page`. The existing Next/Tailwind loader processes all CSS; earlier CSS-module `:global(...)` selectors were emitted unprocessed. Keep this stylesheet scoped unless the loader configuration is deliberately revisited.

The file is formatted into readable rules. Base layout, breakpoint rules, and later product-tour refinements retain their original order. Exact top-level selector/property declarations superseded by later declarations have been removed. Rules were not grouped across media queries or sorted: later base declarations can intentionally override earlier breakpoint rules, so moving them can change the mobile layout.

The main tokens are `--ink`, `--muted`, `--paper`, `--line`, and `--accent`. The palette uses warm ivory, charcoal, blue, and pale blue supporting surfaces. Supporting colors appear in individual illustration rules. Treat further token extraction or breakpoint consolidation as a visual refactor and compare computed styles before and after.

Preserve visible keyboard focus, reduced-motion rules, and labels adjacent to provider logos. Do not add hover-only information or motion that blocks interaction.

## Content and assets

- `public/quiznick-logo-v2.png` is the user-supplied transparent 150 × 50 logo. Avoid enlarging it significantly. A larger original or vector is preferable to invented upscaling.
- `public/images/quiz-bags.webp` is original generated artwork showing fictional example products, not a customer brand.
- Analytics figures are illustrative and labeled. They are not live customer performance or evidence of conversion uplift.
- CRM integrations are pilots requiring setup and authorization. Logos are provider identifiers, not endorsements or proof of a configured connection.
- Signup and password recovery use Supabase email confirmation. Production SMTP must be configured before inviting external testers. Do not promise pricing, free trials, or billing until those flows exist. See account-auth.md.
- The Vercel address still contains the legacy HeyQuiz name. Domain changes require updating canonical/social URLs and deployment configuration. Internal storage, auth, and integration identifiers were intentionally not renamed during the visual rebrand.

## Verification

From the app directory:

```sh
npx tsc --noEmit
npx eslint components/SalesPage.tsx components/SalesDemo.tsx components/JourneyShowcase.tsx app/page.tsx app/welcome/page.tsx
npm run build
npm run start -- --port 3135
```

In a separate terminal:

```sh
TEST_BASE_URL=http://127.0.0.1:3135 npm run test:browser-sales
```

The browser test is restricted to `127.0.0.1` and requires local authentication mode. It checks six widths, all three tour modes, product matches, exclusion fallback, back/restart, keyboard focus, FAQs, guest/authenticated routing, logo/image loading, and absence of quiz-submission requests. Screenshots go to the adjacent `outputs/salespage` directory when run from this app directory. Chrome is required; some sandboxed environments need approval to launch it.

For CSS reorganization, also compare computed styles at 320, 390, 768, 1024, 1440, and 2560 pixels. Disable motion when capturing visual baselines. A successful build alone does not establish that the appearance stayed unchanged.
