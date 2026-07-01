# Visual Comparison Testing

This project compares two configurable website URLs page by page across desktop, tablet, and mobile viewports. It is useful for production vs staging, production vs local, preview vs production, or any two public/custom domains.

## Setup

Use Node.js 18 or newer. The repository is checked against Node 18, 20, and 22 on Linux, Windows, and macOS in CI.

```sh
npm install
npx playwright install chromium
npm run preflight
```

Create a local `.env` file if you do not want to pass URLs every time:

```text
BASELINE_URL=https://satishkchoudhary.com
TARGET_URL=http://localhost:3000
VISUAL_MAX_PAGES=100
VISUAL_THRESHOLD=0.01
```

CLI arguments override `.env` and `visual.config.ts`.

## Main Workflow

```sh
BASELINE_URL=https://satishkchoudhary.com TARGET_URL=http://localhost:3000 npm run visual:all
```

Equivalent CLI form:

```sh
npm run visual:all -- --baseline=https://satishkchoudhary.com --target=http://localhost:3000
```

`visual:all` runs:

1. Crawl baseline pages.
2. Capture baseline and target screenshots.
3. Generate diff screenshots.
4. Generate HTML and Markdown reports.
5. Exit nonzero when differences exceed the configured threshold.

Reports are still generated when visual differences fail.

## Commands

```sh
npm run visual:ui
npm run visual:urls
npm run visual:crawl
npm run visual:test
npm run visual:report
npm run visual:all
```

## Local GUI

Start the local dashboard:

```sh
npm run visual:ui
```

Open:

```text
http://127.0.0.1:4317/
```

The dashboard supports system preflight checks, saved local presets, URL extraction, comparison from the current checklist, and the full extract-plus-compare workflow. It serves URL inventories, page checklists, and the latest HTML report from the same generated folders used by the CLI.

Presets are saved to `visual/presets.json`. That file is ignored by git because presets may contain client URLs.

Use a dry run to verify configuration without launching the browser:

```sh
npm run visual:crawl -- --baseline=https://example.com --target=https://preview.example.com --dry-run --json
```

## Preflight

Run preflight before handing the project to a new user or machine:

```sh
npm run preflight
```

The check verifies Node.js version, installed dependencies, Playwright Chromium, writable output folders, and dashboard port status. Use JSON output for automation:

```sh
npm run preflight -- --json
```

## URL Extraction Step

Use `visual:urls` when you want a visible URL inventory before screenshots are taken.

```sh
npm run visual:urls -- --baseline=https://example.com --target=https://www.example.com --url-source=sitemap --max-pages=100
```

The extractor writes:

```text
visual/urls.json
visual/urls.md
visual/pages.json
visual/pages.md
```

`visual/pages.json` is the checklist consumed by `visual:test`, so this is the recommended reviewable sequence:

```sh
npm run visual:urls -- --baseline=https://example.com --target=https://www.example.com --url-source=sitemap --max-pages=100
npm run visual:test -- --baseline=https://example.com --target=https://www.example.com
npm run visual:report
```

Available URL sources:

| Source | Behavior |
| --- | --- |
| `crawl` | Launches Playwright and follows same-origin links from the baseline URL. |
| `sitemap` | Fetches configured sitemap XML files and extracts matching paths without launching a browser. |
| `both` | Reads sitemap URLs and merges them with browser crawl discovery. |

Configure sitemap files:

```sh
npm run visual:urls -- --baseline=https://example.com --target=https://preview.example.com --url-source=sitemap --sitemaps=/sitemap.xml,/custom-sitemap.xml
```

Some sitemap indexes reference the target/public host even when the baseline is a redesign or preview host. The extractor accepts paths from either the baseline or target origin, then rebuilds both comparison URLs from the same path.

## One Page Or One Viewport

Test one page:

```sh
npm run visual:test -- --baseline=https://example.com --target=https://preview.example.com --page=/about
```

Test one viewport:

```sh
npm run visual:test -- --baseline=https://example.com --target=https://preview.example.com --page=/about --viewport=mobile
```

Default viewports:

| Name | Size |
| --- | --- |
| desktop | 1440x900 |
| tablet | 768x1024 |
| mobile | 390x844 |

Override viewports:

```sh
npm run visual:all -- --baseline=https://example.com --target=https://preview.example.com --viewports=desktop:1440x900,mobile:390x844
```

## Crawling Rules

The crawler starts from `BASELINE_URL`, follows same-origin links, normalizes duplicate paths, ignores media/static files, and writes:

```text
visual/pages.json
visual/pages.md
```

Control page scope:

```sh
npm run visual:crawl -- --baseline=https://example.com --target=https://preview.example.com --max-pages=25
npm run visual:crawl -- --baseline=https://example.com --target=https://preview.example.com --include=/blog/** --exclude=/tag/**,/feed/**
```

## Thresholds

`VISUAL_THRESHOLD` is the allowed mismatch percentage as a decimal.

```sh
VISUAL_THRESHOLD=0.01 npm run visual:all
```

`0.01` means 1 percent. The pixel-level channel threshold defaults to `16` and can be changed with:

```sh
npm run visual:all -- --pixel-threshold=20
```

## Dynamic Elements

Use masks for areas that should be visually ignored but still occupy layout space:

```html
<div data-visual-mask>Current time</div>
```

Use hidden selectors for items that should not appear in screenshots:

```html
<div data-visual-hide>Rotating promo</div>
```

You can also configure selectors in `visual.config.ts`:

```ts
maskSelectors: ["[data-visual-mask]", ".ad-slot"],
hideSelectors: ["[data-visual-hide]", ".live-chat-widget"],
```

Cookie banner handling is configured as selector placeholders in `visual.config.ts`. Add site-specific accept or dismiss selectors when needed.

## Output Structure

Each run writes:

```text
visual-test-results/
  2026-07-01/
    run-001/
      home/
        mobile/
          baseline.png
          target.png
          diff.png
          metadata.json
      run.json
      index.html
      summary.md
```

Open `index.html` for a reviewer-friendly report. Use `summary.md` for GitHub comments or manual sharing.

## Troubleshooting

- Missing browser: run `npx playwright install chromium`.
- Local target unavailable: start your local server before running `visual:test` or `visual:all`.
- False positives from animation: add a mask/hide selector or use a more stable wait selector.
- Slow pages: increase `VISUAL_TIMEOUT_MS` or pass `--timeout=60000`.
- Query-heavy pages: keep query crawling disabled by default; pass `--allow-query` only when those URLs are intentional.
- No pages found: check include/exclude patterns and confirm the baseline page links to crawlable internal URLs.
