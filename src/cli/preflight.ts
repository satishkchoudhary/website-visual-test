import { parseCliArgs } from "../lib/cli.js";
import { renderPreflightText, runPreflight } from "../preflight.js";

try {
  const args = parseCliArgs();
  const result = await runPreflight({
    port: typeof args.port === "number" ? args.port : undefined,
  });

  console.log(args.json ? JSON.stringify(result, null, 2) : renderPreflightText(result));
  if (!result.ok) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
