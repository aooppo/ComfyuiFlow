import process, { loadEnvFile } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runProjectDevSupervisor } from "./project-dev-supervisor.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(workspaceRoot, ".env"));

try {
  const supervisor = await runProjectDevSupervisor({ workspaceRoot });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => supervisor.stop(signal));
  await Promise.all(
    supervisor.owned.map(
      ({ child }) =>
        new Promise((resolvePromise, reject) => {
          child.once("error", reject);
          child.once("exit", (code, signal) => {
            if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolvePromise();
            else
              reject(
                new Error(
                  `A supervised development service exited (${signal ?? code ?? "unknown"})`,
                ),
              );
          });
        }),
    ),
  );
} catch (error) {
  process.stderr.write(
    `Project development startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
}
