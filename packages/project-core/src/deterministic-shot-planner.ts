import type { GenerationSpecV1 } from "@comfyuiflow/contracts";
import { GenerationSpecV1Schema } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";

export const DETERMINISTIC_SHOT_PLANNER_VERSION = "deterministic-shot-planner-v1" as const;

type PlannerShot = {
  id: string;
  shotKey: string;
  ordinal: number;
  startState: string;
  action: string;
  endState: string;
  camera: string;
  composition: string;
  continuityRequirements: unknown;
  durationSeconds: number;
  requirements: Array<{ id: string }>;
};

export type PlannerReference = {
  requirementId: string;
  productionAssetVersionId: string;
  characterStateVersionId: string | null;
  assetVersionFileId: string;
  projectAssetId: string;
  sha256: string;
  referenceUsage: GenerationSpecV1["references"][number]["referenceUsage"];
};

export function hashGenerationSpec(
  spec: Omit<GenerationSpecV1, "inputHash" | "referencesHash" | "outputHash">,
) {
  const inputHash = canonicalSha256({
    startState: spec.startState,
    action: spec.action,
    endState: spec.endState,
    camera: spec.camera,
    composition: spec.composition,
    continuityRequirements: spec.continuityRequirements,
  });
  const referencesHash = canonicalSha256(spec.references);
  const base = { ...spec, inputHash, referencesHash };
  return GenerationSpecV1Schema.parse({ ...base, outputHash: canonicalSha256(base) });
}

export function buildGenerationSpecs(input: {
  projectId: string;
  targetAspectRatio: GenerationSpecV1["capabilityRequirements"]["aspectRatio"];
  storyboardId: string;
  storyboardVersionId: string;
  manifestId: string;
  shots: PlannerShot[];
  references: PlannerReference[];
}) {
  return input.shots
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((shot) => {
      const continuity = Array.isArray(shot.continuityRequirements)
        ? shot.continuityRequirements.map(String)
        : [];
      const references = input.references
        .filter((reference) => shot.requirements.some(({ id }) => id === reference.requirementId))
        .sort((a, b) =>
          `${a.requirementId}:${a.assetVersionFileId}`.localeCompare(
            `${b.requirementId}:${b.assetVersionFileId}`,
          ),
        );
      const promptInput = {
        startState: shot.startState.trim(),
        action: shot.action.trim(),
        endState: shot.endState.trim(),
        camera: shot.camera.trim(),
        composition: shot.composition.trim(),
        continuityRequirements: continuity,
      };
      const positivePrompt = [
        `Start state: ${promptInput.startState}`,
        `Action: ${promptInput.action}`,
        `End state: ${promptInput.endState}`,
        `Camera: ${promptInput.camera}`,
        `Composition: ${promptInput.composition}`,
        ...(continuity.length ? [`Continuity: ${continuity.join("; ")}`] : []),
      ].join("\n");
      const base = {
        schemaVersion: "generation-spec-v1" as const,
        plannerVersion: DETERMINISTIC_SHOT_PLANNER_VERSION,
        projectId: input.projectId,
        storyboardId: input.storyboardId,
        storyboardVersionId: input.storyboardVersionId,
        manifestId: input.manifestId,
        storyboardShotId: shot.id,
        shotKey: shot.shotKey,
        ordinal: shot.ordinal,
        ...promptInput,
        durationSeconds: shot.durationSeconds,
        positivePrompt,
        references,
        capabilityRequirements: {
          mode: "REFERENCE_TO_VIDEO" as const,
          aspectRatio: input.targetAspectRatio,
          durationSeconds: shot.durationSeconds,
          referenceImageCount: references.length,
          audioRequired: false as const,
        },
      };
      return hashGenerationSpec(base);
    });
}
