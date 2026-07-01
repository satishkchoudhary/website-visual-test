import { loadVisualConfig, summarizeConfig } from "../config/loadConfig.js";
import { runVisualTest } from "../visualTest.js";

try {
  const config = await loadVisualConfig();

  if (config.dryRun) {
    console.log(config.json ? JSON.stringify(summarizeConfig(config), null, 2) : summarizeConfig(config));
  } else {
    const result = await runVisualTest(config);
    console.log(`Compared ${result.summary.comparisons} screenshot pair(s).`);
    console.log(`Passed: ${result.summary.passed}`);
    console.log(`Failed: ${result.summary.failed}`);
    console.log(`Errors: ${result.summary.errors}`);
    console.log(`Run: ${result.runDir}`);

    if (config.failOnDifference && (result.summary.failed > 0 || result.summary.errors > 0)) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
