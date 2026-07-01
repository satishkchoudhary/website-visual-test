export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const value = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
}

export function matchesAny(pathname: string, patterns: string[] = []): boolean {
  return patterns.some((pattern) => matchesPattern(pathname, pattern));
}

export function matchesPattern(pathname: string, pattern: string): boolean {
  if (!pattern || pattern === "**" || pattern === "/**") return true;
  if (pattern.startsWith("regex:")) {
    return new RegExp(pattern.slice("regex:".length)).test(pathname);
  }

  const normalizedPattern = pattern.startsWith("/") ? pattern : `/${pattern}`;
  const source = escapeRegExp(normalizedPattern)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");

  return new RegExp(`^${source}$`).test(pathname);
}

export function slugifyPath(pathname: string): string {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return "home";

  return normalized
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "page";
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
