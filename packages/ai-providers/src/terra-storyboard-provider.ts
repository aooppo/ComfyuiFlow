import { zodTextFormat } from "openai/helpers/zod";
import {
  StoryboardGenerationRequestV2Schema,
  StoryboardProposalV2Schema,
  type AiProviderResult,
  type AiTaskRequest,
  type StoryboardGenerationRequestV2,
} from "@comfyuiflow/contracts";
import type { AiModelProvider } from "./provider.js";
import {
  outputTextFromEnvelope,
  parseSseResponse,
  type GatewayResponseEnvelope,
} from "./codexmanager-local-provider.js";

export const TERRA_STORYBOARD_MODEL_ID = "gpt-5.6-terra";
type ProviderKind = "codexmanager-local" | "openai";

export class TerraStoryboardProvider implements AiModelProvider {
  constructor(
    private readonly kind: ProviderKind,
    private readonly options: { fetch?: typeof fetch; environment?: NodeJS.ProcessEnv } = {},
  ) {}
  getCapabilities(modelId: string) {
    return {
      providerId: this.kind,
      modelId,
      inputModalities: ["text", "image"] as Array<"text" | "image" | "video">,
      structuredOutput: true,
      storyboardGeneration: {
        contractVersions: ["storyboard-generation-v2"],
        promptTemplateVersions: ["storyboard-director-v2"],
        supportedShotCounts: [],
        maxShotCount: 20,
      },
    };
  }
  async validateConfiguration() {
    const env = this.options.environment ?? process.env;
    const key = this.kind === "openai" ? env.OPENAI_API_KEY : env.CODEX_MANAGER_API_KEY;
    return key
      ? { configured: true }
      : { configured: false, reason: "Provider credential is missing" };
  }
  async generateStructured(request: AiTaskRequest): Promise<AiProviderResult> {
    void request;
    throw new Error("Use generateStoryboardV2");
  }
  async generateStoryboardV2(raw: StoryboardGenerationRequestV2) {
    const request = StoryboardGenerationRequestV2Schema.parse(raw);
    if (
      request.modelRef.providerId !== this.kind ||
      request.modelRef.modelId !== TERRA_STORYBOARD_MODEL_ID
    )
      throw new Error("Terra Storyboard model is not registered");
    const env = this.options.environment ?? process.env;
    const key = this.kind === "openai" ? env.OPENAI_API_KEY : env.CODEX_MANAGER_API_KEY;
    if (!key) throw new Error("Provider credential is missing");
    const base = this.kind === "openai" ? "https://api.openai.com/v1" : "http://127.0.0.1:48760/v1";
    const response = await (this.options.fetch ?? fetch)(`${base}/responses`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: TERRA_STORYBOARD_MODEL_ID,
        store: false,
        stream: false,
        reasoning: { effort: "medium" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt(request) },
              ...request.references.flatMap((reference) =>
                reference.imageDataUrl
                  ? [{ type: "input_image", image_url: reference.imageDataUrl, detail: "high" }]
                  : [],
              ),
            ],
          },
        ],
        text: {
          format: zodTextFormat(
            StoryboardProposalV2Schema.omit({
              providerId: true,
              requestedModelId: true,
              resolvedModelId: true,
              responseId: true,
              providerMetadata: true,
            }),
            "storyboard_proposal_v2",
          ),
        },
      }),
    });
    if (!response.ok) throw new Error(`${this.kind} request failed with status ${response.status}`);
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
    if (!outputText) throw new Error("Terra response has no structured output");
    const body = JSON.parse(outputText) as Record<string, unknown>;
    return StoryboardProposalV2Schema.parse({
      ...body,
      providerId: this.kind,
      requestedModelId: TERRA_STORYBOARD_MODEL_ID,
      resolvedModelId:
        typeof envelope.model === "string" ? envelope.model : TERRA_STORYBOARD_MODEL_ID,
      responseId: typeof envelope.id === "string" ? envelope.id : `${this.kind}:unreported`,
      contractVersion: "storyboard-proposal-v2",
      promptTemplateVersion: "storyboard-director-v2",
      providerMetadata: { providerCalls: 1 },
    });
  }
}

function prompt(request: StoryboardGenerationRequestV2) {
  const facts = request.references.map((reference) => ({
    alias: reference.alias,
    kind: reference.kind,
    displayName: reference.displayName,
    semanticFacts: reference.semanticFacts,
  }));
  return `你是 Storyboard Director。根据创意简报和确认参考事实，创建一个全新方案变体。实际镜头数必须在 1 到 ${request.maxShotCount} 之间；镜头 ordinal 从 1 连续编号；每镜必须引用至少一个且只能使用给定 alias。不要生成 UUID。\n创意简报：${request.creativeBrief}\n当前版本仅用于并发比较：${request.currentHead.contentHash}\n参考事实：${JSON.stringify(facts)}`;
}
