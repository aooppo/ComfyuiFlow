import { randomUUID } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { AiQaResultV1Schema, type AiQaRequestV1, type AiQaResultV1 } from "@comfyuiflow/contracts";
import {
  CODEXMANAGER_LOCAL_BASE_URL,
  CODEXMANAGER_LOCAL_DIRECTOR_MODEL,
  CODEXMANAGER_LOCAL_HEALTH_URL,
  CODEXMANAGER_LOCAL_PROVIDER_ID,
  numericUsage,
  outputTextFromEnvelope,
  parseSseResponse,
  type GatewayResponseEnvelope,
} from "./codexmanager-local-provider.js";

export interface VideoQaProvider {
  readonly providerId: "fake" | "codexmanager-local";
  readonly modelId: "fake-video-qa-v1" | "gpt-5.4";
  readonly externalCallCount: number;
  validateConfiguration(): Promise<{ configured: boolean; reason?: string }>;
  reviewVideoFrames(request: AiQaRequestV1): Promise<AiQaResultV1>;
}

const criteria = [
  "IDENTITY",
  "WARDROBE_STATE",
  "PRODUCT_STRUCTURE",
  "BODY_PROPORTION_SCALE",
  "SCENE",
  "COMPOSITION",
  "CROSS_FRAME_CONTINUITY",
  "VISUAL_DAMAGE",
  "UNEXPECTED_OBJECTS",
] as const;

export class FakeVideoQaProvider implements VideoQaProvider {
  readonly providerId = "fake" as const;
  readonly modelId = "fake-video-qa-v1" as const;
  readonly externalCallCount = 0;

  async validateConfiguration() {
    return { configured: true };
  }

  async reviewVideoFrames() {
    return AiQaResultV1Schema.parse({
      schemaVersion: "ai-qa-result-v1",
      providerId: this.providerId,
      requestedModelId: this.modelId,
      resolvedModelId: this.modelId,
      responseId: `fake:${randomUUID()}`,
      overallStatus: "WARN",
      summary: "Deterministic Fake QA completed for technical workflow validation only.",
      limitations: [
        "Motion quality is not assessable from still review frames.",
        "Audio meaning is not assessable from technical audio facts.",
      ],
      criteria: criteria.map((criterion) => ({
        criterion,
        status: "NOT_ASSESSABLE",
        confidence: "LOW",
        evidence: "Fake QA does not make a semantic creative judgment.",
        frameRoles: [],
      })),
    });
  }
}

export class CodexManagerLocalVideoQaProvider implements VideoQaProvider {
  readonly providerId = CODEXMANAGER_LOCAL_PROVIDER_ID;
  readonly modelId = CODEXMANAGER_LOCAL_DIRECTOR_MODEL;
  externalCallCount = 0;

  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async validateConfiguration() {
    if (!this.environment.CODEX_MANAGER_API_KEY)
      return { configured: false, reason: "CODEX_MANAGER_API_KEY is missing" };
    try {
      const response = await this.fetchImplementation(CODEXMANAGER_LOCAL_HEALTH_URL, {
        signal: AbortSignal.timeout(2_000),
      });
      return response.ok
        ? { configured: true }
        : { configured: false, reason: "CodexManager local gateway is unhealthy" };
    } catch {
      return { configured: false, reason: "CodexManager local gateway is unreachable" };
    }
  }

  async reviewVideoFrames(request: AiQaRequestV1) {
    if (
      request.modelRef.providerId !== this.providerId ||
      request.modelRef.modelId !== this.modelId
    )
      throw new Error("CodexManager Local video QA model is not registered");
    const apiKey = this.environment.CODEX_MANAGER_API_KEY;
    if (!apiKey) throw new Error("CODEX_MANAGER_API_KEY is missing");
    const images = [
      ...request.referenceImages.map((image) => ({
        label: `Reference ${image.role}`,
        mimeType: image.mimeType,
        content: image.content,
      })),
      ...request.reviewFrames.map((image) => ({
        label: `Generated frame ${image.role}`,
        mimeType: image.mimeType,
        content: image.content,
      })),
    ];
    this.externalCallCount += 1;
    const response = await this.fetchImplementation(`${CODEXMANAGER_LOCAL_BASE_URL}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.modelId,
        store: false,
        stream: false,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Review the five labeled approved reference images against the three labeled generated still frames. " +
                  "Return only the strict QA structure. Assess only visible still-frame evidence. " +
                  "Motion quality and audio meaning must remain NOT_ASSESSABLE. " +
                  "Objects already visible in any approved reference are permitted scene elements and must not be flagged as unexpected. " +
                  "Apply each shot's start/action/end timing literally: a requirement assigned to a later shot must not be enforced in an earlier shot. " +
                  "Treat owner retry requirements included in the expected execution prompt as binding for this attempt. " +
                  "Assess BODY_PROPORTION_SCALE for natural height, limb and torso proportions, stable character-to-product scale, and perspective stretching. " +
                  `Labels in order: ${images.map((image) => image.label).join(", ")}. ` +
                  `Technical facts: ${JSON.stringify(request.technicalFacts)}. ` +
                  `Expected facts: ${JSON.stringify(request.expectedFacts)}.`,
              },
              ...images.map((image) => ({
                type: "input_image" as const,
                image_url: `data:${image.mimeType};base64,${Buffer.from(image.content).toString("base64")}`,
                detail: "high" as const,
              })),
            ],
          },
        ],
        text: {
          format: zodTextFormat(
            AiQaResultV1Schema.omit({
              providerId: true,
              requestedModelId: true,
              resolvedModelId: true,
              responseId: true,
              usage: true,
            }),
            "video_frame_qa",
          ),
        },
      }),
    });
    if (!response.ok)
      throw new Error(`CodexManager local video QA failed with status ${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    let envelope: GatewayResponseEnvelope;
    let outputText: string | undefined;
    if (contentType.includes("text/event-stream")) {
      const parsed = parseSseResponse(await response.text());
      envelope = parsed.response;
      outputText = parsed.outputText;
    } else {
      envelope = (await response.json()) as GatewayResponseEnvelope;
      outputText = outputTextFromEnvelope(envelope);
    }
    if (!outputText) throw new Error("CodexManager local video QA response has no output");
    return AiQaResultV1Schema.parse({
      ...JSON.parse(outputText),
      providerId: this.providerId,
      requestedModelId: this.modelId,
      resolvedModelId: typeof envelope.model === "string" ? envelope.model : this.modelId,
      responseId: typeof envelope.id === "string" ? envelope.id : `codexmanager:${randomUUID()}`,
      ...(numericUsage(envelope.usage) ? { usage: numericUsage(envelope.usage) } : {}),
    });
  }
}
