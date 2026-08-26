import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("capability registry operator API", () => {
  it("keeps discovery read-only to generation, operator-gated, redacted, and no-store", async () => {
    const [candidateRoute, implementationRoute, operatorGuard] = await Promise.all([
      readFile(
        "apps/project-web/app/api/generation-registry/discovery-candidates/route.ts",
        "utf8",
      ),
      readFile("apps/project-web/app/api/generation-registry/implementations/route.ts", "utf8"),
      readFile("apps/project-web/lib/capability-registry-operator.ts", "utf8"),
    ]);
    for (const route of [candidateRoute, implementationRoute]) {
      expect(route).toContain('"Cache-Control": "no-store"');
      expect(route).toContain("assertCapabilityRegistryOperator");
      expect(route).not.toContain("submitWorkflow");
      expect(route).not.toContain('"/prompt"');
      expect(route).not.toContain("credential");
    }
    expect(candidateRoute).toContain("discoverNodeCapabilities");
    expect(candidateRoute).toContain("persistCandidate");
    expect(implementationRoute).toContain("persistPublication");
    expect(implementationRoute).toContain("promoteReady");
    expect(operatorGuard).toContain("PROJECT_CAPABILITY_REGISTRY_OPERATOR_ENABLED");
    expect(operatorGuard).toContain("REGISTRY_OPERATOR_DISABLED");
    expect(operatorGuard).toContain("REGISTRY_OPERATOR_ORIGIN_REQUIRED");
  });
});
