import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";
import { crawlPages } from "../crawler.js";

try {
  const config = await loadVisualConfig();

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    const manifest = await crawlPages(config);
    console.log(`Discovered ${manifest.pages.length} page(s).`);
    console.log(`Checklist: ${config.pagesMarkdownFile}`);
    console.log(`JSON: ${config.pagesFile}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
