import path from "node:path";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import type {
  ComparisonMetadata,
  ComparisonResult,
  ComparisonStatus,
  PageEntry,
  VisualConfig,
  VisualRunResult,
  VisualViewport,
} from "./types.js";
import { comparePngFiles } from "./compare/diff.js";
import { ensureDir, writeJson } from "./lib/files.js";
import { loadPagesForRun } from "./lib/pageManifest.js";
import { openStablePage, screenshotMaskLocators } from "./lib/pageActions.js";
import { comparisonDir, createRunDir, updateLatestPointer } from "./lib/runPaths.js";

export interface VisualTestProgressEvent {
  phase: "started" | "completed";
  completed: number;
  total: number;
  page: PageEntry;
  viewport: VisualViewport;
  result?: ComparisonResult;
}

export interface RunVisualTestOptions {
  onProgress?: (event: VisualTestProgressEvent) => void | Promise<void>;
}

export async function runVisualTest(config: VisualConfig, options: RunVisualTestOptions = {}): Promise<VisualRunResult> {
  const startedAt = new Date().toISOString();
  const manifest = await loadPagesForRun(config);
  const runDir = await createRunDir(config);
  const browser = await chromium.launch();
  const results: ComparisonResult[] = [];
  const total = manifest.pages.length * config.viewports.length;

  try {
    for (const pageEntry of manifest.pages) {
      for (const viewport of config.viewports) {
        await options.onProgress?.({
          phase: "started",
          completed: results.length,
          total,
          page: pageEntry,
          viewport,
        });
        const result = await comparePageViewport(browser, config, runDir, pageEntry, viewport);
        results.push(result);
        await options.onProgress?.({
          phase: "completed",
          completed: results.length,
          total,
          page: pageEntry,
          viewport,
          result,
        });
      }
    }
  } finally {
    await browser.close();
  }

  const runResult: VisualRunResult = {
    startedAt,
    completedAt: new Date().toISOString(),
    baselineUrl: config.baselineUrl,
    targetUrl: config.targetUrl,
    threshold: config.threshold,
    outputDir: config.outputDir,
    runDir,
    pagesFile: config.pagesFile,
    summary: summarizeResults(manifest.pages.length, results),
    results,
  };

  await writeJson(path.join(runDir, "run.json"), runResult);
  await updateLatestPointer(config.outputDir, runDir);
  return runResult;
}

async function comparePageViewport(
  browser: Browser,
  config: VisualConfig,
  runDir: string,
  pageEntry: PageEntry,
  viewport: VisualViewport,
): Promise<ComparisonResult> {
  const dir = comparisonDir(runDir, pageEntry.path, viewport.name);
  await ensureDir(dir);

  const screenshotPaths = {
    baseline: path.join(dir, "baseline.png"),
    target: path.join(dir, "target.png"),
    diff: path.join(dir, "diff.png"),
  };
  const metadataPath = path.join(dir, "metadata.json");

  if (pageEntry.status !== "ready") {
    const skipped = metadata(pageEntry, viewport, screenshotPaths, "skipped", 0, config.threshold, 0, pageEntry.notes);
    await writeJson(metadataPath, skipped);
    return { ...skipped, metadataPath };
  }

  let lastError = "";
  let lastMismatch = 1;
  let lastStatus: ComparisonStatus = "error";
  const maxAttempts = Math.max(1, config.retryCount + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await captureScreenshot(browser, config, viewport, pageEntry.baselineUrl, screenshotPaths.baseline);
      await captureScreenshot(browser, config, viewport, pageEntry.targetUrl, screenshotPaths.target);
      const diff = await comparePngFiles(
        screenshotPaths.baseline,
        screenshotPaths.target,
        screenshotPaths.diff,
        config.pixelThreshold,
      );
      lastMismatch = diff.mismatchPercentage;
      lastStatus = diff.mismatchPercentage <= config.threshold ? "passed" : "failed";
      lastError = diff.dimensionMismatch ? "Screenshot dimensions differ." : "";

      if (lastStatus === "passed" || attempt === maxAttempts) {
        const result = metadata(
          pageEntry,
          viewport,
          screenshotPaths,
          lastStatus,
          lastMismatch,
          config.threshold,
          attempt,
          lastError,
        );
        await writeJson(metadataPath, result);
        return { ...result, metadataPath };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      lastStatus = "error";
      if (attempt === maxAttempts) {
        const result = metadata(
          pageEntry,
          viewport,
          screenshotPaths,
          lastStatus,
          lastMismatch,
          config.threshold,
          attempt,
          lastError,
        );
        await writeJson(metadataPath, result);
        return { ...result, metadataPath };
      }
    }
  }

  const result = metadata(pageEntry, viewport, screenshotPaths, lastStatus, lastMismatch, config.threshold, maxAttempts, lastError);
  await writeJson(metadataPath, result);
  return { ...result, metadataPath };
}

async function captureScreenshot(
  browser: Browser,
  config: VisualConfig,
  viewport: VisualViewport,
  url: string,
  filePath: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(config.timeoutMs);
    await openStablePage(page, url, config);
    await page.screenshot({
      path: filePath,
      fullPage: config.fullPage,
      animations: "disabled",
      mask: await screenshotMaskLocators(page, config),
    });
  } finally {
    await context.close();
  }
}

function metadata(
  pageEntry: PageEntry,
  viewport: VisualViewport,
  screenshotPaths: ComparisonMetadata["screenshotPaths"],
  status: ComparisonStatus,
  mismatchPercentage: number,
  threshold: number,
  attempts: number,
  error = "",
): ComparisonMetadata {
  return {
    path: pageEntry.path,
    baselineUrl: pageEntry.baselineUrl,
    targetUrl: pageEntry.targetUrl,
    viewport,
    timestamp: new Date().toISOString(),
    screenshotPaths,
    browser: "chromium",
    status,
    mismatchPercentage,
    threshold,
    attempts,
    ...(error ? { error } : {}),
  };
}

function summarizeResults(pageCount: number, results: ComparisonResult[]): VisualRunResult["summary"] {
  return {
    pages: pageCount,
    comparisons: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    errors: results.filter((result) => result.status === "error").length,
  };
}
