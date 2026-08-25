import { describe, expect, it } from "vitest";
import {
  AiQaResultV1Schema,
  CreateGenerationBatchV1Schema,
  CreateGenerationExecutionPreviewV1Schema,
  GenerationExecutionPreviewV1Schema,
  HumanQaDecisionV1Schema,
} from "@comfyuiflow/contracts";
import {
  FakeGenerationProvider,
  compileH3GenerationPrompt,
  generationProviderRegistry,
} from "@comfyuiflow/project-core";
import { FakeVideoQaProvider } from "@comfyuiflow/ai-providers";

const slots = [
  "SCENE",
  "PRODUCT",
  "CHARACTER_FULL_BODY",
  "CHARACTER_FACE",
  "CHARACTER_REAR",
] as const;

describe("generation execution contracts", () => {
  it("compiles a deterministic six-section five-picture H3 prompt", () => {
    const input = {
      positivePrompt:
        "Start state: Character stands beside the closed product. Action: Character opens the product once. End state: Product remains open and intact. Camera: Medium full shot, fixed eye level. Composition: Character left, product right.",
      sceneName: "living room",
      productName: "coffee table",
      characterName: "Lady LaLa",
    };
    const first = compileH3GenerationPrompt(input);
    const second = compileH3GenerationPrompt(input);
    expect(first).toEqual(second);
    expect(first.prompt.match(/Picture [1-5]/g)).toHaveLength(5);
    expect(first.prompt).toContain("[Shot 1]");
    expect(first.prompt).toContain(input.positivePrompt);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    const edited = compileH3GenerationPrompt({
      ...input,
      positivePrompt: `${input.positivePrompt} Preserve natural body scale relative to the table.`,
    });
    expect(edited.prompt).toContain("Preserve natural body scale relative to the table.");
    expect(edited.sha256).not.toBe(first.sha256);
  });

  it("keeps provider capabilities static and request-neutral", () => {
    const h3 = generationProviderRegistry["minimax-h3-4s-v1"];
    expect(h3.referenceSlots).toEqual(slots);
    expect(h3).toMatchObject({
      durationSeconds: 4,
      width: 768,
      height: 1344,
      fps: 24,
      workflowId: "minimax-h3-project-shot-4s-v1",
    });
    expect(JSON.stringify(h3)).not.toContain("endpoint");
    expect(JSON.stringify(h3)).not.toContain("nodeId");
  });

  it("runs Fake generation and Fake QA without external calls", async () => {
    const generation = new FakeGenerationProvider();
    const submitted = await generation.submit({
      jobId: crypto.randomUUID(),
      promptId: crypto.randomUUID(),
      workflowId: "fake-project-shot-4s-v1",
      compiledPrompt: "bounded fake prompt",
      slots: [],
    });
    expect(await generation.status()).toBe("COMPLETED");
    expect(await generation.retainArtifacts(submitted.taskId)).toHaveLength(1);
    expect(generation.calls.submit).toBe(1);

    const qa = new FakeVideoQaProvider();
    const result = await qa.reviewVideoFrames();
    expect(AiQaResultV1Schema.parse(result).criteria).toHaveLength(9);
    expect(qa.externalCallCount).toBe(0);
  });

  it("requires immutable hashes and all five slots in a public preview", () => {
    const preview = {
      schemaVersion: "generation-execution-preview-v1",
      projectId: crypto.randomUUID(),
      generationPlanVersionId: crypto.randomUUID(),
      provider: generationProviderRegistry["fake-video-v1"],
      previewHash: "a".repeat(64),
      shots: [
        {
          generationSpecId: crypto.randomUUID(),
          ordinal: 1,
          compatible: true,
          blockers: [],
          promptSummary: "one approved shot",
          compiledPromptHash: "b".repeat(64),
          targetHash: "c".repeat(64),
          continuity: null,
          slots: slots.map((role) => ({
            role,
            projectAssetId: crypto.randomUUID(),
            assetVersionFileId: crypto.randomUUID(),
            productionAssetVersionId: crypto.randomUUID(),
            characterStateVersionId: null,
            sha256: "d".repeat(64),
            displayName: role,
          })),
        },
      ],
      ready: true,
      maximumGenerationCalls: 1,
      maximumAiQaCalls: 1,
      aiQaProviderId: "fake",
      aiQaModelId: "fake-video-qa-v1",
      aiQaPriceAvailable: false,
      externalCalls: 0,
      retryOfJobId: null,
      retryRequirements: null,
      continuityProfileVersionId: null,
      keyframePlanVersionId: null,
      continuityScopeHash: null,
    };
    expect(GenerationExecutionPreviewV1Schema.parse(preview).shots[0]?.slots).toHaveLength(5);
    expect(() =>
      GenerationExecutionPreviewV1Schema.parse({
        ...preview,
        previewHash: "absolute/path/to/secret",
      }),
    ).toThrow();
  });

  it("binds every retry to a source job and non-empty owner requirements", () => {
    const retry = {
      providerProfileId: "fake-video-v1",
      generationSpecIds: [crypto.randomUUID()],
      retryOfJobId: crypto.randomUUID(),
      retryRequirements: "Keep approved scene props and reduce apparent character height.",
    };
    expect(CreateGenerationExecutionPreviewV1Schema.parse(retry).retryRequirements).toContain(
      "approved scene props",
    );
    expect(() =>
      CreateGenerationExecutionPreviewV1Schema.parse({
        ...retry,
        retryRequirements: undefined,
      }),
    ).toThrow();
    expect(() =>
      CreateGenerationBatchV1Schema.parse({
        generationPlanVersionId: crypto.randomUUID(),
        providerProfileId: retry.providerProfileId,
        generationSpecIds: retry.generationSpecIds,
        previewHash: "e".repeat(64),
        confirmed: true,
        retryRequirements: retry.retryRequirements,
      }),
    ).toThrow();
  });

  it("requires useful notes for an owner FAIL", () => {
    expect(HumanQaDecisionV1Schema.parse({ decision: "PASS" })).toEqual({ decision: "PASS" });
    expect(() => HumanQaDecisionV1Schema.parse({ decision: "FAIL" })).toThrow();
    expect(
      HumanQaDecisionV1Schema.parse({ decision: "FAIL", notes: "Character is too tall." }),
    ).toMatchObject({ decision: "FAIL" });
  });
});
