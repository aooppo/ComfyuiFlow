import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { redactSecrets } from "@comfyuiflow/spike-core";

const execFileAsync = promisify(execFile);

describe("secret safety", () => {
  it("redacts provider keys and explicit secret values recursively", () => {
    const secret = "test-secret-value-12345";
    const output = redactSecrets(
      {
        message: `Bearer abcdefghijklmnopqrstuvwxyz ${secret}`,
        provider: "s" + "k-proj-abcdefghijklmnopqrstuvwxyz",
        CODEX_MANAGER_API_KEY: "local-gateway-secret-value",
        COMFYUI_API_KEY: "comfy-partner-secret-value",
      },
      [secret],
    );
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(JSON.stringify(output)).not.toContain("sk-proj-");
    expect(JSON.stringify(output)).not.toContain("local-gateway-secret-value");
    expect(JSON.stringify(output)).not.toContain("comfy-partner-secret-value");
    expect(JSON.stringify(output)).toContain("[REDACTED_SECRET]");
  });

  it("finds no committed provider credential pattern", async () => {
    const { stdout } = await execFileAsync("node", ["scripts/secret-scan.mjs"], {
      cwd: process.cwd(),
    });
    expect(stdout).toContain("Secret scan passed");
  });

  it("keeps the frozen-plan MCP input free of paths, endpoints, secrets, and raw graphs", async () => {
    const source = await readFile("apps/comfyui-mcp/src/server.ts", "utf8");
    const start = source.indexOf('"comfyui_submit_execution_plan"');
    const end = source.indexOf('"comfyui_retain_execution_plan_artifacts"', start);
    const tool = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(tool).toContain("executionPlanId");
    expect(tool).toContain("authorizationConsumptionId");
    expect(tool).not.toMatch(/localPath|baseUrl|endpoint|apiKey|credential|graphJson|class_type/);
  });

  it("keeps the readiness response business-safe", async () => {
    const source = await readFile(
      "packages/project-core/src/workflow-agent/readiness-service.ts",
      "utf8",
    );
    const returned = source.slice(
      source.indexOf("return {", source.indexOf("const dependencyReady")),
    );
    expect(returned).toContain("readyForNewRealSubmission");
    expect(returned).toContain("externalCalls: 0");
    expect(returned).not.toMatch(
      /DATABASE_URL|COMFYUI_BASE_URL|COMFYUI_INSTALL_DIR|API_KEY|AUTH_TOKEN|registryPath/,
    );
  });
});
