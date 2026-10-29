# Template library lifestyle assets

Prepared 29 October 2026. All four photographs are AI-generated editorial illustrations, not depictions of actual customers, products or businesses. No stock-service dependency or remote image request is required. Original generated PNGs are retained; only optimized derivatives are added to the app.

## Files and crops

Each image has a 1200 × 800 WebP cover at `/templates/lifestyle/{name}.webp` and a 600 × 400 thumbnail at `/templates/lifestyle/{name}-thumb.webp`. Derivatives preserve the original 3:2 framing, use WebP quality82, contain no embedded UI labels and have no fabricated text. Use real HTML for headings and controls. The original PNGs are1536 ×1024.

| Name | Suggested focal point | Alternative text | Cover / thumbnail bytes |
|---|---|---|---|
| workspace | 68% 48% | Person writing in a notebook at a sunlit studio desk | 62,108 /25,568 |
| travel | 67% 53% | Traveller overlooking a Mediterranean coastal village | 241,190 /82,726 |
| home | 58% 52% | Warm living room with natural wood, linen seating and plants | 199,530 /61,482 |
| coffee | 62% 57% | Ceramic coffee cup and filter-coffee carafe on a sunlit table | 111,208 /41,894 |

Focal points are initial `object-position` guidance; verify selected cover and compact row crops at desktop and mobile widths. No source photograph was stretched or replaced with a CSS illustration. All source images were visually inspected before export.

## Provenance

Generated with the built-in ImageGen tool for Pippi's selected photographic design direction:

- workspace: `/Users/cornevanwilligen/.codex/generated_images/01a17e8c-e612-7432-ae5c-558ddbaa6491/exec-f54cf1ad-744d-4f2c-a0f0-f8988d50b238.png`
- travel: `/Users/cornevanwilligen/.codex/generated_images/01a17e8c-e612-7432-ae5c-558ddbaa6491/exec-13114392-2da8-4e1a-82c8-fe1ff212e3b1.png`
- home: `/Users/cornevanwilligen/.codex/generated_images/01a17e8c-e612-7432-ae5c-558ddbaa6491/exec-85ec516d-a304-443f-87bb-364912c791b1.png`
- coffee: `/Users/cornevanwilligen/.codex/generated_images/01a187d1-0455-7040-9e05-d4cd9cdf97cd/exec-e3845547-c10b-4fdd-85b9-e4b3db615a9b.png`

Workspace, travel and home were supplied approved design assets. Coffee was generated during implementation to match their warm cream, oak, cocoa, sage and burgundy editorial art direction. Sharp was used only for resizing and WebP export, preserving source compositions.

Verification: all eight WebP outputs decoded successfully, dimensions were checked through Sharp metadata, and file sizes were measured. Combined optimized covers total614,036 bytes; all thumbnails total211,670 bytes. Rendering and responsive crop checks belong to integrated UI verification.
