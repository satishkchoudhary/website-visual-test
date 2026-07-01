import { createReadStream } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { loadVisualConfig } from "../config/loadConfig.js";
import { readJson } from "../lib/files.js";
import type { UrlInventory, VisualConfig, VisualRunResult } from "../types.js";
import { extractUrls } from "../urlExtractor.js";
import { generateReports } from "../report.js";
import { runVisualTest } from "../visualTest.js";
import { runPreflight } from "../preflight.js";
import { deletePreset, listPresets, savePreset } from "../presets.js";
import { renderUi } from "./ui.js";

type JobAction = "extract" | "compare" | "full";
type JobStatus = "queued" | "running" | "completed" | "failed";

interface JobRecord {
  id: string;
  action: JobAction;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: JobProgress;
  logs: string[];
  result?: unknown;
  error?: string;
}

interface JobProgress {
  percent: number;
  label: string;
  detail: string;
  completed?: number;
  total?: number;
}

interface JobOptions {
  baselineUrl?: string;
  targetUrl?: string;
  urlSource?: string;
  maxPages?: number;
  threshold?: number;
  waitUntil?: string;
  sitemaps?: string;
  viewports?: string;
}

interface RunHistoryItem {
  id: string;
  runDir: string;
  reportPath: string;
  summaryPath: string;
  startedAt: string;
  completedAt: string;
  baselineUrl: string;
  targetUrl: string;
  pages: number;
  comparisons: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
}

const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || "127.0.0.1";
const root = process.cwd();
const jobs = new Map<string, JobRecord>();

const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`Visual UI running at http://${host}:${port}/`);
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (request.method === "GET" && url.pathname === "/") {
    send(response, 200, renderUi(), "text/html; charset=utf-8");
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/jobs") {
    const body = await readBody<{ action?: JobAction; options?: JobOptions }>(request);
    if (!body.action || !["extract", "compare", "full"].includes(body.action)) {
      sendJson(response, 400, { error: "Unsupported job action." });
      return;
    }

    const job = createJob(body.action);
    sendJson(response, 202, { id: job.id });
    runJob(job, body.options || {}).catch((error) => {
      failJob(job, error instanceof Error ? error.message : String(error));
    });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/jobs/", ""));
    const job = jobs.get(id);
    if (!job) {
      sendJson(response, 404, { error: "Job not found." });
      return;
    }
    sendJson(response, 200, job);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/inventory") {
    try {
      sendJson(response, 200, await readJson<UrlInventory>(path.join(root, "visual/urls.json")));
    } catch {
      sendJson(response, 200, {
        generatedAt: "",
        baselineUrl: "",
        targetUrl: "",
        maxPages: 0,
        urlSource: "crawl",
        sitemapPaths: [],
        urls: [],
        notes: [],
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/latest-run") {
    const latestRun = await readLatestRun().catch(() => null);
    sendJson(response, 200, latestRun || {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/runs") {
    sendJson(response, 200, await readRunHistory());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/preflight") {
    sendJson(response, 200, await runPreflight({ port, serverAlreadyRunning: true }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/presets") {
    sendJson(response, 200, await listPresets());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/presets") {
    const body = await readBody<Parameters<typeof savePreset>[0]>(request);
    sendJson(response, 200, await savePreset(body));
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/presets/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/presets/", ""));
    const deleted = await deletePreset(id);
    sendJson(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: "Preset not found." });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/reports/")) {
    await serveStatic(response, url.pathname.replace("/reports/", "visual-test-results/"), path.join(root, "visual-test-results"));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/visual/")) {
    await serveStatic(response, url.pathname.slice(1), path.join(root, "visual"));
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function runJob(job: JobRecord, options: JobOptions): Promise<void> {
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  setProgress(job, 3, "Preparing job", "Building configuration.", { log: true });
  const config = await configFromOptions(options);
  setProgress(job, 8, "Configuration ready", `${config.baselineUrl} vs ${config.targetUrl}.`, { log: true });

  if (job.action === "extract") {
    const inventory = await extractForJob(job, config, 15, 92);
    job.result = { inventory };
  }

  if (job.action === "compare") {
    const visualRun = await compareForJob(job, config, 12, 88);
    setProgress(job, 94, "Creating report", "Writing HTML and Markdown reports.", { log: true });
    const reports = await generateReports(config, visualRun);
    setProgress(job, 98, "Report ready", reports.htmlPath, { log: true });
    job.result = { visualRun, reports };
  }

  if (job.action === "full") {
    const inventory = await extractForJob(job, config, 12, 28);
    const visualRun = await compareForJob(job, config, 30, 88);
    setProgress(job, 94, "Creating report", "Writing HTML and Markdown reports.", { log: true });
    const reports = await generateReports(config, visualRun);
    setProgress(job, 98, "Report ready", reports.htmlPath, { log: true });
    job.result = { inventory, visualRun, reports };
  }

  setProgress(job, 100, "Complete", "Job completed.", { log: true });
  job.status = "completed";
  job.updatedAt = new Date().toISOString();
}

async function extractForJob(job: JobRecord, config: VisualConfig, startPercent: number, endPercent: number): Promise<UrlInventory> {
  const sourceLabel = config.urlSource === "both" ? "sitemaps and crawl" : config.urlSource;
  setProgress(job, startPercent, "Discovering URLs", `Reading ${sourceLabel} sources.`, { log: true });
  const inventory = await extractUrls(config);
  setProgress(job, endPercent, "URLs ready", `Found ${inventory.urls.length} URL(s).`, {
    completed: inventory.urls.length,
    log: true,
    total: config.maxPages,
  });
  return inventory;
}

async function compareForJob(job: JobRecord, config: VisualConfig, startPercent: number, endPercent: number): Promise<VisualRunResult> {
  setProgress(job, startPercent, "Loading checklist", "Preparing screenshot queue.", { log: true });

  return runVisualTest(config, {
    onProgress: (event) => {
      const total = Math.max(event.total, 1);
      const activeIndex = event.phase === "started" ? event.completed + 1 : event.completed;
      const percent = startPercent + Math.round((event.completed / total) * (endPercent - startPercent));
      const detail = `${activeIndex}/${event.total}: ${event.page.path} (${event.viewport.name})`;

      if (event.phase === "started") {
        setProgress(job, percent, "Capturing screenshots", detail, {
          completed: event.completed,
          total: event.total,
        });
        return;
      }

      const resultStatus = event.result?.status || "completed";
      setProgress(job, percent, `Compared ${event.completed}/${event.total}`, `${event.page.path} (${event.viewport.name}) ${resultStatus}.`, {
        completed: event.completed,
        log: true,
        total: event.total,
      });
    },
  });
}

async function configFromOptions(options: JobOptions): Promise<VisualConfig> {
  const argv = [
    `--baseline=${options.baselineUrl || ""}`,
    `--target=${options.targetUrl || ""}`,
    `--url-source=${options.urlSource || "sitemap"}`,
    `--max-pages=${options.maxPages || 25}`,
    `--threshold=${options.threshold ?? 0.01}`,
    `--wait-until=${options.waitUntil || "domcontentloaded"}`,
  ];

  if (options.sitemaps) argv.push(`--sitemaps=${options.sitemaps}`);
  if (options.viewports) argv.push(`--viewports=${options.viewports}`);

  return loadVisualConfig({ argv, failOnDifference: false });
}

function createJob(action: JobAction): JobRecord {
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    progress: {
      percent: 0,
      label: "Queued",
      detail: "Waiting to start.",
    },
    logs: [],
  };
  jobs.set(job.id, job);
  return job;
}

function setProgress(
  job: JobRecord,
  percent: number,
  label: string,
  detail = "",
  options: { completed?: number; log?: boolean; total?: number } = {},
): void {
  job.progress = {
    percent: Math.max(0, Math.min(100, percent)),
    label,
    detail,
    ...(options.completed !== undefined ? { completed: options.completed } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
  };
  job.updatedAt = new Date().toISOString();
  if (options.log) log(job, detail ? `${label}: ${detail}` : label);
}

function log(job: JobRecord, message: string): void {
  job.logs.push(`${new Date().toLocaleTimeString()} ${message}`);
  job.updatedAt = new Date().toISOString();
}

function failJob(job: JobRecord, message: string): void {
  setProgress(job, job.progress.percent, "Failed", message, { log: true });
  job.error = message;
  job.status = "failed";
  job.updatedAt = new Date().toISOString();
}

async function readLatestRun(): Promise<VisualRunResult> {
  const latest = await realpath(path.join(root, "visual-test-results/latest"));
  return readJson<VisualRunResult>(path.join(latest, "run.json"));
}

async function readRunHistory(): Promise<RunHistoryItem[]> {
  const resultsRoot = path.join(root, "visual-test-results");
  const dateDirs = await readdir(resultsRoot, { withFileTypes: true }).catch(() => []);
  const runs: RunHistoryItem[] = [];

  for (const dateDir of dateDirs) {
    if (!dateDir.isDirectory() || dateDir.name === "latest") continue;
    const datePath = path.join(resultsRoot, dateDir.name);
    const runDirs = await readdir(datePath, { withFileTypes: true }).catch(() => []);

    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) continue;
      const fullRunDir = path.join(datePath, runDir.name);
      const runJsonPath = path.join(fullRunDir, "run.json");

      try {
        const run = await readJson<VisualRunResult>(runJsonPath);
        const relativeRunDir = path.relative(resultsRoot, fullRunDir).split(path.sep).join("/");
        runs.push({
          id: relativeRunDir,
          runDir: run.runDir,
          reportPath: `/reports/${relativeRunDir}/index.html`,
          summaryPath: `/reports/${relativeRunDir}/summary.md`,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          baselineUrl: run.baselineUrl,
          targetUrl: run.targetUrl,
          pages: run.summary.pages,
          comparisons: run.summary.comparisons,
          passed: run.summary.passed,
          failed: run.summary.failed,
          skipped: run.summary.skipped,
          errors: run.summary.errors,
        });
      } catch {
        // Ignore incomplete or manually deleted runs.
      }
    }
  }

  return runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

async function serveStatic(response: ServerResponse, relativePath: string, allowedRoot: string): Promise<void> {
  const filePath = path.resolve(root, relativePath);
  const allowed = path.resolve(allowedRoot);

  if (!filePath.startsWith(allowed)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
  } catch {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  response.writeHead(200, {
    "content-type": types[path.extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

async function readBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as T : {} as T;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  send(response, status, JSON.stringify(value, null, 2), "application/json; charset=utf-8");
}

function send(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}
