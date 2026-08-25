import { z } from "zod";
import { ShotDraftV1Schema } from "@comfyuiflow/contracts";

export const createStoryboardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  creativeBrief: z.string().trim().min(1).max(4_000),
});

export const storyboardShotInputSchema = ShotDraftV1Schema;

export const appendStoryboardVersionSchema = z.object({
  parentVersionId: z.string().uuid().nullable(),
  creativeBrief: z.string().trim().min(1).max(4_000),
  shots: z.array(storyboardShotInputSchema).max(20),
});

export const storyboardResolutionSchema = z.object({
  candidateResultHash: z.string().regex(/^[a-f0-9]{64}$/),
  selections: z
    .array(
      z.object({
        requirementId: z.string().uuid(),
        assetVersionFileIds: z.array(z.string().uuid()).min(1).max(9),
      }),
    )
    .max(60),
});

export const storyboardDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REVOKED"]),
  notes: z.string().trim().max(8_000).optional(),
});

export const storyboardErrorCodes = [
  "STORYBOARD_NOT_FOUND",
  "STORYBOARD_VERSION_NOT_FOUND",
  "PRECONDITION_REQUIRED",
  "VERSION_CONFLICT",
  "SHOT_COUNT_INVALID",
  "SHOT_ORDER_INVALID",
  "ASSET_REQUIREMENTS_INCOMPLETE",
  "PHASE2_GATE_CLOSED",
  "CANDIDATE_GAP",
  "CROSS_PROJECT",
  "UNAPPROVED_ASSET",
  "FILE_NOT_READY",
  "DECISION_CONFLICT",
] as const;

export function storyboardEtag(rowVersion: number) {
  return `"storyboard-${rowVersion}"`;
}

export function parseStoryboardEtag(value: string | null) {
  if (!value) return null;
  const match = /^"storyboard-(\d+)"$/.exec(value.trim());
  return match?.[1] === undefined ? null : Number(match[1]);
}

export type CreateStoryboardInput = z.infer<typeof createStoryboardSchema>;
export type AppendStoryboardVersionInput = z.infer<typeof appendStoryboardVersionSchema>;
export type StoryboardResolutionInput = z.infer<typeof storyboardResolutionSchema>;
