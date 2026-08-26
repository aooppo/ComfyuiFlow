import { describe, expect, it } from "vitest";
import type { GenerationImplementationV2, ImplementationEvidenceV2 } from "@comfyuiflow/contracts";
import { assessReadyPromotion } from "@comfyuiflow/project-core";

const implementation: GenerationImplementationV2 = {
  id: "implementation.example",
  version: "1.0.0",
  runtimeRef: { id: "runtime.example", version: "1" },
  providerRef: { id: "provider.example", version: "1" },
  modelRef: { id: "model.example", version: "1" },
  adapterRef: { id: "adapter.example", version: "1" },
  compilerRef: { id: "compiler.example", version: "1" },
  capabilityCodes: ["TEXT_TO_VIDEO"],
  costPolicy: {
    kind: "MONETARY",
    currency: "USD",
    pricingVersion: "1",
    estimatedCostMicros: 1,
    maximumCostMicros: 1,
    effectiveAt: "2026-08-26T00:00:00.000Z",
    expiresAt: "2026-08-27T00:00:00.000Z",
  },
  lifecycle: "TRIAL",
  evidencePolicy: "EXACT_VERSION_REAL_RESULT",
  testOnly: false,
};

const evidence = (
  kind: ImplementationEvidenceV2["kind"],
  outcome: ImplementationEvidenceV2["outcome"] = "PASS",
): ImplementationEvidenceV2 => ({
  id: `evidence.${kind.toLowerCase()}.${outcome.toLowerCase()}`,
  version: "1",
  implementationRef: { id: implementation.id, version: implementation.version },
  compilerRef: implementation.compilerRef,
  kind,
  outcome,
  callCount: kind === "AUTHORIZED_REAL_EXECUTION" ? 1 : 0,
  costDigest: kind === "AUTHORIZED_REAL_EXECUTION" ? "a".repeat(64) : null,
  artifactRefs: [],
  reviewerRef: "operator.local",
  recordedAt: "2026-08-26T00:00:00.000Z",
});

describe("exact-version implementation evidence", () => {
  it("requires explicit exact-version contract, readiness, and authorized real evidence", () => {
    expect(
      assessReadyPromotion(implementation, [evidence("CONTRACT"), evidence("RUNTIME_READINESS")]),
    ).toEqual({ ready: false, reasonCode: "REAL_EXECUTION_EVIDENCE_REQUIRED" });
    expect(
      assessReadyPromotion(implementation, [
        evidence("CONTRACT"),
        evidence("RUNTIME_READINESS"),
        evidence("AUTHORIZED_REAL_EXECUTION"),
      ]),
    ).toEqual({ ready: true, reasonCode: "EXACT_VERSION_EVIDENCE_ACCEPTED" });
  });

  it("retains failed facts without treating them as passing or auto-promoting", () => {
    expect(
      assessReadyPromotion(implementation, [
        evidence("CONTRACT", "FAIL"),
        evidence("RUNTIME_READINESS"),
        evidence("AUTHORIZED_REAL_EXECUTION"),
      ]),
    ).toEqual({ ready: false, reasonCode: "CONTRACT_EVIDENCE_REQUIRED" });
  });

  it("does not reuse evidence from another implementation or compiler version", () => {
    const wrong = evidence("AUTHORIZED_REAL_EXECUTION");
    wrong.compilerRef = { ...wrong.compilerRef, version: "2" };
    expect(
      assessReadyPromotion(implementation, [
        evidence("CONTRACT"),
        evidence("RUNTIME_READINESS"),
        wrong,
      ]),
    ).toEqual({ ready: false, reasonCode: "REAL_EXECUTION_EVIDENCE_REQUIRED" });
  });
});
