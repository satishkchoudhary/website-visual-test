# Website Visual Test

Configurable Playwright visual comparison for checking the same pages across two website URLs.

## Quick Start

Use Node.js 18 or newer. The project is tested against Node 18, 20, and 22 on Linux, Windows, and macOS.

```sh
npm run setup
npm run visual:ui
npm run visual:all -- --baseline=https://satishkchoudhary.com --target=http://localhost:3000
```

The full workflow discovers pages, captures baseline and target screenshots, writes diff images, and generates HTML and Markdown reports.

## Dashboard GUI

Start the non-technical dashboard:

```sh
npm run visual:ui
```

Then open:

```text
http://127.0.0.1:4317/
```

The dashboard defaults to port `4317`. To use a different port, set `PORT` for your shell:

```sh
# macOS/Linux
PORT=4320 npm run visual:ui
```

```powershell
# Windows PowerShell
$env:PORT=4320; npm run visual:ui
```

```bat
:: Windows Command Prompt
set PORT=4320 && npm run visual:ui
```

The dashboard lets users:

- Enter baseline and target website URLs.
- Save and reload local project presets for repeat comparisons.
- Extract URLs from sitemap, crawl, or both.
- Run comparison from the current URL checklist.
- Run the full Extract + Compare workflow.
- Watch a live progress bar, current step, and timestamped job log.
- Run a system preflight check from the UI.
- Review URL inventory and past test runs.
- Open the latest report, historical reports, Markdown summaries, and downloadable ZIP bundles.

## Preflight

For a full first-time setup, run:

```sh
npm run setup
```

Run this before handing the tool to a new user or machine:

```sh
npm run preflight
```

The check verifies Node.js version, installed dependencies, Playwright Chromium, writable output folders, and dashboard port status. The dashboard also runs the same check in **System Check**.

The setup helper runs `npm install`, installs Playwright Chromium, then runs preflight. For faster local script testing, use flags such as `npm run setup -- --skip-install --skip-browser`.

## Node Compatibility

The supported runtime target is Node.js `>=18`.

Compatibility choices:

- npm scripts call `tsx` directly instead of `node --import tsx`, which keeps the commands working across Node 18, 20, and 22.
- GitHub Actions runs `npm test` on Node 18, 20, and 22 across Linux, Windows, and macOS.
- Project code should avoid Node-20-only APIs unless the `engines.node` range is intentionally raised.

## Commands

```sh
npm run setup
npm run preflight
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

The dashboard also shows previous runs in **Past Results**, including page count, comparison count, pass/fail/error totals, and links to each run's HTML report and Markdown summary.

Saved presets are written to `visual/presets.json`, which is ignored by git because presets may contain client URLs.

See [docs/visual-testing.md](docs/visual-testing.md) for configuration, masking, thresholds, and review guidance.

## URL Extraction

Run this before comparing when you want a clean URL inventory:

```sh
npm run visual:urls -- --baseline=https://example.com --target=https://www.example.com --url-source=sitemap --max-pages=100
```

Outputs:

```text
visual/urls.json
visual/urls.md
visual/pages.json
visual/pages.md
```

`visual:test` uses `visual/pages.json`, so the extracted URL set becomes the comparison checklist.

## Report Review

HTML reports include screenshot previews for baseline, target, and diff images. Click a preview to open it in a lightbox, then zoom in, zoom out, reset zoom, or open the PNG directly.

Use **Latest ZIP** or the ZIP links in **Past Results** to download a portable report bundle containing the HTML report, Markdown summary, screenshots, diffs, and metadata for a run.
