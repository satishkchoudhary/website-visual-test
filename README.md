# Website Visual Test

Configurable Playwright visual comparison for checking the same pages across two website URLs.

## Quick Start

```sh
npm install
npx playwright install chromium
BASELINE_URL=https://satishkchoudhary.com TARGET_URL=http://localhost:3000 npm run visual:all
```

The full workflow discovers pages, captures baseline and target screenshots, writes diff images, and generates HTML and Markdown reports.

## Commands

```sh
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
