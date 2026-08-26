import { z } from "zod";
import { canonicalSha256 } from "../../canonical-json.js";

const refSchema = z
  .object({ id: z.string().min(1).max(160), version: z.string().min(1).max(80) })
  .strict();
const bindingSchema = z
  .object({
    sourceRef: refSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    modality: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
    order: z.number().int().nonnegative().max(100),
    roleLabel: z.string().min(1).max(160),
    necessity: z.enum(["REQUIRED", "OPTIONAL"]),
  })
  .strict();
export const HailuoCompilerInputV3Schema = z
  .object({
    compilerRef: refSchema,
    prompt: z.string().trim().min(1).max(12_000),
    durationSeconds: z.number().positive().max(30),
    bindings: z.array(bindingSchema).max(16),
  })
  .strict();

type Input = z.infer<typeof HailuoCompilerInputV3Schema>;

function compiled(input: Input, mediaInputs: Array<Record<string, unknown>>) {
  const core = {
    schemaVersion: "compiled-request-preview-v3" as const,
    compilerRef: input.compilerRef,
    operation: "VIDEO_GENERATION" as const,
    prompt: input.prompt,
    durationSeconds: input.durationSeconds,
    mediaInputs,
    expectedOutput: { mediaType: "video/mp4" as const },
  };
  return { ...core, compiledRequestDigest: canonicalSha256(core) };
}

function ordered(bindings: Input["bindings"]) {
  return [...bindings].sort((left, right) => {
    const modalityRank = { IMAGE: 0, VIDEO: 1, AUDIO: 2 } as const;
    return (
      modalityRank[left.modality] - modalityRank[right.modality] ||
      left.order - right.order ||
      `${left.sourceRef.id}@${left.sourceRef.version}`.localeCompare(
        `${right.sourceRef.id}@${right.sourceRef.version}`,
      )
    );
  });
}

export function compileHailuo03Text(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  if (input.bindings.length !== 0) throw new Error("TEXT_TO_VIDEO_REJECTS_MEDIA");
  return compiled(input, []);
}

export function compileHailuo03Reference(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  const bindings = ordered(input.bindings);
  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  for (const binding of bindings) counts[binding.modality] += 1;
  if (counts.IMAGE > 9 || counts.VIDEO > 3 || counts.AUDIO > 3)
    throw new Error("REFERENCE_CARDINALITY_EXCEEDED");
  if (counts.IMAGE + counts.VIDEO === 0)
    throw new Error(
      counts.AUDIO > 0 ? "AUDIO_REQUIRES_VISUAL_REFERENCE" : "VISUAL_REFERENCE_REQUIRED",
    );
  const ordinals = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  return compiled(
    input,
    bindings.map((binding) => ({
      ...binding,
      label: `${binding.modality[0]}${binding.modality.slice(1).toLowerCase()} ${++ordinals[binding.modality]}`,
    })),
  );
}

export function compileHailuo03FirstLast(raw: unknown) {
  const input = HailuoCompilerInputV3Schema.parse(raw);
  const bindings = ordered(input.bindings);
  if (
    bindings.some((binding) => binding.modality !== "IMAGE") ||
    bindings.length < 1 ||
    bindings.length > 2
  )
    throw new Error("FIRST_LAST_FRAME_INPUT_INVALID");
  const first = bindings.find(
    (binding) =>
      binding.roleLabel.toLowerCase() === "first-frame" ||
      binding.sourceRef.id.includes("final-frame"),
  );
  if (!first) throw new Error("FIRST_FRAME_REQUIRED");
  const last = bindings.find((binding) => binding.roleLabel.toLowerCase() === "last-frame");
  return compiled(input, [
    { ...first, label: "First Frame" },
    ...(last ? [{ ...last, label: "Last Frame" }] : []),
  ]);
}
