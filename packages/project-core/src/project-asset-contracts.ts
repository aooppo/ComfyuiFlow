import { z } from "zod";

export const projectAssetStatuses = ["PRESERVED", "READY", "INVALID", "REMOVED"] as const;
export const projectAssetStatusSchema = z.enum(projectAssetStatuses);

export const projectAssetFilterSchema = z.object({
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"]).optional(),
  role: z
    .enum([
      "SCENE",
      "PRODUCT",
      "CHARACTER_FULL_BODY",
      "CHARACTER_FACE",
      "CHARACTER_REAR_SIDE",
      "PROP",
      "AUDIO",
      "OTHER",
    ])
    .optional(),
  status: projectAssetStatusSchema.optional(),
  query: z.string().trim().max(120).optional(),
  cursor: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const revalidateProjectAssetsSchema = z.object({
  assetIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Asset ids must be unique",
    }),
});

export type ProjectAssetFilter = z.infer<typeof projectAssetFilterSchema>;
