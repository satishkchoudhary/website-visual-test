import type { PageScreenshotOptions } from "playwright";

export type ViewportName = string;
export type PageWaitUntil = "commit" | "domcontentloaded" | "load" | "networkidle";
export type UrlExtractionSource = "crawl" | "sitemap" | "both" | "manual";

export interface VisualViewport {
  name: ViewportName;
  width: number;
  height: number;
}

export interface CookieBannerConfig {
  acceptSelectors: string[];
  dismissSelectors: string[];
}

export interface VisualConfigInput {
  baselineUrl?: string;
  targetUrl?: string;
  outputDir?: string;
  pagesFile?: string;
  pagesMarkdownFile?: string;
  urlsFile?: string;
  urlsMarkdownFile?: string;
  urlSource?: UrlExtractionSource;
  sitemapPaths?: string[];
  manualPaths?: string[];
  maxPages?: number;
  threshold?: number;
  pixelThreshold?: number;
  retryCount?: number;
  timeoutMs?: number;
  waitUntil?: PageWaitUntil;
  waitForSelector?: string;
  fullPage?: boolean;
  allowQuery?: boolean;
  startPath?: string;
  includePathPatterns?: string[];
  excludePathPatterns?: string[];
  ignoredExtensions?: string[];
  viewports?: VisualViewport[];
  maskSelectors?: string[];
  hideSelectors?: string[];
  cookieBanner?: CookieBannerConfig;
}

export interface VisualConfig extends Required<VisualConfigInput> {
  page: string;
  viewport: string;
  dryRun: boolean;
  json: boolean;
  runDir: string;
  failOnDifference: boolean;
}

export interface PageEntry {
  path: string;
  baselineUrl: string;
  targetUrl: string;
  discoverySource: string;
  status: "ready" | "error" | "skipped";
  notes: string;
}

export interface PageManifest {
  generatedAt: string;
  baselineUrl: string;
  targetUrl: string;
  maxPages: number;
  pages: PageEntry[];
}

export interface UrlInventory {
  generatedAt: string;
  baselineUrl: string;
  targetUrl: string;
  maxPages: number;
  urlSource: UrlExtractionSource;
  sitemapPaths: string[];
  urls: PageEntry[];
  notes: string[];
}

export interface ScreenshotPaths {
  baseline: string;
  target: string;
  diff: string;
}

export interface ComparisonMetadata {
  path: string;
  baselineUrl: string;
  targetUrl: string;
  viewport: VisualViewport;
  timestamp: string;
  screenshotPaths: ScreenshotPaths;
  browser: string;
  status: ComparisonStatus;
  mismatchPercentage: number;
  threshold: number;
  attempts: number;
  error?: string;
}

export type ComparisonStatus = "passed" | "failed" | "skipped" | "error";

export interface ComparisonResult extends ComparisonMetadata {
  metadataPath: string;
}

export interface RunSummary {
  pages: number;
  comparisons: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
}

export interface VisualRunResult {
  startedAt: string;
  completedAt: string;
  baselineUrl: string;
  targetUrl: string;
  threshold: number;
  outputDir: string;
  runDir: string;
  pagesFile: string;
  summary: RunSummary;
  results: ComparisonResult[];
}

export type ScreenshotMode = Pick<PageScreenshotOptions, "fullPage">;
