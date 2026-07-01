# Website Visual Test

Configurable Playwright visual comparison for checking the same pages across two website URLs.

## Quick Start

```sh
npm install
npx playwright install chromium
PORT=4317 npm run visual:ui
BASELINE_URL=https://satishkchoudhary.com TARGET_URL=http://localhost:3000 npm run visual:all
```

The full workflow discovers pages, captures baseline and target screenshots, writes diff images, and generates HTML and Markdown reports.

## Commands

```sh
npm run visual:ui
npm run visual:urls
npm run visual:crawl
npm run visual:test
npm run visual:report
npm run visual:all
```

CLI arguments override `.env` values:

```sh
npm run visual:all -- --baseline=https://example.com --target=https://preview.example.com
npm run visual:test -- --baseline=https://example.com --target=https://preview.example.com --page=/about --viewport=mobile
```

Reports are written to:

```text
visual-test-results/YYYY-MM-DD/run-###/
```

The latest run is also exposed at:

```text
visual-test-results/latest/
```

See [docs/visual-testing.md](docs/visual-testing.md) for configuration, masking, thresholds, and review guidance.

## URL Extraction

Run this before comparing when you want a clean URL inventory:

```sh
npm run visual:urls -- --baseline=https://redesign.lordabbett.com --target=https://www.lordabbett.com --url-source=sitemap --max-pages=100
```

Outputs:

```text
visual/urls.json
visual/urls.md
visual/pages.json
visual/pages.md
```

`visual:test` uses `visual/pages.json`, so the extracted URL set becomes the comparison checklist.
