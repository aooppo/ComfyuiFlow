import { z } from "zod";

export const projectStatuses = ["ACTIVE", "ARCHIVED"] as const;
export const targetAspectRatios = [
  "PORTRAIT_9_16",
  "LANDSCAPE_16_9",
  "SQUARE_1_1",
  "PORTRAIT_4_5",
] as const;
export const mediaTypes = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const assetRoles = [
  "SCENE",
  "PRODUCT",
  "CHARACTER_FULL_BODY",
  "CHARACTER_FACE",
  "CHARACTER_REAR_SIDE",
  "PROP",
  "AUDIO",
  "OTHER",
] as const;

const nullableTrimmed = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brief: nullableTrimmed(4_000),
  targetAspectRatio: z.enum(targetAspectRatios),
});

export const projectPatchSchema = projectInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one project field is required");

export const projectStatusSchema = z.enum(projectStatuses);
export const assetRoleSchema = z.enum(assetRoles);
export const mediaTypeSchema = z.enum(mediaTypes);

export const assetPatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    role: assetRoleSchema.optional(),
    notes: nullableTrimmed(2_000),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one asset field is required");

export const assetFilterSchema = z.object({
  mediaType: mediaTypeSchema.optional(),
  role: assetRoleSchema.optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
export type AssetPatch = z.infer<typeof assetPatchSchema>;
export type AssetFilter = z.infer<typeof assetFilterSchema>;
export type AssetRoleValue = (typeof assetRoles)[number];
export type MediaTypeValue = (typeof mediaTypes)[number];

export class ProjectAssetError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ProjectAssetError";
  }
}
