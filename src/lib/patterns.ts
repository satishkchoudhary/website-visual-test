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
  const source = globToRegexSource(normalizedPattern);

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

function globToRegexSource(pattern: string): string {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(char);
    }
  }

  return source;
}
