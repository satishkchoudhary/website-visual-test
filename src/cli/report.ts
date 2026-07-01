import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";

try {
  const config = await loadVisualConfig({ requireUrls: false });
  console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  throw new Error("Report implementation will be added in a later step.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
