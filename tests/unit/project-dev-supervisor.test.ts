import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  assertLoopbackUrl,
  assertNoInstallCommand,
  redactSecrets,
  stopOwnedProcess,
} from "../../scripts/project-dev-supervisor.mjs";

describe("project development supervisor", () => {
  it("accepts loopback only and redacts credentials", () => {
    expect(assertLoopbackUrl("http://127.0.0.1:8188").port).toBe("8188");
    expect(() => assertLoopbackUrl("https://provider.example.com")).toThrow("loopback");
    const output = redactSecrets(
      "token=visible-value postgresql://user:db-password@127.0.0.1/db visible-value",
      { COMFYUI_API_KEY: "visible-value" },
    );
    expect(output).not.toMatch(/visible-value|db-password/);
    expect(output).toContain("[REDACTED]");
  });

  it("forbids package/node/model installation commands", () => {
    expect(() => assertNoInstallCommand("pnpm", ["install"])).toThrow("must not install");
    expect(() => assertNoInstallCommand("pip3", ["install", "custom-node"])).toThrow(
      "must not install",
    );
    expect(() => assertNoInstallCommand("pnpm", ["--filter", "app", "dev"])).not.toThrow();
  });

  it("stops only a child carrying the exact ownership marker", () => {
    const kill = vi.fn(() => true);
    const child = Object.assign(new EventEmitter(), { pid: 321, kill, killed: false });
    const owned = {
      child,
      marker: {
        ownerPid: process.pid,
        childPid: 321,
        cwd: process.cwd(),
        startedAt: new Date().toISOString(),
        ownershipToken: "owner-a",
      },
    };
    expect(stopOwnedProcess(owned, "owner-a")).toBe(true);
    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(() => stopOwnedProcess(owned, "owner-b")).toThrow("not owned");
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("keeps migration/health checks explicit and contains no installer workflow", async () => {
    const source = await readFile(
      new URL("../../scripts/project-dev-supervisor.mjs", import.meta.url),
      "utf8",
    );
    expect(source).toContain("project:db:migrate");
    expect(source).toContain("/system_stats");
    expect(source).toContain("COMFYUI_INSTALL_DIR");
    expect(source).not.toMatch(/(?:pnpm|npm|pip3?)\s+["']?(?:install|add)/);
  });
});
