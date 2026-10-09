# Pippi search strategy and implementation

Updated 2026-10-09. US-English Ubersuggest research prioritized website quiz builders (590 estimated monthly searches, SD17) and interactive quiz builders (720, SD26). Estimates are directional; some returned histories ended December 2025. Lead generation is positioning, not a claim of high exact-match volume.

## Page ownership
- `/`: canonical public homepage; title Free Quiz Builder for Your Website | Pippi. Authenticated responses remain private dashboards with noindex.
- `/welcome`: public marketing view for signed-in users, canonicalized to `/`.
- `/lead-generation-quiz-builder`: lead capture, segmentation, quiz funnels.
- `/product-recommendation-quiz-builder`: product matching, exclusions, product destinations.
- `/scorecard-builder`: per-answer points, category advice, assessment interpretation.

Each public destination has unique titles, descriptions, canonical and social metadata. Shared metadata helpers live in lib/seo.ts. New use-case pages are server rendered and internally linked. Homepage includes factual WebSite JSON-LD; no invented ratings, reviews, or guaranteed rich-result claims.

Sitemap contains only the four canonical marketing URLs. Do not add account pages, drafts, customer quizzes, or /welcome. Last-modified dates are intentionally omitted rather than reset on every build.

Account, auth, builder, editor and player route layouts declare noindex/nofollow. This includes published user quizzes as a conservative default until creators have an explicit indexing opt-in. These directives do not replace authentication. API responses have X-Robots-Tag. Robots.txt allows crawling so noindex directives remain readable, per https://developers.google.com/search/docs/crawling-indexing/block-indexing . Canonicalization follows https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls .

## Validation
Production build and scoped ESLint passed. tests/seo.cjs verifies rendered canonical/OG metadata, unique titles, one H1 per public page, JSON-LD, sitemap, noindex, API headers, no browser errors, and no horizontal overflow at 390/1440px. Build packaging passed for 43 server traces. Desktop screenshots were visually reviewed.

## Remaining external work
Verify the domain in Google Search Console and submit https://www.pippiapp.com/sitemap.xml when deployed; inspect indexing and organic queries over time. This change does not claim Search Console submission, rankings, a full Core Web Vitals audit, backlinks, or keyword-volume guarantees. Use a separate review before enabling customer-quiz indexing. Future pages should have distinct useful content, not cloned keyword variants.
