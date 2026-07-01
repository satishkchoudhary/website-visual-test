import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { loadVisualConfig } from "../config/loadConfig.js";
import { readJson } from "../lib/files.js";
import type { UrlInventory, VisualConfig, VisualRunResult } from "../types.js";
import { extractUrls } from "../urlExtractor.js";
import { generateReports } from "../report.js";
import { runVisualTest } from "../visualTest.js";
import { runVisualWorkflow } from "../workflow.js";
import { renderUi } from "./ui.js";

type JobAction = "extract" | "compare" | "full";
type JobStatus = "queued" | "running" | "completed" | "failed";

interface JobRecord {
  id: string;
  action: JobAction;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  result?: unknown;
  error?: string;
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
  log(job, "Building configuration.");
  const config = await configFromOptions(options);

  if (job.action === "extract") {
    log(job, "Extracting URLs.");
    const inventory = await extractUrls(config);
    log(job, `Extracted ${inventory.urls.length} URL(s).`);
    job.result = { inventory };
  }

  if (job.action === "compare") {
    log(job, "Running screenshot comparison from current checklist.");
    const visualRun = await runVisualTest(config);
    log(job, `Compared ${visualRun.summary.comparisons} screenshot pair(s).`);
    const reports = await generateReports(config, visualRun);
    log(job, `Report created at ${reports.htmlPath}.`);
    job.result = { visualRun, reports };
  }

  if (job.action === "full") {
    log(job, "Extracting URLs and running comparison.");
    const result = await runVisualWorkflow(config);
    log(job, `Compared ${result.visualRun.summary.comparisons} screenshot pair(s).`);
    log(job, `Report created at ${result.reports.htmlPath}.`);
    job.result = result;
  }

  job.status = "completed";
  job.updatedAt = new Date().toISOString();
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
    logs: [],
  };
  jobs.set(job.id, job);
  return job;
}

function log(job: JobRecord, message: string): void {
  job.logs.push(`${new Date().toLocaleTimeString()} ${message}`);
  job.updatedAt = new Date().toISOString();
}

function failJob(job: JobRecord, message: string): void {
  log(job, message);
  job.error = message;
  job.status = "failed";
  job.updatedAt = new Date().toISOString();
}

async function readLatestRun(): Promise<VisualRunResult> {
  const latest = await realpath(path.join(root, "visual-test-results/latest"));
  return readJson<VisualRunResult>(path.join(latest, "run.json"));
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
