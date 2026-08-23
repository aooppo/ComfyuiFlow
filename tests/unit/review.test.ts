import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EvidenceStore, ReviewService } from "@comfyuiflow/spike-core";

describe("feasibility review", () => {
  it("opens productization only for completed plus PASS", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-review-"));
    const runId = randomUUID();
    const artifactId = randomUUID();
    const evidence = new EvidenceStore(root);
    await evidence.append(`run_${runId.replaceAll("-", "_")}`, "COMPLETED", {
      artifactCount: 1,
    });
    const reviews = new ReviewService(root);
    expect(await reviews.evaluateGate(runId)).toMatchObject({
      open: false,
      reason: "REVIEW_REQUIRED",
    });
    await reviews.record({ runId, artifactId, decision: "PASS", notes: "acceptable" });
    expect(await reviews.evaluateGate(runId)).toMatchObject({ open: true, reason: "OWNER_PASS" });
    const technicalEvents = await evidence.read(`run_${runId.replaceAll("-", "_")}`);
    expect(technicalEvents).toHaveLength(1);
  });

  it("keeps FAIL closed and allows explicit risk acceptance without technical completion", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-risk-"));
    const runId = randomUUID();
    const reviews = new ReviewService(root);
    await reviews.record({
      runId,
      artifactId: randomUUID(),
      decision: "FAIL",
      notes: "identity drift",
    });
    expect(await reviews.evaluateGate(runId)).toMatchObject({ open: false, reason: "OWNER_FAIL" });
    await reviews.record({ runId, decision: "RISK_ACCEPTED", notes: "continue knowingly" });
    expect(await reviews.evaluateGate(runId)).toMatchObject({
      open: true,
      reason: "RISK_ACCEPTED",
    });
  });
});
