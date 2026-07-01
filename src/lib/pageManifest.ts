import type { PageEntry, PageManifest, VisualConfig } from "../types.js";
import { readJson } from "./files.js";
import { normalizePathname } from "./patterns.js";
import { buildUrl } from "./urls.js";

export async function loadPagesForRun(config: VisualConfig): Promise<PageManifest> {
  if (config.page) return singlePageManifest(config, config.page);

  try {
    return await readJson<PageManifest>(config.pagesFile);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Page checklist not found at ${config.pagesFile}. Run npm run visual:crawl first or pass --page=/path.`);
    }
    throw error;
  }
}

function singlePageManifest(config: VisualConfig, rawPath: string): PageManifest {
  const pagePath = normalizePathname(rawPath);
  const page: PageEntry = {
    path: pagePath,
    baselineUrl: buildUrl(config.baselineUrl, pagePath),
    targetUrl: buildUrl(config.targetUrl, pagePath),
    discoverySource: "cli",
    status: "ready",
    notes: "Single page requested from --page.",
  };

  return {
    generatedAt: new Date().toISOString(),
    baselineUrl: config.baselineUrl,
    targetUrl: config.targetUrl,
    maxPages: 1,
    pages: [page],
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
