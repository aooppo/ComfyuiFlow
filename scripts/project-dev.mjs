import { spawn } from "node:child_process";
import process, { loadEnvFile } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(workspaceRoot, ".env"));

const child = spawn(
  "pnpm",
  [
    "--parallel",
    "--filter",
    "@comfyuiflow/project-web",
    "--filter",
    "@comfyuiflow/project-worker",
    "dev",
  ],
  {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  process.stderr.write(`Project development services failed to start: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
