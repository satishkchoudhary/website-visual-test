import path from "node:path";
import type { VisualConfig } from "../types.js";
import { matchesAny, normalizePathname } from "./patterns.js";

export function normalizeBaseUrl(value: string | undefined, label: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${label} must be a valid absolute URL. Received: ${value}`);
  }
}

export function buildUrl(baseUrl: string, pathname: string): string {
  const url = new URL(baseUrl);
  url.pathname = normalizePathname(pathname);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function normalizeDiscoveredPath(
  rawUrl: string,
  origin: string,
  config: VisualConfig,
): string | null {
  let url: URL;

  try {
    url = new URL(rawUrl, origin);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (url.hash) url.hash = "";
  if (!config.allowQuery) url.search = "";

  const pathname = normalizePathname(decodeURIComponent(url.pathname));
  const extension = path.extname(pathname).toLowerCase();

  if (extension && config.ignoredExtensions.includes(extension)) return null;
  if (!matchesAny(pathname, config.includePathPatterns)) return null;
  if (matchesAny(pathname, config.excludePathPatterns)) return null;

  return pathname;
}
