import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("asset revalidation concurrency", () => {
  it("retries only probe-ordinal uniqueness races before changing asset status", async () => {
    const source = await readFile("packages/project-core/src/asset-service.ts", "utf8");
    expect(source).toContain("for (let attempt = 0; attempt < 3; attempt += 1)");
    expect(source).toContain('error.code === "P2002"');
    expect(source).toContain("if (!this.isUniqueConflict(error) || attempt === 2) throw error");
    expect(source.indexOf("if (!updated) throw new Error")).toBeLessThan(
      source.indexOf("results.push({ asset: assetDto(updated)"),
    );
  });
});
