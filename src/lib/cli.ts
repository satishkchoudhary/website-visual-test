export interface ParsedCliArgs {
  [key: string]: string | number | boolean | string[] | undefined;
  _: string[];
}

export function parseCliArgs(argv = process.argv.slice(2)): ParsedCliArgs {
  const args: ParsedCliArgs = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const raw = token.slice(2);
    if (raw.startsWith("no-")) {
      args[toCamelCase(raw.slice(3))] = false;
      continue;
    }

    const equalsIndex = raw.indexOf("=");
    if (equalsIndex >= 0) {
      args[toCamelCase(raw.slice(0, equalsIndex))] = parseValue(raw.slice(equalsIndex + 1));
      continue;
    }

    const key = toCamelCase(raw);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = parseValue(next);
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function parseValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}
