import { execFile } from "node:child_process";
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
      },
      [secret],
    );
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(JSON.stringify(output)).not.toContain("sk-proj-");
    expect(JSON.stringify(output)).toContain("[REDACTED_SECRET]");
  });

  it("finds no committed provider credential pattern", async () => {
    const { stdout } = await execFileAsync("node", ["scripts/secret-scan.mjs"], {
      cwd: process.cwd(),
    });
    expect(stdout).toContain("Secret scan passed");
  });
});
