import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";
import { runVisualWorkflow } from "../workflow.js";

try {
  const config = await loadVisualConfig({ failOnDifference: true });

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    const result = await runVisualWorkflow(config);
    console.log(`Discovered/tested pages: ${result.visualRun.summary.pages}`);
    console.log(`Comparisons: ${result.visualRun.summary.comparisons}`);
    console.log(`Passed: ${result.visualRun.summary.passed}`);
    console.log(`Failed: ${result.visualRun.summary.failed}`);
    console.log(`Errors: ${result.visualRun.summary.errors}`);
    console.log(`Run: ${result.visualRun.runDir}`);
    console.log(`HTML report: ${result.reports.htmlPath}`);
    console.log(`Markdown report: ${result.reports.markdownPath}`);

    if (result.visualRun.summary.failed > 0 || result.visualRun.summary.errors > 0) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
