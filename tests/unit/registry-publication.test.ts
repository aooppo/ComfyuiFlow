import { describe, expect, it } from "vitest";
import type { DiscoveryCandidateV2, RegistryPublicationV2 } from "@comfyuiflow/contracts";
import { CapabilityRegistryLoader, validateReviewedPublication } from "@comfyuiflow/project-core";
import type { RegistryPublicationValidationError } from "@comfyuiflow/project-core";

async function fixture() {
  const registry = await new CapabilityRegistryLoader().load();
  const implementation = registry.document.implementations.find(
    (item) => item.id === "implementation.hailuo03-text-partner",
  )!;
  implementation.lifecycle = "DISCOVERED";
  const compiler = registry.document.compilers.find(
    (item) =>
      item.id === implementation.compilerRef.id &&
      item.version === implementation.compilerRef.version,
  )!;
  const candidate: DiscoveryCandidateV2 = {
    id: "discovery.runtime.hailuo-text",
    version: "schema-1",
    runtimeRef: implementation.runtimeRef,
    discoveredAt: "2026-08-26T00:00:00.000Z",
    sourceDigest: compiler.sourceDigest,
    nodeIdentifier: "HailuoTextNode",
    normalizedInputs: [{ name: "prompt", type: "STRING", required: true }],
    normalizedOutputs: [{ index: 0, type: "VIDEO" }],
    dynamicGroups: [],
    rawSchemaRef: `raw-schema.${compiler.sourceDigest}`,
    status: "DISCOVERED",
  };
  const publication: RegistryPublicationV2 = {
    id: "publication.hailuo-text",
    version: "1.0.0",
    candidateRef: { id: candidate.id, version: candidate.version },
    sourceDigest: candidate.sourceDigest,
    providerRef: implementation.providerRef,
    modelRef: implementation.modelRef,
    adapterRef: implementation.adapterRef,
    compilerRef: implementation.compilerRef,
    implementationRef: { id: implementation.id, version: implementation.version },
    costPolicy: implementation.costPolicy,
    reviewerRef: "operator.local",
    reviewedAt: "2026-08-26T00:00:00.000Z",
  };
  return { registry, candidate, publication, implementation };
}

describe("reviewed registry publication", () => {
  it("accepts only a complete exact composition and creates a TRIAL decision", async () => {
    const { registry, candidate, publication } = await fixture();
    expect(validateReviewedPublication(registry, candidate, publication)).toEqual({
      implementationLifecycle: "TRIAL",
      publication,
    });
  });

  it.each([
    ["sourceDigest", "DISCOVERY_SOURCE_DIGEST_MISMATCH"],
    ["providerRef", "PROVIDER_IDENTITY_UNRESOLVED"],
    ["compilerRef", "INPUT_SEMANTICS_UNREVIEWED"],
    ["costPolicy", "COST_POLICY_UNRESOLVED"],
  ] as const)("returns a stable code for an invalid %s", async (field, code) => {
    const { registry, candidate, publication } = await fixture();
    const invalid = structuredClone(publication) as RegistryPublicationV2;
    if (field === "sourceDigest") invalid.sourceDigest = "f".repeat(64);
    if (field === "providerRef") invalid.providerRef = { id: "provider.unknown", version: "1" };
    if (field === "compilerRef") invalid.compilerRef = { id: "compiler.unknown", version: "1" };
    if (field === "costPolicy") invalid.costPolicy = { kind: "LOCAL_COMPUTE" };
    expect(() => validateReviewedPublication(registry, candidate, invalid)).toThrow(
      expect.objectContaining<Partial<RegistryPublicationValidationError>>({ code }),
    );
  });

  it("rejects republishing a selectable implementation version instead of mutating it", async () => {
    const { registry, candidate, publication, implementation } = await fixture();
    implementation.lifecycle = "TRIAL";
    expect(() => validateReviewedPublication(registry, candidate, publication)).toThrow(
      expect.objectContaining<Partial<RegistryPublicationValidationError>>({
        code: "IMPLEMENTATION_VERSION_CONFLICT",
      }),
    );
  });
});
