import { describe, expect, it } from "vitest";
import {
  CapabilityRegistryLoader,
  monetaryPolicyIsCurrent,
  resolveCapabilityCandidatesV2,
  selectCapabilityImplementationV2,
} from "@comfyuiflow/project-core";

const binding = (modality: "IMAGE" | "VIDEO" | "AUDIO", roleLabel = "reference") => ({
  id: "00000000-0000-4000-8000-000000000001",
  purpose: modality === "AUDIO" ? ("AUDIO" as const) : ("PRODUCT" as const),
  sourceKind: "SEMANTIC_ASSET_VERSION" as const,
  sourceRef: { id: "asset.product", version: "1" },
  sha256: "a".repeat(64),
  modality,
  order: 0,
  roleLabel,
  necessity: "REQUIRED" as const,
});

describe("capability implementation resolver V2", () => {
  it("selects exact text and reference capabilities without model-name branching", async () => {
    const registry = await new CapabilityRegistryLoader().load();
    const text = resolveCapabilityCandidatesV2(registry, {
      bindings: [],
      allowedTrialRefs: new Set(["implementation.hailuo03-text-partner@1.0.0"]),
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(selectCapabilityImplementationV2(text.compatible)).toMatchObject({
      id: "implementation.hailuo03-text-partner",
      compilerRef: { id: "compiler.hailuo03-text", version: "1.0.0" },
    });
    const reference = resolveCapabilityCandidatesV2(registry, {
      bindings: [binding("IMAGE")],
      allowedTrialRefs: new Set(["implementation.hailuo03-reference-dynamic@3.0.0"]),
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(selectCapabilityImplementationV2(reference.compatible)).toMatchObject({
      id: "implementation.hailuo03-reference-dynamic",
      lifecycle: "TRIAL",
      compilerRef: { id: "compiler.hailuo03-reference-dynamic", version: "3.0.0" },
    });
  });

  it("accepts explicit local compute without invented currency and rejects expired monetary facts", async () => {
    const registry = await new CapabilityRegistryLoader().load();
    const result = resolveCapabilityCandidatesV2(registry, {
      bindings: [],
      allowedTrialRefs: new Set([
        "implementation.hailuo03-text-partner@1.0.0",
        "implementation.local-text@1.0.0",
      ]),
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(
      selectCapabilityImplementationV2(result.compatible, { preferredCostKind: "LOCAL_COMPUTE" }),
    ).toMatchObject({ id: "implementation.local-text", costPolicy: { kind: "LOCAL_COMPUTE" } });
    expect(
      monetaryPolicyIsCurrent(
        {
          kind: "MONETARY",
          currency: "USD",
          pricingVersion: "old",
          estimatedCostMicros: 1,
          maximumCostMicros: 1,
          effectiveAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
        new Date("2026-08-26T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("returns stable blockers for audio-only and production fixtures", async () => {
    const registry = await new CapabilityRegistryLoader().load();
    const result = resolveCapabilityCandidatesV2(registry, {
      bindings: [binding("AUDIO")],
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(result.compatible).toEqual([]);
    expect(
      result.rejected.find(
        (item) => item.implementationRef.id === "implementation.hailuo03-reference-dynamic",
      )?.reasonCodes,
    ).toEqual(expect.arrayContaining(["INPUT_INVARIANT_FAILED"]));
    expect(
      result.rejected.find((item) => item.implementationRef.id === "implementation.test-zero-call")
        ?.reasonCodes,
    ).toContain("TEST_ONLY_IMPLEMENTATION");
  });

  it("keeps an exact TRIAL allowlist local to each resolver call", async () => {
    const registry = await new CapabilityRegistryLoader().load();
    const exactRef = "implementation.hailuo03-text-partner@1.0.0";
    const approvedShot = resolveCapabilityCandidatesV2(registry, {
      bindings: [],
      allowedTrialRefs: new Set([exactRef]),
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(approvedShot.compatible.map((item) => `${item.id}@${item.version}`)).toContain(exactRef);

    const unapprovedShot = resolveCapabilityCandidatesV2(registry, {
      bindings: [],
      now: new Date("2026-08-26T12:00:00.000Z"),
    });
    expect(unapprovedShot.compatible.map((item) => `${item.id}@${item.version}`)).not.toContain(
      exactRef,
    );
    expect(
      unapprovedShot.rejected.find(
        (item) => `${item.implementationRef.id}@${item.implementationRef.version}` === exactRef,
      )?.reasonCodes,
    ).toContain("TRIAL_SCOPE_REQUIRED");
  });
});
