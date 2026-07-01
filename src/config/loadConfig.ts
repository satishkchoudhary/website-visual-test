import path from "node:path";
import { pathToFileURL } from "node:url";
import type { VisualConfig, VisualConfigInput, VisualViewport } from "../types.js";
import { parseCliArgs, splitList } from "../lib/cli.js";
import { loadDotEnv } from "../lib/env.js";
import { normalizeBaseUrl } from "../lib/urls.js";

interface LoadConfigOptions {
  argv?: string[];
  requireUrls?: boolean;
  failOnDifference?: boolean;
}

export async function loadVisualConfig({
  argv = process.argv.slice(2),
  requireUrls = true,
  failOnDifference = true,
}: LoadConfigOptions = {}): Promise<VisualConfig> {
  const cli = parseCliArgs(argv);
  const envFile = await loadDotEnv(path.resolve(".env"));
  const env = { ...envFile, ...process.env };
  const userConfig = await loadUserConfig();

  const baselineUrl = normalizeBaseUrl(
    stringFirst(cli.baseline, env.BASELINE_URL, userConfig.baselineUrl),
    "BASELINE_URL",
  );
  const targetUrl = normalizeBaseUrl(
    stringFirst(cli.target, env.TARGET_URL, userConfig.targetUrl),
    "TARGET_URL",
  );

  if (requireUrls && (!baselineUrl || !targetUrl)) {
    throw new Error(
      "Missing required URLs. Set BASELINE_URL and TARGET_URL, or pass --baseline and --target.",
    );
  }

  const config: VisualConfig = {
    baselineUrl,
    targetUrl,
    outputDir: stringFirst(cli.output, env.VISUAL_OUTPUT_DIR, userConfig.outputDir, "visual-test-results"),
    urlsFile: stringFirst(cli.urlsFile, env.VISUAL_URLS_FILE, userConfig.urlsFile, "visual/urls.json"),
    urlsMarkdownFile: stringFirst(
      cli.urlsMarkdownFile,
      env.VISUAL_URLS_MARKDOWN_FILE,
      userConfig.urlsMarkdownFile,
      "visual/urls.md",
    ),
    pagesFile: stringFirst(cli.pagesFile, env.VISUAL_PAGES_FILE, userConfig.pagesFile, "visual/pages.json"),
    pagesMarkdownFile: stringFirst(
      cli.pagesMarkdownFile,
      env.VISUAL_PAGES_MARKDOWN_FILE,
      userConfig.pagesMarkdownFile,
      "visual/pages.md",
    ),
    maxPages: numberValue(first(cli.maxPages, env.VISUAL_MAX_PAGES, userConfig.maxPages), 100),
    urlSource: parseUrlSource(stringFirst(cli.urlSource, env.VISUAL_URL_SOURCE, userConfig.urlSource, "crawl")),
    sitemapPaths: listValue(cli.sitemaps, env.VISUAL_SITEMAPS, userConfig.sitemapPaths, ["/sitemap.xml", "/sitemap_index.xml"]),
    threshold: numberValue(first(cli.threshold, env.VISUAL_THRESHOLD, userConfig.threshold), 0.01),
    pixelThreshold: numberValue(first(cli.pixelThreshold, env.VISUAL_PIXEL_THRESHOLD, userConfig.pixelThreshold), 16),
    retryCount: numberValue(first(cli.retryCount, env.VISUAL_RETRY_COUNT, userConfig.retryCount), 1),
    timeoutMs: numberValue(first(cli.timeout, env.VISUAL_TIMEOUT_MS, userConfig.timeoutMs), 30000),
    waitUntil: stringFirst(cli.waitUntil, env.VISUAL_WAIT_UNTIL, userConfig.waitUntil, "networkidle") as VisualConfig["waitUntil"],
    waitForSelector: stringFirst(cli.waitForSelector, env.VISUAL_WAIT_FOR_SELECTOR, userConfig.waitForSelector, ""),
    fullPage: booleanValue(first(cli.fullPage, env.VISUAL_FULL_PAGE, userConfig.fullPage), true),
    allowQuery: booleanValue(first(cli.allowQuery, env.VISUAL_ALLOW_QUERY, userConfig.allowQuery), false),
    startPath: stringFirst(cli.startPath, env.VISUAL_START_PATH, userConfig.startPath, "/"),
    includePathPatterns: listValue(cli.include, env.VISUAL_INCLUDE, userConfig.includePathPatterns, ["/**"]),
    excludePathPatterns: listValue(cli.exclude, env.VISUAL_EXCLUDE, userConfig.excludePathPatterns, []),
    ignoredExtensions: userConfig.ignoredExtensions ?? [],
    viewports: parseViewports(first(cli.viewports, env.VISUAL_VIEWPORTS, userConfig.viewports, [])),
    maskSelectors: listValue(cli.mask, env.VISUAL_MASK, userConfig.maskSelectors, []),
    hideSelectors: listValue(cli.hide, env.VISUAL_HIDE, userConfig.hideSelectors, []),
    cookieBanner: userConfig.cookieBanner ?? { acceptSelectors: [], dismissSelectors: [] },
    page: stringFirst(cli.page, ""),
    viewport: stringFirst(cli.viewport, ""),
    dryRun: Boolean(cli.dryRun),
    json: Boolean(cli.json),
    runDir: stringFirst(cli.runDir, ""),
    failOnDifference,
  };

  if (config.viewport) {
    config.viewports = config.viewports.filter((viewport) => viewport.name === config.viewport);
    if (config.viewports.length === 0) throw new Error(`Unknown viewport: ${config.viewport}`);
  }

  return config;
}

export function summarizeConfig(config: VisualConfig): object {
  return {
    baselineUrl: config.baselineUrl,
    targetUrl: config.targetUrl,
    maxPages: config.maxPages,
    threshold: config.threshold,
    retryCount: config.retryCount,
    waitUntil: config.waitUntil,
    fullPage: config.fullPage,
    outputDir: config.outputDir,
    urlsFile: config.urlsFile,
    pagesFile: config.pagesFile,
    urlSource: config.urlSource,
    sitemapPaths: config.sitemapPaths,
    viewports: config.viewports,
    includePathPatterns: config.includePathPatterns,
    excludePathPatterns: config.excludePathPatterns,
  };
}

function parseUrlSource(value: string): VisualConfig["urlSource"] {
  if (value === "crawl" || value === "sitemap" || value === "both") return value;
  throw new Error(`Invalid URL source: ${value}. Use crawl, sitemap, or both.`);
}

async function loadUserConfig(): Promise<VisualConfigInput> {
  const configPath = path.resolve("visual.config.ts");
  const module = (await import(pathToFileURL(configPath).href)) as { default?: VisualConfigInput };
  return module.default ?? {};
}

function first(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function stringFirst(...values: unknown[]): string {
  const value = first(...values);
  return value === undefined ? "" : String(value);
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function listValue(cliValue: unknown, envValue: unknown, configValue: unknown, fallback: string[]): string[] {
  if (cliValue !== undefined) return splitList(cliValue);
  if (envValue !== undefined) return splitList(envValue);
  if (Array.isArray(configValue)) return configValue.map(String);
  return fallback;
}

function parseViewports(value: unknown): VisualViewport[] {
  if (Array.isArray(value)) return value as VisualViewport[];
  if (!value) return [];

  return splitList(value).map((item) => {
    const [namePart, sizePart] = item.includes(":") ? item.split(":") : item.split("=");
    const [width, height] = (sizePart ?? "").split("x").map(Number);
    if (!namePart || !width || !height) throw new Error(`Invalid viewport definition: ${item}`);
    return { name: namePart, width, height };
  });
}
