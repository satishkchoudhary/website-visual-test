import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";

try {
  const config = await loadVisualConfig();

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    throw new Error("Crawler implementation will be added in the next step.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
