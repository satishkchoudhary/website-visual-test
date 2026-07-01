export function renderUi(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Website Visual Test</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f4f6f9;
        color: #152033;
      }
      header {
        border-bottom: 1px solid #dbe2ec;
        background: #fff;
      }
      .shell {
        max-width: 1240px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 {
        margin: 0;
        font-size: 22px;
        letter-spacing: 0;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 16px;
        letter-spacing: 0;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(320px, 430px) 1fr;
        gap: 18px;
        align-items: start;
      }
      .panel {
        border: 1px solid #d8e0ea;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 1px 2px rgb(16 24 40 / 6%);
      }
      .panel-body {
        padding: 16px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      label {
        display: grid;
        gap: 6px;
        color: #344054;
        font-size: 13px;
        font-weight: 700;
      }
      input,
      select {
        width: 100%;
        min-height: 38px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        color: #152033;
        font: inherit;
      }
      input:focus,
      select:focus,
      button:focus-visible,
      a:focus-visible {
        outline: 3px solid #1b75bb;
        outline-offset: 2px;
      }
      .full {
        grid-column: 1 / -1;
      }
      .viewport-list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 38px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 9px;
        font-weight: 600;
      }
      .check input {
        width: auto;
        min-height: auto;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }
      button,
      .link-button {
        min-height: 40px;
        border: 1px solid #b8c4d3;
        border-radius: 6px;
        padding: 9px 12px;
        background: #fff;
        color: #152033;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        text-align: center;
        text-decoration: none;
      }
      button.primary {
        border-color: #1769aa;
        background: #1769aa;
        color: #fff;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .status-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }
      .metric {
        border: 1px solid #d8e0ea;
        border-radius: 8px;
        background: #fff;
        padding: 12px;
      }
      .metric span {
        display: block;
        color: #59677b;
        font-size: 12px;
        font-weight: 800;
      }
      .metric strong {
        display: block;
        margin-top: 4px;
        font-size: 24px;
      }
      .job {
        min-height: 188px;
      }
      .job-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #e5ebf3;
        padding: 12px 16px;
      }
      .badge {
        border-radius: 999px;
        padding: 4px 9px;
        background: #eef3f8;
        color: #344054;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }
      .badge.running {
        background: #e0f2fe;
        color: #075985;
      }
      .badge.completed {
        background: #dcfce7;
        color: #166534;
      }
      .badge.failed {
        background: #fee2e2;
        color: #991b1b;
      }
      .log {
        height: 210px;
        overflow: auto;
        border: 1px solid #d8e0ea;
        border-radius: 8px;
        background: #0f172a;
        color: #e5e7eb;
        padding: 12px;
        font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }
      .table-wrap {
        overflow: auto;
        max-height: 460px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid #e5ebf3;
        padding: 10px;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }
      th {
        position: sticky;
        top: 0;
        background: #eef3f8;
        font-size: 12px;
        z-index: 1;
      }
      code {
        border-radius: 4px;
        background: #eef3f8;
        padding: 2px 4px;
      }
      .empty {
        color: #667085;
        padding: 22px;
        text-align: center;
      }
      @media (max-width: 920px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 620px) {
        .shell {
          padding: 14px;
        }
        .grid,
        .actions,
        .status-strip,
        .viewport-list {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="shell">
        <h1>Website Visual Test</h1>
      </div>
    </header>
    <main class="shell">
      <div class="layout">
        <section class="panel">
          <div class="panel-body">
            <h2>Run Setup</h2>
            <div class="grid">
              <label class="full">Baseline URL
                <input id="baselineUrl" value="https://redesign.lordabbett.com" autocomplete="url">
              </label>
              <label class="full">Target URL
                <input id="targetUrl" value="https://www.lordabbett.com" autocomplete="url">
              </label>
              <label>URL Source
                <select id="urlSource">
                  <option value="sitemap">Sitemap</option>
                  <option value="crawl">Crawl</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label>Max Pages
                <input id="maxPages" type="number" min="1" max="500" value="25">
              </label>
              <label>Threshold
                <input id="threshold" type="number" min="0" max="1" step="0.001" value="0.01">
              </label>
              <label>Wait Until
                <select id="waitUntil">
                  <option value="domcontentloaded">DOM Loaded</option>
                  <option value="load">Load</option>
                  <option value="networkidle">Network Idle</option>
                </select>
              </label>
              <label class="full">Sitemaps
                <input id="sitemaps" value="/sitemap.xml,/sitemap_index.xml">
              </label>
              <div class="full">
                <label>Viewports</label>
                <div class="viewport-list">
                  <label class="check"><input type="checkbox" name="viewport" value="desktop" checked> Desktop</label>
                  <label class="check"><input type="checkbox" name="viewport" value="tablet" checked> Tablet</label>
                  <label class="check"><input type="checkbox" name="viewport" value="mobile" checked> Mobile</label>
                </div>
              </div>
            </div>
            <div class="actions">
              <button type="button" data-action="extract">Extract URLs</button>
              <button type="button" data-action="compare">Compare</button>
              <button class="primary" type="button" data-action="full">Extract + Compare</button>
            </div>
          </div>
        </section>

        <section>
          <div class="status-strip">
            <div class="metric"><span>URLs</span><strong id="urlCount">-</strong></div>
            <div class="metric"><span>Passed</span><strong id="passedCount">-</strong></div>
            <div class="metric"><span>Failed</span><strong id="failedCount">-</strong></div>
            <div class="metric"><span>Errors</span><strong id="errorCount">-</strong></div>
          </div>

          <section class="panel job">
            <div class="job-head">
              <h2>Current Job</h2>
              <span id="jobBadge" class="badge">Idle</span>
            </div>
            <div class="panel-body">
              <div id="log" class="log">Ready.</div>
              <div class="links">
                <a class="link-button" href="/visual/urls.md" target="_blank" rel="noreferrer">URL Inventory</a>
                <a class="link-button" href="/visual/pages.md" target="_blank" rel="noreferrer">Checklist</a>
                <a class="link-button" href="/reports/latest/index.html" target="_blank" rel="noreferrer">Latest Report</a>
              </div>
            </div>
          </section>

          <section class="panel" style="margin-top: 18px;">
            <div class="job-head">
              <h2>URL Inventory</h2>
              <button type="button" id="refreshInventory">Refresh</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="inventoryRows">
                  <tr><td class="empty" colspan="3">No inventory loaded.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel" style="margin-top: 18px;">
            <div class="job-head">
              <h2>Past Results</h2>
              <button type="button" id="refreshRuns">Refresh</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Completed</th>
                    <th>Pages</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Errors</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody id="historyRows">
                  <tr><td class="empty" colspan="7">No past results loaded.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
    <script>
      const state = {
        currentJob: null,
        pollTimer: null,
      };

      const viewportSizes = {
        desktop: "desktop:1440x900",
        tablet: "tablet:768x1024",
        mobile: "mobile:390x844",
      };

      function payload() {
        const selectedViewports = [...document.querySelectorAll("input[name='viewport']:checked")]
          .map((input) => viewportSizes[input.value]);

        return {
          baselineUrl: document.getElementById("baselineUrl").value.trim(),
          targetUrl: document.getElementById("targetUrl").value.trim(),
          urlSource: document.getElementById("urlSource").value,
          maxPages: Number(document.getElementById("maxPages").value || 25),
          threshold: Number(document.getElementById("threshold").value || 0.01),
          waitUntil: document.getElementById("waitUntil").value,
          sitemaps: document.getElementById("sitemaps").value.trim(),
          viewports: selectedViewports.join(","),
        };
      }

      async function startJob(action) {
        setBusy(true);
        setLog("Starting " + labelFor(action) + "...");
        setBadge("running");

        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, options: payload() }),
        });

        const body = await response.json();
        if (!response.ok) {
          setBusy(false);
          setBadge("failed");
          setLog(body.error || "Unable to start job.");
          return;
        }

        state.currentJob = body.id;
        pollJob();
      }

      async function pollJob() {
        if (!state.currentJob) return;
        const response = await fetch("/api/jobs/" + encodeURIComponent(state.currentJob));
        const job = await response.json();
        renderJob(job);

        if (job.status === "running" || job.status === "queued") {
          state.pollTimer = window.setTimeout(pollJob, 1200);
        } else {
          setBusy(false);
          await loadInventory();
          await loadHistory();
        }
      }

      function renderJob(job) {
        setBadge(job.status);
        setLog(job.logs.join("\\n") || job.status);

        const result = job.result || {};
        if (result.inventory) {
          document.getElementById("urlCount").textContent = result.inventory.urls.length;
        }
        if (result.visualRun) {
          document.getElementById("passedCount").textContent = result.visualRun.summary.passed;
          document.getElementById("failedCount").textContent = result.visualRun.summary.failed;
          document.getElementById("errorCount").textContent = result.visualRun.summary.errors;
        }
      }

      async function loadInventory() {
        const response = await fetch("/api/inventory");
        if (!response.ok) return;
        const inventory = await response.json();
        document.getElementById("urlCount").textContent = inventory.urls.length;
        const rows = document.getElementById("inventoryRows");

        if (!inventory.urls.length) {
          rows.innerHTML = '<tr><td class="empty" colspan="3">No URLs extracted.</td></tr>';
          return;
        }

        rows.innerHTML = inventory.urls.slice(0, 100).map((item) => (
          '<tr>' +
          '<td><code>' + escapeHtml(item.path) + '</code></td>' +
          '<td>' + escapeHtml(item.discoverySource || "") + '</td>' +
          '<td>' + escapeHtml(item.status) + '</td>' +
          '</tr>'
        )).join("");
      }

      async function loadHistory() {
        const response = await fetch("/api/runs");
        if (!response.ok) return;
        const runs = await response.json();
        const rows = document.getElementById("historyRows");

        if (!runs.length) {
          rows.innerHTML = '<tr><td class="empty" colspan="7">No past results yet.</td></tr>';
          return;
        }

        rows.innerHTML = runs.map((run) => (
          '<tr>' +
          '<td><code>' + escapeHtml(run.id) + '</code><br><small>' + escapeHtml(shortUrl(run.baselineUrl)) + ' vs ' + escapeHtml(shortUrl(run.targetUrl)) + '</small></td>' +
          '<td>' + escapeHtml(formatDate(run.completedAt)) + '</td>' +
          '<td>' + run.pages + '<br><small>' + run.comparisons + ' checks</small></td>' +
          '<td>' + run.passed + '</td>' +
          '<td>' + run.failed + '</td>' +
          '<td>' + run.errors + '</td>' +
          '<td><a href="' + escapeAttr(run.reportPath) + '" target="_blank" rel="noreferrer">Report</a><br><a href="' + escapeAttr(run.summaryPath) + '" target="_blank" rel="noreferrer">Summary</a></td>' +
          '</tr>'
        )).join("");
      }

      function setBusy(isBusy) {
        document.querySelectorAll("button[data-action]").forEach((button) => {
          button.disabled = isBusy;
        });
      }

      function setBadge(status) {
        const badge = document.getElementById("jobBadge");
        badge.className = "badge " + status;
        badge.textContent = status;
      }

      function setLog(text) {
        const log = document.getElementById("log");
        log.textContent = text;
        log.scrollTop = log.scrollHeight;
      }

      function labelFor(action) {
        if (action === "extract") return "URL extraction";
        if (action === "compare") return "comparison";
        return "full workflow";
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function escapeAttr(value) {
        return escapeHtml(value);
      }

      function formatDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      function shortUrl(value) {
        try {
          return new URL(value).host;
        } catch {
          return value || "";
        }
      }

      document.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => startJob(button.dataset.action));
      });
      document.getElementById("refreshInventory").addEventListener("click", loadInventory);
      document.getElementById("refreshRuns").addEventListener("click", loadHistory);
      loadInventory();
      loadHistory();
    </script>
  </body>
</html>`;
}
