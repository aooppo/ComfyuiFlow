import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EvidenceStore, ReviewService, getSpikeStatus } from "@comfyuiflow/spike-core";

describe("separate technical and human status", () => {
  it("reports completed technical state without inventing owner approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-status-"));
    const runId = randomUUID();
    const store = new EvidenceStore(root);
    await store.append(`run_${runId.replaceAll("-", "_")}`, "COMPLETED", { artifactCount: 1 });
    const before = await getSpikeStatus(root, runId);
    expect(before).toMatchObject({
      technicalStatus: "COMPLETED",
      humanDecision: null,
      productizationOpen: false,
    });
    await new ReviewService(root).record({
      runId,
      artifactId: randomUUID(),
      decision: "PASS",
      notes: "owner reviewed",
    });
    const after = await getSpikeStatus(root, runId);
    expect(after).toMatchObject({
      technicalStatus: "COMPLETED",
      humanDecision: "PASS",
      productizationOpen: true,
    });
  });
});
