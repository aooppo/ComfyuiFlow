import {
  Hailuo03AspectRatioV3Schema,
  Hailuo03ResolutionV3Schema,
  PlanningInputBindingV3Schema,
  ReferencePlanV3Schema,
  type PlanningInputSnapshotV3,
  type ReferencePlanBindingV3,
  type ReferencePlanV3,
  type ReferenceRoleV3,
  type VersionRefV2,
} from "@comfyuiflow/contracts";
import { z } from "zod";
import { canonicalSha256 } from "../canonical-json.js";

const buildReferencePlanInputSchema = z
  .object({
    shotId: z.string().uuid(),
    storyboardVersionId: z.string().uuid(),
    generationSpecId: z.string().uuid(),
    implementationRef: z.object({ id: z.string(), version: z.string() }).strict(),
    compilerRef: z.object({ id: z.string(), version: z.string() }).strict(),
    durationSeconds: z.number().int().min(4).max(15),
    aspectRatio: Hailuo03AspectRatioV3Schema,
    resolution: Hailuo03ResolutionV3Schema,
    seed: z.number().int().min(0).max(4_294_967_295),
    watermark: z.boolean(),
    prompt: z.string().trim().min(1).max(12_000),
    bindings: z.array(PlanningInputBindingV3Schema).max(15),
  })
  .strict();

export interface BuildReferencePlanV3Input {
  shotId: string;
  storyboardVersionId: string;
  generationSpecId: string;
  implementationRef: VersionRefV2;
  compilerRef: VersionRefV2;
  durationSeconds: number;
  aspectRatio: z.infer<typeof Hailuo03AspectRatioV3Schema>;
  resolution: z.infer<typeof Hailuo03ResolutionV3Schema>;
  seed: number;
  watermark: boolean;
  prompt: string;
  bindings: PlanningInputSnapshotV3["bindings"];
}

const modalityRank = { IMAGE: 0, VIDEO: 1, AUDIO: 2 } as const;
const roleRank: Record<ReferenceRoleV3, number> = {
  SCENE: 0,
  CHARACTER_IDENTITY: 1,
  CHARACTER_FACE: 2,
  CHARACTER_BODY: 3,
  CHARACTER_REAR: 4,
  PRODUCT: 5,
  STYLE: 6,
  CONTINUITY_FRAME: 7,
  REFERENCE_VIDEO: 8,
  REFERENCE_AUDIO: 9,
  OTHER: 10,
};

function roleFor(binding: PlanningInputSnapshotV3["bindings"][number]): ReferenceRoleV3 {
  const label = binding.roleLabel.trim().toLowerCase().replaceAll("_", "-");
  if (/continuity|final-frame|first-frame|last-frame/.test(label)) return "CONTINUITY_FRAME";
  if (/character.*face|face.*character|portrait|headshot/.test(label)) return "CHARACTER_FACE";
  if (/character.*rear|rear.*character|back-view/.test(label)) return "CHARACTER_REAR";
  if (/character.*body|body.*character|full-body/.test(label)) return "CHARACTER_BODY";
  if (/character|identity/.test(label)) return "CHARACTER_IDENTITY";
  if (/scene|environment|location|background/.test(label)) return "SCENE";
  if (/product|object|prop/.test(label)) return "PRODUCT";
  if (/style|look|palette/.test(label)) return "STYLE";
  if (binding.modality === "VIDEO" || binding.purpose === "MOTION") return "REFERENCE_VIDEO";
  if (binding.modality === "AUDIO" || binding.purpose === "AUDIO") return "REFERENCE_AUDIO";
  switch (binding.purpose) {
    case "CHARACTER":
      return "CHARACTER_IDENTITY";
    case "PRODUCT":
      return "PRODUCT";
    case "ENVIRONMENT":
      return "SCENE";
    case "STYLE":
      return "STYLE";
    case "CONTINUITY":
      return "CONTINUITY_FRAME";
    default:
      return "OTHER";
  }
}

function stagedInputName(binding: PlanningInputSnapshotV3["bindings"][number]): string {
  const extension =
    binding.modality === "IMAGE" ? "png" : binding.modality === "VIDEO" ? "mp4" : "wav";
  return `comfyuiflow/staged/${binding.sha256}.${extension}`;
}

function normalizedBindings(
  bindings: PlanningInputSnapshotV3["bindings"],
): ReferencePlanBindingV3[] {
  return bindings
    .map((binding) => ({
      sourceRef: binding.sourceRef,
      sha256: binding.sha256,
      modality: binding.modality,
      role: roleFor(binding),
      order: binding.order,
      necessity: binding.necessity,
      selectionReasonCode: `${binding.purpose}_REFERENCE_SELECTED`,
      stagedInputName: stagedInputName(binding),
      ...(binding.sourceKind === "UPSTREAM_FINAL_FRAME"
        ? {
            upstreamLineage: undefined,
          }
        : {}),
    }))
    .sort(
      (left, right) =>
        modalityRank[left.modality] - modalityRank[right.modality] ||
        roleRank[left.role] - roleRank[right.role] ||
        left.order - right.order ||
        `${left.sourceRef.id}@${left.sourceRef.version}`.localeCompare(
          `${right.sourceRef.id}@${right.sourceRef.version}`,
        ),
    )
    .map((binding, order) => ({ ...binding, order }));
}

export function buildReferencePlanV3(raw: BuildReferencePlanV3Input): ReferencePlanV3 {
  const input = buildReferencePlanInputSchema.parse(raw);
  const core = {
    schemaVersion: "reference-plan-v3" as const,
    shotId: input.shotId,
    storyboardVersionId: input.storyboardVersionId,
    generationSpecId: input.generationSpecId,
    implementationRef: input.implementationRef,
    compilerRef: input.compilerRef,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    seed: input.seed,
    watermark: input.watermark,
    prompt: input.prompt,
    bindings: normalizedBindings(input.bindings),
  };
  return ReferencePlanV3Schema.parse({ ...core, referencePlanDigest: canonicalSha256(core) });
}
