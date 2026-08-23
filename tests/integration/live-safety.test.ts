import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EvidenceStore, SpikeRunService, hashCanonical } from "@comfyuiflow/spike-core";
import { AmbiguousSubmissionError } from "@comfyuiflow/comfyui-bridge";

describe("one-shot live safety", () => {
  const provenance = {
    sourceAssets: [
      {
        role: "CHARACTER" as const,
        sha256: "a".repeat(64),
        mimeType: "image/png",
        byteSize: 100,
      },
      {
        role: "SCENE" as const,
        sha256: "b".repeat(64),
        mimeType: "image/png",
        byteSize: 200,
      },
    ],
    creativeDescription: "walk into the room",
    director: {
      providerId: "openai",
      modelId: "gpt-5.4-2026-03-05",
      promptTemplateVersion: "director-one-shot-v1",
      responseSchema: "ShotSpecification@1.0.0",
    },
    workflow: {
      workflowId: "ready-video",
      version: "1",
      sha256: "c".repeat(64),
    },
  };

  it("consumes Director authorization before one request and submits generation once", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-run-"));
    const director = {
      generateStructured: vi.fn().mockResolvedValue({ structuredOutput: { action: "walk" } }),
    };
    const generation = {
      stageInput: vi.fn().mockImplementation(async (input) => ({
        name: `${input.role}.png`,
        subfolder: "comfyuiflow",
        type: "input",
        sourceSha256: input.expectedSha256,
      })),
      submit: vi.fn().mockResolvedValue({ promptId: "00000000-0000-4000-8000-000000000001" }),
      status: vi.fn().mockResolvedValue({ status: "COMPLETED", artifacts: [] }),
      retainArtifacts: vi.fn().mockResolvedValue([{ path: "shot.mp4" }]),
    };
    const service = await SpikeRunService.create({
      dataRoot: root,
      director: director as any,
      generation: generation as any,
    });
    const scopeHash = hashCanonical({ director: "scope" });
    const grant = await service.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const runId = randomUUID();
    const result = await service.execute({
      runId,
      provenance,
      directorGrantId: grant.id,
      directorScopeHash: scopeHash,
      directorRequest: { request: "director" },
      generationRequest: { request: "generation" },
    });
    expect(result.status).toBe("COMPLETED");
    expect(director.generateStructured).toHaveBeenCalledTimes(1);
    expect(generation.submit).toHaveBeenCalledTimes(1);
    const events = await new EvidenceStore(root).read(`run_${runId.replaceAll("-", "_")}`);
    expect(events[0]).toMatchObject({
      eventType: "CREATED",
      payload: { provenance: { workflow: { workflowId: "ready-video" } } },
    });
    expect(events.some((event) => event.eventType === "ARTIFACT_RETAINED")).toBe(true);
  });

  it("records an ambiguous submit and never resubmits", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-ambiguous-"));
    const director = { generateStructured: vi.fn().mockResolvedValue({ structuredOutput: {} }) };
    const promptId = randomUUID();
    const generation = {
      stageInput: vi.fn(),
      submit: vi.fn().mockRejectedValue(new AmbiguousSubmissionError("ambiguous", promptId)),
      status: vi.fn().mockResolvedValue({ status: "COMPLETED", artifacts: [] }),
      retainArtifacts: vi.fn().mockResolvedValue([{ sha256: "d".repeat(64) }]),
    };
    const service = await SpikeRunService.create({
      dataRoot: root,
      director: director as any,
      generation: generation as any,
    });
    const scopeHash = hashCanonical({ director: "scope" });
    const grant = await service.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const runId = randomUUID();
    await expect(
      service.execute({
        runId,
        provenance,
        directorGrantId: grant.id,
        directorScopeHash: scopeHash,
        directorRequest: {},
        generationRequest: {},
      }),
    ).rejects.toThrow("ambiguous");
    expect(generation.submit).toHaveBeenCalledTimes(1);
    const reconciled = await service.reconcile({ runId, promptId, workflowId: "ready-video" });
    expect(reconciled.status).toBe("COMPLETED");
    expect(generation.submit).toHaveBeenCalledTimes(1);
  });

  it("records FAILED when artifact validation fails after provider completion", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-artifact-fail-"));
    const promptId = randomUUID();
    const director = {
      generateStructured: vi.fn().mockResolvedValue({ structuredOutput: { action: "walk" } }),
    };
    const generation = {
      submit: vi.fn().mockResolvedValue({ promptId }),
      status: vi.fn().mockResolvedValue({ status: "COMPLETED", artifacts: [] }),
      retainArtifacts: vi
        .fn()
        .mockRejectedValue(new Error("FFprobe could not validate the artifact")),
    };
    const service = await SpikeRunService.create({
      dataRoot: root,
      director: director as any,
      generation: generation as any,
    });
    const scopeHash = hashCanonical({ director: "scope" });
    const grant = await service.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const runId = randomUUID();
    await expect(
      service.execute({
        runId,
        provenance,
        directorGrantId: grant.id,
        directorScopeHash: scopeHash,
        directorRequest: {},
        generationRequest: { workflowId: "ready-video" },
      }),
    ).rejects.toThrow("FFprobe");
    const events = await new EvidenceStore(root).read(`run_${runId.replaceAll("-", "_")}`);
    expect(events.at(-1)).toMatchObject({
      eventType: "FAILED",
      payload: { stage: "ARTIFACT_VALIDATION" },
    });
  });

  it("records terminal evidence for Director and status transport failures", async () => {
    const directorRoot = await mkdtemp(join(tmpdir(), "comfyuiflow-director-fail-"));
    const directorService = await SpikeRunService.create({
      dataRoot: directorRoot,
      director: { generateStructured: vi.fn().mockRejectedValue(new Error("invalid JSON")) },
      generation: {
        submit: vi.fn(),
        status: vi.fn(),
        retainArtifacts: vi.fn(),
      } as any,
    });
    const directorScope = hashCanonical({ director: "failure" });
    const directorGrant = await directorService.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash: directorScope,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const directorRunId = randomUUID();
    await expect(
      directorService.execute({
        runId: directorRunId,
        provenance,
        directorGrantId: directorGrant.id,
        directorScopeHash: directorScope,
        directorRequest: {},
        generationRequest: {},
      }),
    ).rejects.toThrow("invalid JSON");
    const directorEvents = await new EvidenceStore(directorRoot).read(
      `run_${directorRunId.replaceAll("-", "_")}`,
    );
    expect(directorEvents.at(-1)).toMatchObject({
      eventType: "FAILED",
      payload: { stage: "DIRECTOR_REQUEST" },
    });

    const pollRoot = await mkdtemp(join(tmpdir(), "comfyuiflow-poll-fail-"));
    const pollService = await SpikeRunService.create({
      dataRoot: pollRoot,
      director: { generateStructured: vi.fn().mockResolvedValue({ structuredOutput: {} }) },
      generation: {
        submit: vi.fn().mockResolvedValue({ promptId: randomUUID() }),
        status: vi.fn().mockRejectedValue(new Error("connection lost")),
        retainArtifacts: vi.fn(),
      } as any,
    });
    const pollScope = hashCanonical({ director: "poll" });
    const pollGrant = await pollService.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash: pollScope,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const pollRunId = randomUUID();
    await expect(
      pollService.execute({
        runId: pollRunId,
        provenance,
        directorGrantId: pollGrant.id,
        directorScopeHash: pollScope,
        directorRequest: {},
        generationRequest: {},
      }),
    ).rejects.toThrow("connection lost");
    const pollEvents = await new EvidenceStore(pollRoot).read(
      `run_${pollRunId.replaceAll("-", "_")}`,
    );
    expect(pollEvents.at(-1)).toMatchObject({
      eventType: "FAILED",
      payload: { stage: "STATUS_POLL" },
    });
  });

  it("records FAILED when Director authorization is scope-mismatched before a Provider call", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-auth-fail-"));
    const director = { generateStructured: vi.fn() };
    const service = await SpikeRunService.create({
      dataRoot: root,
      director,
      generation: { submit: vi.fn(), status: vi.fn(), retainArtifacts: vi.fn() } as any,
    });
    const grant = await service.authorization.createGrant({
      operation: "DIRECTOR_GENERATE",
      scopeHash: hashCanonical({ correct: true }),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const runId = randomUUID();
    await expect(
      service.execute({
        runId,
        provenance,
        directorGrantId: grant.id,
        directorScopeHash: hashCanonical({ wrong: true }),
        directorRequest: {},
        generationRequest: {},
      }),
    ).rejects.toThrow("scope mismatch");
    expect(director.generateStructured).not.toHaveBeenCalled();
    const events = await new EvidenceStore(root).read(`run_${runId.replaceAll("-", "_")}`);
    expect(events.at(-1)).toMatchObject({
      eventType: "FAILED",
      payload: { stage: "DIRECTOR_AUTHORIZATION" },
    });
  });
});
