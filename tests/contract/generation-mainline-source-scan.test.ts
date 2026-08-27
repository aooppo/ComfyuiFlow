import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceRoots = ["apps", "packages", "scripts"];
const forbidden = [
  /GenerationProvider/,
  /LegacyGenerationProviderAdapter/,
  /WorkflowRegistry/,
  /capability-v3/i,
  /fake-video-v1/i,
  /legacy-h3/i,
  /fixed-h3/i,
  /hailuo03-reference-dynamic/i,
];

async function trackedSource() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)("git", ["ls-files", ...sourceRoots]);
  return stdout.split("\n").filter((path) => existsSync(path) && /\.(?:ts|tsx|md)$/.test(path));
}

describe("Feature 017 production retirement boundary", () => {
  it("contains no retired provider, registry, version, or fixed-workflow symbol", async () => {
    for (const path of await trackedSource()) {
      const source = await readFile(path, "utf8");
      for (const expression of forbidden)
        expect(source, `${path} matched ${expression}`).not.toMatch(expression);
    }
  });
});
