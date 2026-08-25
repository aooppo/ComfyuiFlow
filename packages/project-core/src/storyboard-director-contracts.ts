import { z } from "zod";

export const directorProfileIdSchema = z.enum([
  "fake-storyboard-v2",
  "codexmanager-terra",
  "openai-terra",
]);

export const directorPreviewInputSchema = z
  .object({
    profileId: directorProfileIdSchema.default("fake-storyboard-v2"),
    maxShotCount: z.number().int().min(1).max(20).default(3),
    selectedAssetVersionFileIds: z.array(z.string().uuid()).max(9).optional(),
  })
  .strict();

export const createDirectorRunSchema = directorPreviewInputSchema.extend({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const rejectDirectorProposalSchema = z
  .object({
    note: z.string().trim().max(2_000).optional(),
    idempotencyKey: z.string().trim().min(8).max(160),
  })
  .strict();

export const adoptDirectorProposalSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(160),
    narrativeSummary: z.string().trim().min(1).max(4_000),
    shots: z
      .array(
        z
          .object({
            shotKey: z.string().uuid(),
            ordinal: z.number().int().min(1).max(20),
            title: z.string().trim().min(1).max(120),
            creativeDescription: z.string().trim().min(1).max(4_000),
            startState: z.string().trim().min(1).max(2_000),
            action: z.string().trim().min(1).max(2_000),
            endState: z.string().trim().min(1).max(2_000),
            camera: z.string().trim().min(1).max(1_000),
            composition: z.string().trim().min(1).max(1_000),
            continuityRequirements: z.array(z.string().trim().min(1).max(1_000)).max(20),
            durationSeconds: z.number().positive().max(30),
            referenceAliases: z.array(z.string()).min(1).max(9),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export type DirectorPreviewInput = z.infer<typeof directorPreviewInputSchema>;
export type CreateDirectorRunInput = z.infer<typeof createDirectorRunSchema>;
export type AdoptDirectorProposalInput = z.infer<typeof adoptDirectorProposalSchema>;
