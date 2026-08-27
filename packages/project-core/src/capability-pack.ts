import { z } from "zod";
import { canonicalSha256 } from "./canonical-json.js";

const identifier = z.string().regex(/^[a-z][a-z0-9.-]{1,159}$/);
const packIdentifier = z.string().regex(/^[a-z][a-z0-9.-]{1,140}$/);
const nodeClass = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,159}$/);
const nodeInput = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,159}$/);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+-]{0,79}$/);
const ref = z.object({ id: identifier, version }).strict();

const unsignedPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    packId: packIdentifier,
    packVersion: version,
    runtimeTargetRef: ref,
    model: z.object({ id: identifier, version, availabilityKey: identifier }).strict(),
    compilerProfile: identifier,
    compilerBinding: z
      .object({
        modelNode: z
          .object({
            classType: nodeClass,
            promptInput: nodeInput,
            durationSecondsInput: nodeInput,
            ratioInput: nodeInput,
            imageAssetIdsInput: nodeInput.optional(),
          })
          .strict(),
        outputNode: z
          .object({
            classType: nodeClass,
            videoInput: nodeInput,
            outputMediaKey: identifier,
          })
          .strict(),
      })
      .strict(),
    allowedIntentModes: z.array(identifier).min(1).max(16),
    parameterEnvelope: z
      .object({
        images: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).strict(),
        durationSeconds: z.tuple([z.number().int().positive(), z.number().int().positive()]),
        ratios: z
          .array(z.string().regex(/^\d+:\d+$/))
          .min(1)
          .max(16),
        resolutions: z.array(z.string().min(1).max(40)).min(1).max(16).optional(),
      })
      .strict(),
    requiredNodes: z.array(nodeClass).min(1).max(100),
  })
  .strict();

const packSchema = unsignedPackSchema.extend({
  expectedManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CapabilityPack = z.infer<typeof packSchema>;
export type ParsedCapabilityPack = z.infer<typeof unsignedPackSchema> & {
  manifestSha256: string;
};

export function canonicalizeCapabilityPack(input: unknown): CapabilityPack {
  const unsigned = unsignedPackSchema.parse(withoutExpectedDigest(input));
  validateUnsignedPack(unsigned);
  return { ...unsigned, expectedManifestSha256: canonicalSha256(unsigned) };
}

export function parseCapabilityPack(input: unknown): ParsedCapabilityPack {
  const parsed = packSchema.parse(input);
  validateUnsignedPack(parsed);
  const { expectedManifestSha256, ...unsigned } = parsed;
  const manifestSha256 = canonicalSha256(unsigned);
  if (manifestSha256 !== expectedManifestSha256) throw new Error("CAPABILITY_PACK_DIGEST_MISMATCH");
  return { ...unsigned, manifestSha256 };
}

function validateUnsignedPack(parsed: z.infer<typeof unsignedPackSchema>) {
  if (parsed.parameterEnvelope.images.min > parsed.parameterEnvelope.images.max)
    throw new Error("CAPABILITY_PACK_INVALID_IMAGE_RANGE");
  if (parsed.parameterEnvelope.durationSeconds[0] > parsed.parameterEnvelope.durationSeconds[1])
    throw new Error("CAPABILITY_PACK_INVALID_DURATION_RANGE");
  if (!isSortedUnique(parsed.requiredNodes))
    throw new Error("CAPABILITY_PACK_NODES_NOT_SORTED_UNIQUE");
  if (
    !parsed.requiredNodes.includes(parsed.compilerBinding.modelNode.classType) ||
    !parsed.requiredNodes.includes(parsed.compilerBinding.outputNode.classType)
  )
    throw new Error("CAPABILITY_PACK_COMPILER_NODES_NOT_ALLOWED");
  if (!isSortedUnique(parsed.allowedIntentModes))
    throw new Error("CAPABILITY_PACK_INTENT_MODES_NOT_SORTED_UNIQUE");
  if (!isSortedUnique(parsed.parameterEnvelope.ratios))
    throw new Error("CAPABILITY_PACK_RATIOS_NOT_SORTED_UNIQUE");
  if (parsed.parameterEnvelope.resolutions && !isSortedUnique(parsed.parameterEnvelope.resolutions))
    throw new Error("CAPABILITY_PACK_RESOLUTIONS_NOT_SORTED_UNIQUE");
  if (parsed.compilerProfile === "h3-reference-video-v1") validateH3ReferencePack(parsed);
}

/** The remote H3 topology is application code, never Pack-supplied graph data. */
function validateH3ReferencePack(parsed: z.infer<typeof unsignedPackSchema>) {
  const binding = parsed.compilerBinding;
  const isExactBinding =
    binding.modelNode.classType === "MinimaxHailuo03ReferenceNode" &&
    binding.modelNode.promptInput === "model.prompt" &&
    binding.modelNode.durationSecondsInput === "model.duration" &&
    binding.modelNode.ratioInput === "model.ratio" &&
    binding.outputNode.classType === "SaveVideo" &&
    binding.outputNode.videoInput === "video" &&
    binding.outputNode.outputMediaKey === "videos";
  if (!isExactBinding) throw new Error("CAPABILITY_PACK_H3_BINDING_INVALID");
  if (
    parsed.model.id !== "model.minimax-h3" ||
    parsed.model.version !== "1.0.0" ||
    parsed.model.availabilityKey !== "minimax-h3-partner"
  )
    throw new Error("CAPABILITY_PACK_H3_MODEL_INVALID");
  if (!sameValues(parsed.requiredNodes, ["LoadImage", "MinimaxHailuo03ReferenceNode", "SaveVideo"]))
    throw new Error("CAPABILITY_PACK_H3_NODES_INVALID");
  if (!sameValues(parsed.allowedIntentModes, ["reference-video"]))
    throw new Error("CAPABILITY_PACK_H3_INTENT_MODES_INVALID");
  if (
    parsed.parameterEnvelope.images.min < 1 ||
    parsed.parameterEnvelope.images.max > 9 ||
    parsed.parameterEnvelope.durationSeconds[0] < 4 ||
    parsed.parameterEnvelope.durationSeconds[1] > 15 ||
    !parsed.parameterEnvelope.ratios.includes("16:9") ||
    !sameValues(parsed.parameterEnvelope.resolutions ?? [], ["2K"])
  )
    throw new Error("CAPABILITY_PACK_H3_ENVELOPE_INVALID");
}

function withoutExpectedDigest(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const unsigned = { ...(input as Record<string, unknown>) };
  delete unsigned.expectedManifestSha256;
  return unsigned;
}

function isSortedUnique(values: readonly string[]) {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
