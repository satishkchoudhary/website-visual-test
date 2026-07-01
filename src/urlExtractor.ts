import type { PageEntry, PageManifest, UrlInventory, VisualConfig } from "./types.js";
import { crawlPages, renderPagesMarkdown, writePageManifest } from "./crawler.js";
import { writeJson, writeText } from "./lib/files.js";
import { normalizeDiscoveredPath, buildUrl } from "./lib/urls.js";

interface UrlRecord {
  path: string;
  sources: Set<string>;
  notes: Set<string>;
}

export async function extractUrls(config: VisualConfig): Promise<UrlInventory> {
  const records = new Map<string, UrlRecord>();
  const notes: string[] = [];

  if (config.urlSource === "manual") {
    const manualResult = extractFromManualPaths(config);
    mergeRecords(records, manualResult.records);
    notes.push(...manualResult.notes);
  }

  if (config.urlSource === "sitemap" || config.urlSource === "both") {
    const sitemapResult = await extractFromSitemaps(config);
    mergeRecords(records, sitemapResult.records);
    notes.push(...sitemapResult.notes);
  }

  const sitemapCount = records.size;

  if (config.urlSource === "crawl" || config.urlSource === "both") {
    const manifest = await crawlPages(config, { writeFiles: false });
    for (const page of manifest.pages) {
      addRecord(records, page.path, page.discoverySource || "crawl", page.notes);
    }
    if (config.urlSource === "both" && sitemapCount === 0) {
      notes.push("Crawl discovery was used because sitemap extraction returned no usable page URLs.");
    }
  }

  const urls = [...records.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, config.maxPages)
    .map((record): PageEntry => ({
      path: record.path,
      baselineUrl: buildUrl(config.baselineUrl, record.path),
      targetUrl: buildUrl(config.targetUrl, record.path),
      discoverySource: [...record.sources].sort().join(", "),
      status: "ready",
      notes: [...record.notes].filter(Boolean).sort().join("; "),
    }));

  const inventory: UrlInventory = {
    generatedAt: new Date().toISOString(),
    baselineUrl: config.baselineUrl,
    targetUrl: config.targetUrl,
    maxPages: config.maxPages,
    urlSource: config.urlSource,
    sitemapPaths: config.sitemapPaths,
    urls,
    notes,
  };

  const manifest: PageManifest = {
    generatedAt: inventory.generatedAt,
    baselineUrl: inventory.baselineUrl,
    targetUrl: inventory.targetUrl,
    maxPages: inventory.maxPages,
    pages: inventory.urls,
  };

  await writeJson(config.urlsFile, inventory);
  await writeText(config.urlsMarkdownFile, renderUrlsMarkdown(inventory));
  await writePageManifest(config, manifest);
  return inventory;
}

function mergeRecords(target: Map<string, UrlRecord>, source: Map<string, UrlRecord>): void {
  for (const record of source.values()) {
    for (const sourceName of record.sources) addRecord(target, record.path, sourceName);
    for (const note of record.notes) addRecord(target, record.path, "", note);
  }
}

async function extractFromSitemaps(config: VisualConfig): Promise<{ records: Map<string, UrlRecord>; notes: string[] }> {
  const records = new Map<string, UrlRecord>();
  const notes: string[] = [];
  const baselineOrigin = new URL(config.baselineUrl).origin;
  const targetOrigin = new URL(config.targetUrl).origin;
  const allowedOrigins = new Set([baselineOrigin, targetOrigin]);
  const queue = config.sitemapPaths.map((sitemapPath) => new URL(sitemapPath, config.baselineUrl).toString());
  const seenSitemaps = new Set<string>();
  const maxSitemaps = 50;

  while (queue.length > 0 && seenSitemaps.size < maxSitemaps && records.size < config.maxPages) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    try {
      const response = await fetch(sitemapUrl, { redirect: "follow" });
      if (!response.ok) {
        notes.push(`${sitemapUrl}: HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const locs = extractLocValues(xml);
      const isIndex = /<\s*sitemapindex[\s>]/i.test(xml);

      for (const loc of locs) {
        const url = safeUrl(loc);
        if (!url || !allowedOrigins.has(url.origin)) continue;

        if ((isIndex || url.pathname.endsWith(".xml")) && seenSitemaps.size + queue.length < maxSitemaps) {
          queue.push(url.toString());
          continue;
        }

        const pathname = normalizeDiscoveredPath(url.toString(), url.origin, config);
        if (pathname) addRecord(records, pathname, "sitemap", `from ${sitemapUrl}`);
        if (records.size >= config.maxPages) break;
      }
    } catch (error) {
      notes.push(`${sitemapUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (seenSitemaps.size >= maxSitemaps) notes.push(`Stopped after reading ${maxSitemaps} sitemap files.`);
  return { records, notes };
}

function extractFromManualPaths(config: VisualConfig): { records: Map<string, UrlRecord>; notes: string[] } {
  const records = new Map<string, UrlRecord>();
  const notes: string[] = [];

  config.manualPaths.forEach((entry, index) => {
    const raw = entry.trim();
    if (!raw || raw.startsWith("#")) return;

    const pathname = normalizeManualPath(raw, config);
    if (!pathname) {
      notes.push(`Manual URL line ${index + 1} skipped: ${raw}`);
      return;
    }

    addRecord(records, pathname, "manual", `manual line ${index + 1}`);
  });

  if (records.size === 0) {
    notes.push("Manual URL list did not contain any usable paths.");
  }

  return { records, notes };
}

function normalizeManualPath(value: string, config: VisualConfig): string | null {
  let url: URL;

  try {
    url = new URL(value, config.baselineUrl);
  } catch {
    return null;
  }

  return normalizeDiscoveredPath(url.toString(), url.origin, config);
}

function addRecord(records: Map<string, UrlRecord>, pagePath: string, source: string, note = ""): void {
  const existing = records.get(pagePath);
  if (existing) {
    if (source) existing.sources.add(source);
    if (note) existing.notes.add(note);
    return;
  }

  records.set(pagePath, {
    path: pagePath,
    sources: new Set(source ? [source] : []),
    notes: new Set(note ? [note] : []),
  });
}

function extractLocValues(xml: string): string[] {
  const locs: string[] = [];
  const pattern = /<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gis;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    locs.push(decodeXml(match[1].trim()));
  }

  return locs;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function renderUrlsMarkdown(inventory: UrlInventory): string {
  const pageManifest: PageManifest = {
    generatedAt: inventory.generatedAt,
    baselineUrl: inventory.baselineUrl,
    targetUrl: inventory.targetUrl,
    maxPages: inventory.maxPages,
    pages: inventory.urls,
  };

  return [
    "# Visual URL Inventory",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    `Source: ${inventory.urlSource}`,
    "",
    `Baseline: ${inventory.baselineUrl}`,
    "",
    `Target: ${inventory.targetUrl}`,
    "",
    `URL count: ${inventory.urls.length}`,
    "",
    inventory.notes.length ? "## Notes" : "",
    ...inventory.notes.map((note) => `- ${note}`),
    inventory.notes.length ? "" : "",
    renderPagesMarkdown(pageManifest).replace("# Visual Page Checklist", "## URLs"),
  ].join("\n");
}
