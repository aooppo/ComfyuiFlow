import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { isIP } from "node:net";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

/* global AbortSignal, fetch */

const secretName = /(secret|token|password|credential|api[_-]?key)/i;
const forbiddenInstallArgument = /^(install|add|i|update|upgrade)$/i;

export function assertLoopbackUrl(value, label = "service") {
  const parsed = new URL(value);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    (isIP(hostname) === 4 && hostname.startsWith("127."));
  if (!loopback || !["http:", "https:"].includes(parsed.protocol))
    throw new Error(`${label} must use a loopback HTTP endpoint`);
  return parsed;
}

export function redactSecrets(value, environment = process.env) {
  let result = String(value);
  for (const [name, secret] of Object.entries(environment)) {
    if (!secret || !secretName.test(name) || secret.length < 4) continue;
    result = result.split(secret).join("[REDACTED]");
  }
  return result
    .replace(
      /((?:api[_-]?key|token|password|secret|credential)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, "$1[REDACTED]@");
}

export function assertNoInstallCommand(command, args = []) {
  const executable = String(command).toLowerCase();
  if (
    ["npm", "pnpm", "yarn", "pip", "pip3", "uv", "brew"].some((name) =>
      executable.endsWith(name),
    ) &&
    args.some((argument) => forbiddenInstallArgument.test(String(argument)))
  ) {
    throw new Error("Development supervisor must not install packages, nodes, or models");
  }
}

export function createOwnedProcess(command, args, options, ownership) {
  assertNoInstallCommand(command, args);
  const child = spawn(command, args, { ...options, shell: false });
  const marker = Object.freeze({
    ownerPid: process.pid,
    childPid: child.pid,
    cwd: resolve(options.cwd),
    startedAt: new Date().toISOString(),
    ownershipToken: ownership,
  });
  return { child, marker };
}

export function stopOwnedProcess(owned, ownership, signal = "SIGTERM") {
  if (!owned || owned.marker.ownerPid !== process.pid || owned.marker.ownershipToken !== ownership)
    throw new Error("Refusing to stop a process not owned by this supervisor");
  return owned.child.kill(signal);
}

async function waitForHttp(url, timeoutMs, fetchImplementation = fetch) {
  assertLoopbackUrl(url);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImplementation(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return true;
    } catch {
      // Health may be unavailable while the owned service is starting.
    }
    await delay(250);
  }
  return false;
}

function commandOnce(command, args, options) {
  assertNoInstallCommand(command, args);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${command} exited before readiness (${signal ?? code ?? "unknown"})`)),
    );
  });
}

export async function runProjectDevSupervisor({
  workspaceRoot,
  environment = process.env,
  fetchImplementation = fetch,
}) {
  const ownership = `${process.pid}:${Date.now()}`;
  const owned = [];
  const write = (message) => process.stderr.write(`${redactSecrets(message, environment)}\n`);
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for project development");
  const database = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(database.hostname))
    throw new Error("Project development PostgreSQL must be loopback-local");
  await commandOnce("docker", ["compose", "up", "-d", "project-postgres"], {
    cwd: workspaceRoot,
    env: environment,
  });
  await commandOnce("pnpm", ["project:db:migrate"], { cwd: workspaceRoot, env: environment });
  write("PostgreSQL is ready and migrations are deployed.");

  const comfyUrl = environment.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";
  assertLoopbackUrl(comfyUrl, "ComfyUI");
  if (
    !(await waitForHttp(`${comfyUrl.replace(/\/$/, "")}/system_stats`, 1_500, fetchImplementation))
  ) {
    const installDirectory = environment.COMFYUI_INSTALL_DIR;
    if (installDirectory) {
      const trustedDirectory = await realpath(installDirectory);
      const entrypoint = resolve(trustedDirectory, "main.py");
      if (!existsSync(entrypoint)) throw new Error("Configured ComfyUI install has no main.py");
      const processRecord = createOwnedProcess(
        environment.COMFYUI_PYTHON ?? "python3",
        [entrypoint, "--listen", "127.0.0.1", "--port", new URL(comfyUrl).port || "8188"],
        { cwd: trustedDirectory, env: environment, stdio: "inherit" },
        ownership,
      );
      owned.push(processRecord);
      if (
        !(await waitForHttp(
          `${comfyUrl.replace(/\/$/, "")}/system_stats`,
          30_000,
          fetchImplementation,
        ))
      )
        throw new Error("ComfyUI did not become healthy");
      write("Owned loopback ComfyUI is healthy.");
    } else write("ComfyUI is unavailable; generation readiness remains blocked.");
  } else write("Existing loopback ComfyUI is healthy and remains externally owned.");

  for (const [filter, label] of [
    ["@comfyuiflow/project-web", "Web"],
    ["@comfyuiflow/project-worker", "Worker"],
  ]) {
    const processRecord = createOwnedProcess(
      "pnpm",
      ["--filter", filter, "dev"],
      { cwd: workspaceRoot, env: environment, stdio: "inherit" },
      ownership,
    );
    owned.push(processRecord);
    write(`${label} started under supervisor ownership.`);
  }
  const stop = (signal = "SIGTERM") => {
    for (const processRecord of [...owned].reverse())
      if (!processRecord.child.killed) stopOwnedProcess(processRecord, ownership, signal);
  };
  return { ownership, owned, stop };
}
