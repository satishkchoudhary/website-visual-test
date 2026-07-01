import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";
import { extractUrls } from "../urlExtractor.js";

try {
  const config = await loadVisualConfig();

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    const inventory = await extractUrls(config);
    console.log(`Extracted ${inventory.urls.length} URL(s) using ${inventory.urlSource}.`);
    console.log(`URL inventory: ${config.urlsMarkdownFile}`);
    console.log(`URL JSON: ${config.urlsFile}`);
    console.log(`Comparison checklist: ${config.pagesMarkdownFile}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
