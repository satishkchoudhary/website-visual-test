import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { ComparisonResult, VisualConfig, VisualRunResult } from "./types.js";
import { readJson, writeText } from "./lib/files.js";

export interface ReportOutputs {
  runDir: string;
  htmlPath: string;
  markdownPath: string;
}

export async function generateReports(
  config: VisualConfig,
  currentRun?: VisualRunResult,
): Promise<ReportOutputs> {
  const runDir = currentRun?.runDir ?? await resolveRunDir(config);
  const run = currentRun ?? await readJson<VisualRunResult>(path.join(runDir, "run.json"));
  const htmlPath = path.join(runDir, "index.html");
  const markdownPath = path.join(runDir, "summary.md");

  await writeText(htmlPath, renderHtmlReport(run));
  await writeText(markdownPath, renderMarkdownReport(run));

  return { runDir, htmlPath, markdownPath };
}

async function resolveRunDir(config: VisualConfig): Promise<string> {
  if (config.runDir) return config.runDir;

  const latestPath = path.join(config.outputDir, "latest");
  try {
    return await realpath(latestPath);
  } catch {
    // Fall back below.
  }

  try {
    const latestText = await readFile(path.join(config.outputDir, "latest.txt"), "utf8");
    return latestText.trim();
  } catch {
    // Fall back below.
  }

  const dateDirs = await readdir(config.outputDir, { withFileTypes: true }).catch(() => []);
  const candidates: string[] = [];

  for (const dateDir of dateDirs) {
    if (!dateDir.isDirectory()) continue;
    const datePath = path.join(config.outputDir, dateDir.name);
    const runDirs = await readdir(datePath, { withFileTypes: true }).catch(() => []);
    for (const runDir of runDirs) {
      if (runDir.isDirectory() && /^run-\d+$/.test(runDir.name)) {
        candidates.push(path.join(datePath, runDir.name));
      }
    }
  }

  candidates.sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error(`No visual run found in ${config.outputDir}. Run npm run visual:test first.`);
  return latest;
}

function renderHtmlReport(run: VisualRunResult): string {
  const rows = run.results.map((result) => resultRow(run.runDir, result)).join("\n");
  const failed = run.results.filter((result) => result.status === "failed" || result.status === "error");
  const failedList = failed.length
    ? failed.map((result) => `<li>${escapeHtml(result.path)} / ${escapeHtml(result.viewport.name)}: ${escapeHtml(statusLabel(result))}</li>`).join("\n")
    : "<li>No failed comparisons.</li>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Visual Comparison Report</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      body {
        margin: 0;
        background: #f7f8fb;
        color: #172033;
      }
      header, main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 24px;
      }
      header {
        padding-top: 32px;
      }
      h1, h2 {
        margin: 0 0 12px;
      }
      .meta, .summary, .review, table {
        background: #fff;
        border: 1px solid #dde3ee;
        border-radius: 8px;
        box-shadow: 0 1px 2px rgb(16 24 40 / 6%);
      }
      .meta, .review {
        padding: 16px;
        margin: 16px 0;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1px;
        overflow: hidden;
        margin: 20px 0;
      }
      .metric {
        padding: 16px;
        background: #fff;
      }
      .metric strong {
        display: block;
        font-size: 28px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
      }
      th, td {
        border-bottom: 1px solid #e6ebf2;
        padding: 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #eef3f8;
        font-size: 13px;
      }
      tr:last-child td {
        border-bottom: 0;
      }
      tr[hidden] {
        display: none !important;
      }
      .status-passed {
        color: #067647;
        font-weight: 700;
      }
      .status-failed, .status-error {
        color: #b42318;
        font-weight: 700;
      }
      .status-skipped {
        color: #6941c6;
        font-weight: 700;
      }
      .result-tools {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 12px;
        margin: 0 0 12px;
      }
      .segmented {
        display: flex;
        flex-wrap: wrap;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
      }
      .segmented button {
        border: 0;
        border-right: 1px solid #cbd5e1;
        padding: 9px 12px;
        background: #fff;
        color: #152033;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
      }
      .segmented button:last-child {
        border-right: 0;
      }
      .segmented button[aria-pressed="true"] {
        background: #1769aa;
        color: #fff;
      }
      .segmented span {
        margin-left: 4px;
        font-size: 12px;
        opacity: 0.8;
      }
      .result-search {
        display: grid;
        gap: 6px;
        min-width: min(320px, 100%);
        color: #344054;
        font-size: 12px;
        font-weight: 800;
      }
      .result-search input {
        min-height: 38px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        color: #152033;
        font: inherit;
      }
      .result-search input:focus,
      .segmented button:focus-visible {
        outline: 3px solid #1b75bb;
        outline-offset: 2px;
      }
      .filter-count {
        color: #475467;
        font-size: 13px;
        font-weight: 800;
      }
      .empty {
        color: #667085;
        padding: 22px;
        text-align: center;
      }
      .shots {
        display: grid;
        grid-template-columns: repeat(3, minmax(130px, 1fr));
        gap: 10px;
        min-width: 420px;
      }
      figure {
        margin: 0;
      }
      figcaption {
        margin-bottom: 6px;
        color: #49566a;
        font-size: 12px;
        font-weight: 700;
      }
      img {
        max-width: 100%;
        border: 1px solid #d3dae6;
        border-radius: 6px;
        background: #fff;
      }
      .shot-button {
        display: block;
        width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: zoom-in;
        text-align: left;
      }
      .shot-button:focus-visible {
        outline: 3px solid #1b75bb;
        outline-offset: 3px;
        border-radius: 8px;
      }
      .lightbox {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: none;
        grid-template-rows: auto 1fr;
        background: rgb(8 13 24 / 88%);
        color: #fff;
      }
      .lightbox[data-open="true"] {
        display: grid;
      }
      .lightbox-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-bottom: 1px solid rgb(255 255 255 / 16%);
        background: rgb(8 13 24 / 92%);
      }
      .lightbox-title {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 700;
      }
      .lightbox-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lightbox-controls button,
      .lightbox-controls a {
        min-width: 38px;
        border: 1px solid rgb(255 255 255 / 28%);
        border-radius: 6px;
        padding: 7px 10px;
        background: rgb(255 255 255 / 10%);
        color: #fff;
        font: inherit;
        text-align: center;
        text-decoration: none;
      }
      .lightbox-controls button {
        cursor: pointer;
      }
      .lightbox-stage {
        overflow: auto;
        padding: 22px;
      }
      .lightbox-image {
        display: block;
        width: 100%;
        max-width: none;
        margin: 0 auto;
        border: 0;
        border-radius: 4px;
        background: #fff;
      }
      code {
        background: #eef3f8;
        border-radius: 4px;
        padding: 2px 4px;
      }
      .url-pair {
        display: grid;
        gap: 6px;
        min-width: 240px;
      }
      .url-pair span {
        color: #49566a;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .url-pair a {
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        header, main {
          padding: 16px;
        }
        table, tbody, tr, td {
          display: block;
        }
        thead {
          display: none;
        }
        tr {
          border-bottom: 1px solid #d9e0eb;
        }
        .shots {
          min-width: 0;
          grid-template-columns: 1fr;
        }
        .lightbox-bar {
          align-items: flex-start;
          flex-direction: column;
        }
        .lightbox-controls {
          flex-wrap: wrap;
        }
        .result-tools {
          align-items: stretch;
          flex-direction: column;
        }
        .segmented {
          width: 100%;
        }
        .segmented button {
          flex: 1 1 auto;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Visual Comparison Report</h1>
      <div class="meta">
        <p><strong>Run:</strong> <code>${escapeHtml(run.runDir)}</code></p>
        <p><strong>Started:</strong> ${escapeHtml(run.startedAt)} &nbsp; <strong>Completed:</strong> ${escapeHtml(run.completedAt)}</p>
        <p><strong>Baseline:</strong> ${escapeHtml(run.baselineUrl)}</p>
        <p><strong>Target:</strong> ${escapeHtml(run.targetUrl)}</p>
        <p><strong>Threshold:</strong> ${formatPercent(run.threshold)}</p>
      </div>
      <section class="summary" aria-label="Run summary">
        ${metric("Pages", run.summary.pages)}
        ${metric("Comparisons", run.summary.comparisons)}
        ${metric("Passed", run.summary.passed)}
        ${metric("Failed", run.summary.failed)}
        ${metric("Skipped", run.summary.skipped)}
        ${metric("Errors", run.summary.errors)}
      </section>
    </header>
    <main>
      <section class="review">
        <h2>Needs Review</h2>
        <ul>
          ${failedList}
        </ul>
      </section>
      <h2>Comparison Details</h2>
      <div class="result-tools" data-result-filters>
        <div class="segmented" role="group" aria-label="Filter results by status">
          ${statusFilterButton("all", "All", run.summary.comparisons, true)}
          ${statusFilterButton("failed", "Failed", run.summary.failed)}
          ${statusFilterButton("passed", "Success", run.summary.passed)}
          ${statusFilterButton("error", "Errors", run.summary.errors)}
          ${statusFilterButton("skipped", "Skipped", run.summary.skipped)}
        </div>
        <label class="result-search">Search
          <input id="resultSearch" autocomplete="off" placeholder="Page, viewport, URL, or note">
        </label>
        <span id="resultFilterCount" class="filter-count"></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Final URLs</th>
            <th>Viewport</th>
            <th>Status</th>
            <th>Mismatch</th>
            <th>Time</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr id="resultNoMatches" hidden><td class="empty" colspan="7">No results match.</td></tr>
        </tbody>
      </table>
    </main>
    <div class="lightbox" id="lightbox" aria-modal="true" role="dialog" aria-label="Screenshot preview">
      <div class="lightbox-bar">
        <div class="lightbox-title" id="lightboxTitle"></div>
        <div class="lightbox-controls">
          <button type="button" data-zoom="out" aria-label="Zoom out">-</button>
          <button type="button" data-zoom="reset" aria-label="Reset zoom">100%</button>
          <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
          <a id="lightboxOpen" href="#" target="_blank" rel="noreferrer">Open PNG</a>
          <button type="button" data-lightbox-close aria-label="Close preview">Close</button>
        </div>
      </div>
      <div class="lightbox-stage" id="lightboxStage">
        <img class="lightbox-image" id="lightboxImage" alt="">
      </div>
    </div>
    <script>
      (() => {
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightboxImage");
        const title = document.getElementById("lightboxTitle");
        const openLink = document.getElementById("lightboxOpen");
        const stage = document.getElementById("lightboxStage");
        const resultRows = Array.from(document.querySelectorAll("[data-result-row]"));
        const filterButtons = Array.from(document.querySelectorAll("[data-status-filter]"));
        const searchInput = document.getElementById("resultSearch");
        const filterCount = document.getElementById("resultFilterCount");
        const noMatches = document.getElementById("resultNoMatches");
        let activeStatus = "all";
        let zoom = 1;

        function applyZoom() {
          image.style.width = (zoom * 100) + "%";
        }

        function openPreview(button) {
          const src = button.dataset.lightboxSrc;
          const label = button.dataset.lightboxTitle || "Screenshot preview";
          if (!src) return;
          zoom = 1;
          image.src = src;
          image.alt = label;
          title.textContent = label;
          openLink.href = src;
          applyZoom();
          lightbox.dataset.open = "true";
          stage.scrollTo({ top: 0, left: 0 });
          document.body.style.overflow = "hidden";
        }

        function closePreview() {
          lightbox.dataset.open = "false";
          image.removeAttribute("src");
          document.body.style.overflow = "";
        }

        function applyResultFilters() {
          const query = (searchInput.value || "").trim().toLowerCase();
          let visible = 0;

          resultRows.forEach((row) => {
            const statusMatches = activeStatus === "all" || row.dataset.status === activeStatus;
            const queryMatches = !query || (row.dataset.filterText || "").includes(query);
            const shouldShow = statusMatches && queryMatches;
            row.hidden = !shouldShow;
            if (shouldShow) visible += 1;
          });

          if (filterCount) filterCount.textContent = "Showing " + visible + " of " + resultRows.length;
          if (noMatches) noMatches.hidden = visible !== 0;
        }

        document.addEventListener("click", (event) => {
          const previewButton = event.target.closest("[data-lightbox-src]");
          if (previewButton) {
            event.preventDefault();
            openPreview(previewButton);
            return;
          }

          if (event.target.closest("[data-lightbox-close]")) {
            closePreview();
            return;
          }

          const zoomButton = event.target.closest("[data-zoom]");
          if (!zoomButton) return;
          const action = zoomButton.dataset.zoom;
          if (action === "in") zoom = Math.min(zoom + 0.25, 4);
          if (action === "out") zoom = Math.max(zoom - 0.25, 0.5);
          if (action === "reset") zoom = 1;
          applyZoom();
        });

        filterButtons.forEach((button) => {
          button.addEventListener("click", () => {
            activeStatus = button.dataset.statusFilter || "all";
            filterButtons.forEach((candidate) => {
              candidate.setAttribute("aria-pressed", String(candidate === button));
            });
            applyResultFilters();
          });
        });

        if (searchInput) {
          searchInput.addEventListener("input", applyResultFilters);
        }

        lightbox.addEventListener("click", (event) => {
          if (event.target === lightbox) closePreview();
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && lightbox.dataset.open === "true") {
            closePreview();
          }
        });

        applyResultFilters();
      })();
    </script>
  </body>
</html>
`;
}

function renderMarkdownReport(run: VisualRunResult): string {
  const failed = run.results.filter((result) => result.status === "failed" || result.status === "error");
  const failedRows = failed.length
    ? failed.map((result) => `| ${result.path} | ${result.viewport.name} | ${result.status} | ${formatPercent(result.mismatchPercentage)} | ${formatDuration(result.durationMs)} | ${result.error ?? ""} |`).join("\n")
    : "| None | - | passed | 0% | - | No failed comparisons. |";

  const details = run.results.map((result) => [
    `### ${result.path} - ${result.viewport.name}`,
    "",
    `- Status: ${result.status}`,
    `- Mismatch: ${formatPercent(result.mismatchPercentage)}`,
    `- Duration: ${formatDuration(result.durationMs)}`,
    `- Final baseline URL: ${finalUrlsFor(result).baseline}`,
    `- Final target URL: ${finalUrlsFor(result).target}`,
    `- Baseline screenshot: ${result.screenshotPaths.baseline}`,
    `- Target screenshot: ${result.screenshotPaths.target}`,
    `- Diff screenshot: ${result.screenshotPaths.diff}`,
    `- Metadata: ${result.metadataPath}`,
    result.error ? `- Note: ${result.error}` : "",
    "",
  ].filter(Boolean).join("\n")).join("\n");

  return [
    "# Visual Comparison Summary",
    "",
    `Run: ${run.runDir}`,
    "",
    `Started: ${run.startedAt}`,
    "",
    `Completed: ${run.completedAt}`,
    "",
    `Baseline: ${run.baselineUrl}`,
    "",
    `Target: ${run.targetUrl}`,
    "",
    `Threshold: ${formatPercent(run.threshold)}`,
    "",
    "## Summary",
    "",
    "| Pages | Comparisons | Passed | Failed | Skipped | Errors |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${run.summary.pages} | ${run.summary.comparisons} | ${run.summary.passed} | ${run.summary.failed} | ${run.summary.skipped} | ${run.summary.errors} |`,
    "",
    "## Failed Pages",
    "",
    "| Page | Viewport | Status | Mismatch | Duration | Notes |",
    "| --- | --- | --- | ---: | ---: | --- |",
    failedRows,
    "",
    "## Tested Pages",
    "",
    ...[...new Set(run.results.map((result) => result.path))].map((page) => `- ${page}`),
    "",
    "## Evidence",
    "",
    details,
    "## Next Actions",
    "",
    "- Review failed and error rows first.",
    "- Open `index.html` for side-by-side screenshot previews.",
    "- Raise `VISUAL_THRESHOLD` only after confirming the difference is acceptable noise.",
    "",
  ].join("\n");
}

function resultRow(runDir: string, result: ComparisonResult): string {
  return `<tr data-result-row data-status="${escapeAttr(result.status)}" data-filter-text="${escapeAttr(resultFilterText(result))}">
  <td>${escapeHtml(result.path)}</td>
  <td>${finalUrlsCell(result)}</td>
  <td>${escapeHtml(result.viewport.name)}<br><small>${result.viewport.width}x${result.viewport.height}</small></td>
  <td class="status-${escapeAttr(result.status)}">${escapeHtml(statusLabel(result))}</td>
  <td>${formatPercent(result.mismatchPercentage)}<br><small>attempts: ${result.attempts}</small></td>
  <td>${formatDuration(result.durationMs)}</td>
  <td>
    <div class="shots">
      ${figure("Baseline", runDir, result.screenshotPaths.baseline)}
      ${figure("Target", runDir, result.screenshotPaths.target)}
      ${figure("Diff", runDir, result.screenshotPaths.diff)}
    </div>
  </td>
</tr>`;
}

function statusFilterButton(status: string, label: string, count: number, active = false): string {
  return `<button type="button" data-status-filter="${escapeAttr(status)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)} <span>${count}</span></button>`;
}

function finalUrlsCell(result: ComparisonResult): string {
  const finalUrls = finalUrlsFor(result);
  return `<span class="url-pair">
  <span>Baseline</span><a href="${escapeAttr(finalUrls.baseline)}">${escapeHtml(finalUrls.baseline)}</a>
  <span>Target</span><a href="${escapeAttr(finalUrls.target)}">${escapeHtml(finalUrls.target)}</a>
</span>`;
}

function finalUrlsFor(result: ComparisonResult): { baseline: string; target: string } {
  return {
    baseline: result.finalUrls?.baseline || result.baselineUrl,
    target: result.finalUrls?.target || result.targetUrl,
  };
}

function resultFilterText(result: ComparisonResult): string {
  const finalUrls = finalUrlsFor(result);
  return [
    result.path,
    result.viewport.name,
    `${result.viewport.width}x${result.viewport.height}`,
    result.status,
    result.error ?? "",
    result.baselineUrl,
    result.targetUrl,
    finalUrls.baseline,
    finalUrls.target,
  ].join(" ").toLowerCase();
}

function figure(label: string, runDir: string, filePath: string): string {
  const relativePath = path.relative(runDir, filePath).split(path.sep).join("/");
  const title = `${label}: ${relativePath}`;
  return `<figure>
  <figcaption>${escapeHtml(label)}</figcaption>
  <button class="shot-button" type="button" data-lightbox-src="${escapeAttr(relativePath)}" data-lightbox-title="${escapeAttr(title)}">
    <img src="${escapeAttr(relativePath)}" alt="${escapeAttr(label)} screenshot">
  </button>
</figure>`;
}

function metric(label: string, value: number): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function statusLabel(result: ComparisonResult): string {
  if (result.error) return `${result.status}: ${result.error}`;
  return result.status;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDuration(value: number | undefined): string {
  if (!Number.isFinite(value)) return "-";
  if ((value ?? 0) < 1000) return `${Math.round(value ?? 0)} ms`;
  return `${((value ?? 0) / 1000).toFixed((value ?? 0) < 10000 ? 2 : 1)} s`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
