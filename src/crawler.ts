import { chromium } from "playwright";
import type { Page, Response } from "playwright";
import type { PageEntry, PageManifest, VisualConfig } from "./types.js";
import { writeJson, writeText } from "./lib/files.js";
import { normalizePathname } from "./lib/patterns.js";
import { buildUrl, normalizeDiscoveredPath } from "./lib/urls.js";

interface QueueItem {
  path: string;
  source: string;
}

interface CrawlOptions {
  writeFiles?: boolean;
}

export async function crawlPages(config: VisualConfig, options: CrawlOptions = {}): Promise<PageManifest> {
  const writeFiles = options.writeFiles ?? true;
  const startPath = normalizePathname(config.page || config.startPath);
  const maxPages = config.page ? 1 : config.maxPages;
  const baselineOrigin = new URL(config.baselineUrl).origin;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(config.timeoutMs);

  const seen = new Set<string>();
  const queued = new Set<string>([startPath]);
  const queue: QueueItem[] = [{ path: startPath, source: "seed" }];
  const pages: PageEntry[] = [];

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const item = queue.shift();
      if (!item) break;

      const pathname = normalizePathname(item.path);
      queued.delete(pathname);
      if (seen.has(pathname)) continue;
      seen.add(pathname);

      const baselineUrl = buildUrl(config.baselineUrl, pathname);
      const targetUrl = buildUrl(config.targetUrl, pathname);
      const entry: PageEntry = {
        path: pathname,
        baselineUrl,
        targetUrl,
        discoverySource: item.source,
        status: "ready",
        notes: "",
      };

      try {
        const response = await page.goto(baselineUrl, {
          waitUntil: config.waitUntil,
          timeout: config.timeoutMs,
        });
        entry.notes = responseNote(response);
        if (response && response.status() >= 400) entry.status = "error";

        const links = await discoverLinks(page, baselineOrigin, config);
        for (const nextPath of links) {
          if (seen.has(nextPath) || queued.has(nextPath) || pages.length + queue.length >= maxPages) continue;
          queued.add(nextPath);
          queue.push({ path: nextPath, source: pathname });
        }
      } catch (error) {
        entry.status = "error";
        entry.notes = error instanceof Error ? error.message : String(error);
      }

      pages.push(entry);
    }
  } finally {
    await browser.close();
  }

  const manifest: PageManifest = {
    generatedAt: new Date().toISOString(),
    baselineUrl: config.baselineUrl,
    targetUrl: config.targetUrl,
    maxPages,
    pages,
  };

  if (writeFiles) await writePageManifest(config, manifest);
  return manifest;
}

export async function writePageManifest(config: VisualConfig, manifest: PageManifest): Promise<void> {
  await writeJson(config.pagesFile, manifest);
  await writeText(config.pagesMarkdownFile, renderPagesMarkdown(manifest));
}

async function discoverLinks(page: Page, origin: string, config: VisualConfig): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
  const paths = new Set<string>();

  for (const href of hrefs) {
    const pathname = normalizeDiscoveredPath(href, origin, config);
    if (pathname) paths.add(pathname);
  }

  return [...paths].sort();
}

function responseNote(response: Response | null): string {
  if (!response) return "No HTTP response returned.";
  return `HTTP ${response.status()}`;
}

export function renderPagesMarkdown(manifest: PageManifest): string {
  const rows = manifest.pages.map((page) => (
    `| ${escapeCell(page.status)} | ${escapeCell(page.path)} | ${link(page.baselineUrl)} | ${link(page.targetUrl)} | ${escapeCell(page.discoverySource)} | ${escapeCell(page.notes)} |`
  ));

  return [
    "# Visual Page Checklist",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    `Baseline: ${manifest.baselineUrl}`,
    "",
    `Target: ${manifest.targetUrl}`,
    "",
    `Max pages: ${manifest.maxPages}`,
    "",
    "| Status | Path | Baseline URL | Target URL | Source | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function link(url: string): string {
  return `[open](${url})`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
