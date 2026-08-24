import { AuthorizationService } from "./authorization.js";
import { RunProvenanceSchema, type RunProvenance } from "@comfyuiflow/contracts";
import { EvidenceStore } from "./evidence-store.js";
import { hashCanonical } from "./integrity.js";

interface DirectorPort {
  generateStructured(request: any): Promise<any>;
}

interface GenerationPort {
  submit(request: any): Promise<{ promptId: string }>;
  status(promptId: string): Promise<{ status: string; artifacts?: unknown[] }>;
  retainArtifacts(request: {
    promptId: string;
    runId: string;
    workflowId?: string;
  }): Promise<unknown[]>;
}

export const LOCAL_GENERATION_POLL_INTERVAL_MS = 1_000;
export const LOCAL_GENERATION_MAX_POLLS = 600;

export class SpikeRunService {
  readonly authorization: AuthorizationService;
  private readonly evidence: EvidenceStore;

  private constructor(
    private readonly dependencies: {
      dataRoot: string;
      director: DirectorPort;
      generation: GenerationPort;
      pollIntervalMs?: number;
      maxPolls?: number;
    },
  ) {
    this.authorization = new AuthorizationService(dependencies.dataRoot);
    this.evidence = new EvidenceStore(dependencies.dataRoot);
  }

  static async create(dependencies: {
    dataRoot: string;
    director: DirectorPort;
    generation: GenerationPort;
    pollIntervalMs?: number;
    maxPolls?: number;
  }): Promise<SpikeRunService> {
    return new SpikeRunService(dependencies);
  }

  async execute(input: {
    runId: string;
    provenance: RunProvenance;
    directorGrantId: string;
    directorScopeHash: string;
    directorRequest: any;
    generationRequest: any;
  }): Promise<{ status: string; promptId: string; artifacts: unknown[] }> {
    const stream = `run_${input.runId.replaceAll("-", "_")}`;
    const provenance = RunProvenanceSchema.parse(input.provenance);
    await this.evidence.append(stream, "CREATED", {
      runId: input.runId,
      mode: "LIVE",
      provenance,
    });
    const directorRequestHash = hashCanonical(input.directorRequest);
    try {
      await this.authorization.consumeGrant({
        grantId: input.directorGrantId,
        runId: input.runId,
        operation: "DIRECTOR_GENERATE",
        scopeHash: input.directorScopeHash,
        requestHash: directorRequestHash,
      });
    } catch (error) {
      await this.evidence.append(stream, "FAILED", {
        stage: "DIRECTOR_AUTHORIZATION",
        error: error instanceof Error ? error.message : "Director authorization failed",
      });
      throw error;
    }
    await this.evidence.append(stream, "AUTH_CONSUMED", {
      operation: "DIRECTOR_GENERATE",
      grantId: input.directorGrantId,
      requestHash: directorRequestHash,
    });
    let directorResult: any;
    try {
      directorResult = await this.dependencies.director.generateStructured(input.directorRequest);
    } catch (error) {
      await this.evidence.append(stream, "FAILED", {
        stage: "DIRECTOR_REQUEST",
        error: error instanceof Error ? error.message : "Director request failed",
      });
      throw error;
    }
    await this.evidence.append(stream, "DIRECTOR_COMPLETED", {
      responseId: directorResult.responseId,
      providerId: directorResult.providerId ?? provenance.director.providerId,
      requestedModelId: directorResult.requestedModelId ?? provenance.director.modelId,
      resolvedModelId: directorResult.resolvedModelId ?? provenance.director.modelId,
      structuredOutput: directorResult.structuredOutput,
      usage: directorResult.usage,
      finishReason: directorResult.finishReason,
    });
    let submission: { promptId: string };
    try {
      submission = await this.dependencies.generation.submit({
        ...input.generationRequest,
        shot: directorResult.structuredOutput,
      });
    } catch (error) {
      const ambiguous = error instanceof Error && error.name === "AmbiguousSubmissionError";
      await this.evidence.append(stream, ambiguous ? "AMBIGUOUS" : "FAILED", {
        error: error instanceof Error ? error.message : "submission failed",
        promptId:
          typeof error === "object" && error !== null && "promptId" in error
            ? String(error.promptId)
            : input.generationRequest.promptId,
      });
      throw error;
    }
    await this.evidence.append(stream, "TASK_BOUND", { promptId: submission.promptId });

    const maxPolls = this.dependencies.maxPolls ?? LOCAL_GENERATION_MAX_POLLS;
    const pollIntervalMs = this.dependencies.pollIntervalMs ?? LOCAL_GENERATION_POLL_INTERVAL_MS;
    for (let poll = 0; poll < maxPolls; poll += 1) {
      let status: { status: string; artifacts?: unknown[] };
      try {
        status = await this.dependencies.generation.status(submission.promptId);
      } catch (error) {
        await this.evidence.append(stream, "FAILED", {
          promptId: submission.promptId,
          stage: "STATUS_POLL",
          error: error instanceof Error ? error.message : "status polling failed",
        });
        throw error;
      }
      await this.evidence.append(stream, "STATUS_OBSERVED", {
        promptId: submission.promptId,
        status: status.status,
      });
      if (status.status === "COMPLETED") {
        let artifacts: unknown[];
        try {
          artifacts = await this.dependencies.generation.retainArtifacts({
            promptId: submission.promptId,
            runId: input.runId,
            workflowId: input.generationRequest.workflowId,
          });
        } catch (error) {
          await this.evidence.append(stream, "FAILED", {
            promptId: submission.promptId,
            stage: "ARTIFACT_VALIDATION",
            error: error instanceof Error ? error.message : "artifact validation failed",
          });
          throw error;
        }
        for (const artifact of artifacts) {
          await this.evidence.append(stream, "ARTIFACT_RETAINED", artifact);
        }
        await this.evidence.append(stream, "COMPLETED", {
          promptId: submission.promptId,
          artifactCount: artifacts.length,
        });
        return { status: "COMPLETED", promptId: submission.promptId, artifacts };
      }
      if (["FAILED", "CANCELLED", "UNKNOWN"].includes(status.status)) {
        await this.evidence.append(stream, "FAILED", {
          promptId: submission.promptId,
          status: status.status,
        });
        throw new Error(`Generation stopped with status ${status.status}`);
      }
      if (pollIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    await this.evidence.append(stream, "AMBIGUOUS", {
      promptId: submission.promptId,
      status: "POLL_LIMIT",
    });
    throw new Error("Generation status polling limit reached");
  }

  async reconcile(input: { runId: string; promptId: string; workflowId: string }) {
    const stream = `run_${input.runId.replaceAll("-", "_")}`;
    const events = await this.evidence.read(stream);
    const reconcilable = events.find(
      (event) =>
        (event.eventType === "AMBIGUOUS" || event.eventType === "FAILED") &&
        typeof event.payload === "object" &&
        event.payload !== null &&
        (event.payload as Record<string, unknown>).promptId === input.promptId &&
        (event.eventType === "AMBIGUOUS" ||
          (event.payload as Record<string, unknown>).status === "POLL_LIMIT"),
    );
    if (!reconcilable) throw new Error("Run has no matching reconcilable prompt ID");
    const status = await this.dependencies.generation.status(input.promptId);
    await this.evidence.append(stream, "STATUS_OBSERVED", {
      promptId: input.promptId,
      status: status.status,
      reconciliation: true,
    });
    if (status.status !== "COMPLETED") {
      if (["FAILED", "CANCELLED"].includes(status.status)) {
        await this.evidence.append(stream, "FAILED", {
          promptId: input.promptId,
          status: status.status,
          reconciliation: true,
        });
      }
      return { runId: input.runId, promptId: input.promptId, status: status.status, artifacts: [] };
    }
    try {
      const artifacts = await this.dependencies.generation.retainArtifacts({
        promptId: input.promptId,
        runId: input.runId,
        workflowId: input.workflowId,
      });
      for (const artifact of artifacts) {
        await this.evidence.append(stream, "ARTIFACT_RETAINED", artifact);
      }
      await this.evidence.append(stream, "COMPLETED", {
        promptId: input.promptId,
        artifactCount: artifacts.length,
        reconciliation: true,
      });
      return { runId: input.runId, promptId: input.promptId, status: "COMPLETED", artifacts };
    } catch (error) {
      await this.evidence.append(stream, "FAILED", {
        promptId: input.promptId,
        stage: "ARTIFACT_VALIDATION",
        reconciliation: true,
        error: error instanceof Error ? error.message : "artifact validation failed",
      });
      throw error;
    }
  }
}
