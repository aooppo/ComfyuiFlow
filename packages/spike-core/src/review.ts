import { randomUUID } from "node:crypto";
import {
  FeasibilityReviewSchema,
  type FeasibilityDecision,
  type FeasibilityReview,
} from "@comfyuiflow/contracts";
import { EvidenceStore } from "./evidence-store.js";

function runStream(runId: string): string {
  return `run_${runId.replaceAll("-", "_")}`;
}

function reviewStream(runId: string): string {
  return `reviews_${runId.replaceAll("-", "_")}`;
}

export class ReviewService {
  private readonly evidence: EvidenceStore;

  constructor(readonly root: string) {
    this.evidence = new EvidenceStore(root);
  }

  async record(input: {
    runId: string;
    artifactId?: string;
    decision: FeasibilityDecision;
    notes?: string;
  }): Promise<FeasibilityReview> {
    if (input.decision === "PASS" && !input.artifactId) {
      throw new Error("PASS requires a reviewed artifact ID");
    }
    const review = FeasibilityReviewSchema.parse({
      schemaVersion: "1.0.0",
      id: randomUUID(),
      runId: input.runId,
      ...(input.artifactId ? { artifactId: input.artifactId } : {}),
      decision: input.decision,
      notes: input.notes ?? "",
      reviewedAt: new Date().toISOString(),
    });
    await this.evidence.append(reviewStream(input.runId), "FEASIBILITY_REVIEWED", review);
    return review;
  }

  async list(runId: string): Promise<FeasibilityReview[]> {
    const events = await this.evidence.read(reviewStream(runId));
    return events.map((event) => FeasibilityReviewSchema.parse(event.payload));
  }

  async evaluateGate(runId: string): Promise<{ open: boolean; reason: string }> {
    const technical = await this.evidence.read(runStream(runId));
    const completed = technical.some((event) => event.eventType === "COMPLETED");
    const latest = (await this.list(runId)).at(-1);
    if (!latest) return { open: false, reason: "REVIEW_REQUIRED" };
    if (latest.decision === "RISK_ACCEPTED") return { open: true, reason: "RISK_ACCEPTED" };
    if (latest.decision === "FAIL") return { open: false, reason: "OWNER_FAIL" };
    if (!completed) return { open: false, reason: "TECHNICAL_INCOMPLETE" };
    return { open: true, reason: "OWNER_PASS" };
  }
}

export async function getSpikeStatus(root: string, runId: string) {
  const evidence = new EvidenceStore(root);
  const technicalEvents = await evidence.read(runStream(runId));
  const reviews = new ReviewService(root);
  const humanReviews = await reviews.list(runId);
  const gate = await reviews.evaluateGate(runId);
  return {
    runId,
    technicalStatus: technicalEvents.at(-1)?.eventType ?? "NOT_FOUND",
    technicalChainValid: evidence.verify(technicalEvents),
    humanDecision: humanReviews.at(-1)?.decision ?? null,
    reviewCount: humanReviews.length,
    productizationOpen: gate.open,
    gateReason: gate.reason,
    technicalEvents,
    humanReviews,
  };
}
