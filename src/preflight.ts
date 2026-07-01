import { constants } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";

export type PreflightStatus = "pass" | "warn" | "fail";

export interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightStatus;
  detail: string;
  help?: string;
}

export interface PreflightOptions {
  port?: number;
  serverAlreadyRunning?: boolean;
}

export interface PreflightResult {
  generatedAt: string;
  ok: boolean;
  checks: PreflightCheck[];
}

const minimumNodeMajor = 18;

export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightResult> {
  const port = options.port ?? Number(process.env.PORT || 4317);
  const checks: PreflightCheck[] = [];

  checks.push(checkNodeVersion());
  checks.push(await checkPath("package.json", "Project package", "Found package.json."));
  checks.push(await checkPath("node_modules", "Dependencies", "Found node_modules.", "Run npm install."));
  checks.push(await checkPath("node_modules/tsx", "TypeScript runner", "Found tsx package.", "Run npm install."));
  checks.push(await checkChromium());
  checks.push(await checkWritableDir("visual", "URL inventory folder"));
  checks.push(await checkWritableDir("visual-test-results", "Report output folder"));
  checks.push(await checkPort(port, options.serverAlreadyRunning));

  return {
    generatedAt: new Date().toISOString(),
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

export function renderPreflightText(result: PreflightResult): string {
  const lines = [
    `Preflight: ${result.ok ? "PASS" : "FAIL"}`,
    `Generated: ${result.generatedAt}`,
    "",
    ...result.checks.map((check) => {
      const marker = check.status.toUpperCase().padEnd(4, " ");
      return `[${marker}] ${check.label}: ${check.detail}${check.help ? ` (${check.help})` : ""}`;
    }),
  ];

  return lines.join("\n");
}

function checkNodeVersion(): PreflightCheck {
  const [major = "0"] = process.versions.node.split(".");
  const supported = Number(major) >= minimumNodeMajor;

  return {
    id: "node-version",
    label: "Node.js version",
    status: supported ? "pass" : "fail",
    detail: `Running Node ${process.versions.node}. Minimum supported version is ${minimumNodeMajor}.`,
    ...(supported ? {} : { help: "Install Node 18 or newer." }),
  };
}

async function checkPath(filePath: string, label: string, passDetail: string, help?: string): Promise<PreflightCheck> {
  try {
    await access(path.resolve(filePath), constants.F_OK);
    return {
      id: `path-${filePath.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      label,
      status: "pass",
      detail: passDetail,
    };
  } catch {
    return {
      id: `path-${filePath.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      label,
      status: "fail",
      detail: `Missing ${filePath}.`,
      ...(help ? { help } : {}),
    };
  }
}

async function checkChromium(): Promise<PreflightCheck> {
  const executablePath = chromium.executablePath();

  try {
    await access(executablePath, constants.X_OK);
    return {
      id: "playwright-chromium",
      label: "Playwright Chromium",
      status: "pass",
      detail: "Chromium browser binary is installed.",
    };
  } catch {
    return {
      id: "playwright-chromium",
      label: "Playwright Chromium",
      status: "fail",
      detail: "Chromium browser binary is missing.",
      help: "Run npx playwright install chromium.",
    };
  }
}

async function checkWritableDir(dirPath: string, label: string): Promise<PreflightCheck> {
  const absoluteDir = path.resolve(dirPath);
  const testFile = path.join(absoluteDir, `.preflight-${Date.now()}.tmp`);

  try {
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(testFile, "ok", "utf8");
    await rm(testFile, { force: true });
    return {
      id: `writable-${dirPath.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      label,
      status: "pass",
      detail: `${dirPath} is writable.`,
    };
  } catch (error) {
    return {
      id: `writable-${dirPath.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      label,
      status: "fail",
      detail: `Cannot write to ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
      help: "Check folder permissions or choose a writable project location.",
    };
  }
}

async function checkPort(port: number, serverAlreadyRunning = false): Promise<PreflightCheck> {
  if (serverAlreadyRunning) {
    return {
      id: "dashboard-port",
      label: "Dashboard port",
      status: "pass",
      detail: `Dashboard is already running on port ${port}.`,
    };
  }

  const available = await isPortAvailable(port);
  return {
    id: "dashboard-port",
    label: "Dashboard port",
    status: available ? "pass" : "warn",
    detail: available ? `Port ${port} is available.` : `Port ${port} is already in use.`,
    ...(available ? {} : { help: "Stop the existing server or set a different PORT value." }),
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}
