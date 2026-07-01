import { spawn } from "node:child_process";

const args = new Set(process.argv.slice(2));
const steps = [
  {
    command: "npm",
    args: ["install"],
    label: "Installing npm dependencies",
    skip: args.has("--skip-install"),
  },
  {
    command: "npx",
    args: ["playwright", "install", "chromium"],
    label: "Installing Playwright Chromium",
    skip: args.has("--skip-browser"),
  },
  {
    command: "npm",
    args: ["run", "preflight"],
    label: "Running preflight checks",
    skip: args.has("--skip-preflight"),
  },
];

for (const step of steps) {
  if (step.skip) {
    console.log(`Skipping: ${step.label}`);
    continue;
  }

  console.log(`\n${step.label}`);
  await run(step.command, step.args);
}

console.log("\nSetup complete.");

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code}`));
      }
    });
  });
}
