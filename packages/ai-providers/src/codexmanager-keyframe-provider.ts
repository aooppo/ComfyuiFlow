import { KeyframeCapabilityV1Schema, type KeyframeCapabilityV1 } from "@comfyuiflow/contracts";
import type {
  KeyframeGenerationInput,
  KeyframeGenerationResult,
  KeyframeImageProvider,
} from "./keyframe-image-provider.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:48760/v1";

export class CodexManagerKeyframeImageProvider implements KeyframeImageProvider {
  readonly profileId = "codexmanager-gpt-image-2-v1" as const;
  readonly external = true;

  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  preview(): KeyframeCapabilityV1 {
    const price = Number(this.environment.PROJECT_KEYFRAME_ESTIMATED_USD_PER_IMAGE);
    const priceAsOf = this.environment.PROJECT_KEYFRAME_PRICE_AS_OF ?? null;
    const priceExpiresAt = this.environment.PROJECT_KEYFRAME_PRICE_EXPIRES_AT ?? null;
    const blockers: string[] = [];
    if (this.environment.PROJECT_KEYFRAME_LIVE_ENABLED !== "true")
      blockers.push("KEYFRAME_LIVE_DISABLED");
    if (!this.environment.CODEX_MANAGER_API_KEY) blockers.push("KEYFRAME_GATEWAY_NOT_CONFIGURED");
    if (this.environment.PROJECT_KEYFRAME_IMAGE_EDITING !== "true")
      blockers.push("KEYFRAME_EDITING_UNVERIFIED");
    if (this.environment.PROJECT_KEYFRAME_MULTI_REFERENCE !== "true")
      blockers.push("KEYFRAME_MULTI_REFERENCE_UNVERIFIED");
    if (this.environment.PROJECT_KEYFRAME_HIGH_FIDELITY_INPUT !== "true")
      blockers.push("KEYFRAME_HIGH_FIDELITY_UNVERIFIED");
    if (!Number.isFinite(price) || price < 0 || !priceAsOf || !priceExpiresAt)
      blockers.push("KEYFRAME_PRICE_UNAVAILABLE");
    else if (Date.parse(priceExpiresAt) <= Date.now()) blockers.push("KEYFRAME_PRICE_STALE");
    const modelSnapshot = this.environment.PROJECT_KEYFRAME_MODEL_SNAPSHOT;
    if (!modelSnapshot) blockers.push("KEYFRAME_MODEL_SNAPSHOT_UNAVAILABLE");

    return KeyframeCapabilityV1Schema.parse({
      schemaVersion: "keyframe-capability-v1",
      profileId: this.profileId,
      providerId: "codexmanager-local",
      modelId: this.environment.PROJECT_KEYFRAME_MODEL_ID ?? "gpt-image-2",
      modelSnapshot: modelSnapshot ?? "unconfigured",
      generation: true,
      editing: this.environment.PROJECT_KEYFRAME_IMAGE_EDITING === "true",
      multipleReferenceImages: this.environment.PROJECT_KEYFRAME_MULTI_REFERENCE === "true",
      highFidelityInput: this.environment.PROJECT_KEYFRAME_HIGH_FIDELITY_INPUT === "true",
      maximumReferenceImages: Number(this.environment.PROJECT_KEYFRAME_MAX_REFERENCES ?? 0),
      providerRequestSize: "1024x1536",
      width: 768,
      height: 1344,
      quality: "low",
      priceAvailable: !blockers.some((item) => item.includes("PRICE")),
      estimatedCostUsdPerImage: Number.isFinite(price) && price >= 0 ? price : null,
      priceAsOf,
      priceExpiresAt,
      liveReady: blockers.length === 0,
      blockers,
    });
  }

  async generateOnce(input: KeyframeGenerationInput): Promise<KeyframeGenerationResult> {
    const capability = this.preview();
    if (!capability.liveReady)
      throw new Error(`KEYFRAME_CAPABILITY_UNAVAILABLE:${capability.blockers.join(",")}`);
    if (input.references.length > capability.maximumReferenceImages)
      throw new Error("KEYFRAME_REFERENCE_LIMIT_EXCEEDED");

    const form = new FormData();
    form.set("model", capability.modelSnapshot);
    form.set("prompt", input.prompt);
    form.set("size", capability.providerRequestSize);
    form.set("quality", input.quality);
    form.set("n", "1");
    input.references.forEach((reference, index) => {
      form.append(
        "image[]",
        new Blob([Uint8Array.from(reference.bytes).buffer], { type: reference.mimeType }),
        `${index + 1}-${reference.filename}`,
      );
    });

    const timeoutMs = Number(this.environment.PROJECT_KEYFRAME_TIMEOUT_MS ?? 120_000);
    const response = await fetch(
      `${this.environment.CODEX_MANAGER_BASE_URL ?? DEFAULT_BASE_URL}${this.environment.PROJECT_KEYFRAME_EDIT_PATH ?? "/images/edits"}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.environment.CODEX_MANAGER_API_KEY}`,
          "Idempotency-Key": input.requestHash,
        },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) throw new Error(`KEYFRAME_PROVIDER_HTTP_${response.status}`);
    const body = (await response.json()) as {
      id?: string;
      data?: Array<{ b64_json?: string }>;
      usage?: Record<string, number>;
    };
    if (body.data?.length !== 1 || !body.data[0]?.b64_json)
      throw new Error("KEYFRAME_PROVIDER_RESPONSE_AMBIGUOUS");
    return {
      bytes: Buffer.from(body.data[0].b64_json, "base64"),
      mimeType: "image/png",
      ...(body.id ? { responseId: body.id } : {}),
      ...(body.usage ? { usage: body.usage } : {}),
      costFacts: {
        estimatedCostUsd: capability.estimatedCostUsdPerImage,
        priceAsOf: capability.priceAsOf,
      },
    };
  }
}
