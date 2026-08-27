import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routePath = "apps/project-web/app/api/admin/capability-packs/route.ts";

describe("Capability Pack publication boundary", () => {
  it("has no generation, runtime, or provider-call path", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).not.toMatch(/\/prompt|GenerationAttempt|GenerationAuthorization|fetch\s*\(/);
    expect(source).toMatch(/CapabilityPublicationService/);
    expect(source).toMatch(/externalCalls: 0/);
  });
});
