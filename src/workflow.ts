import type { VisualConfig, VisualRunResult } from "./types.js";
import { generateReports, type ReportOutputs } from "./report.js";
import { extractUrls } from "./urlExtractor.js";
import { runVisualTest } from "./visualTest.js";

export interface WorkflowResult {
  visualRun: VisualRunResult;
  reports: ReportOutputs;
}

export async function runVisualWorkflow(config: VisualConfig): Promise<WorkflowResult> {
  await extractUrls(config);
  const visualRun = await runVisualTest(config);
  const reports = await generateReports(config, visualRun);
  return { visualRun, reports };
}
