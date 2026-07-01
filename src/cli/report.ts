import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";
import { generateReports } from "../report.js";

try {
  const config = await loadVisualConfig({ requireUrls: false });

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    const reports = await generateReports(config);
    console.log(`HTML report: ${reports.htmlPath}`);
    console.log(`Markdown report: ${reports.markdownPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
