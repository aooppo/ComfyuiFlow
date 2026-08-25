import { z } from "zod";

export const productionAssetTypes = [
  "CHARACTER",
  "OUTFIT",
  "PROP",
  "SCENE",
  "VOICE",
  "LORA",
  "HAIR",
  "MAKEUP",
  "ACCESSORY",
  "OTHER",
] as const;
export const referenceUsages = [
  "IDENTITY",
  "FACE",
  "FULL_BODY",
  "OUTFIT_DETAIL",
  "PROP_DETAIL",
  "SCENE_STYLE",
  "POSE",
  "CONTROL",
  "TRAINING_SOURCE",
] as const;
export const viewpoints = [
  "FRONT",
  "FRONT_THREE_QUARTER",
  "SIDE",
  "REAR_THREE_QUARTER",
  "REAR",
  "TOP",
  "LOW",
  "DETAIL",
  "UNSPECIFIED",
] as const;
export const shotScales = [
  "EXTREME_CLOSE_UP",
  "CLOSE_UP",
  "MEDIUM_CLOSE_UP",
  "MEDIUM",
  "MEDIUM_FULL",
  "FULL",
  "WIDE",
  "EXTREME_WIDE",
  "UNSPECIFIED",
] as const;
export const productionAssetTypeSchema = z.enum(productionAssetTypes);
export const referenceUsageSchema = z.enum(referenceUsages);
export const viewpointSchema = z.enum(viewpoints);
export const shotScaleSchema = z.enum(shotScales);

export const createProductionAssetSchema = z
  .object({
    type: productionAssetTypeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4_000).optional(),
    idempotencyKey: z.string().trim().min(16).max(120).optional(),
  })
  .strict();
export const createProductionAssetVersionSchema = z
  .object({
    basedOnVersionId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(16).max(120).optional(),
  })
  .strict();
export const assetVersionFileInputSchema = z
  .object({
    projectAssetId: z.string().uuid(),
    referenceUsage: referenceUsageSchema,
    viewpoint: viewpointSchema.default("UNSPECIFIED"),
    shotScale: shotScaleSchema.default("UNSPECIFIED"),
    isPreferred: z.boolean().default(false),
    notes: z.string().trim().max(1_000).optional(),
  })
  .strict();
export const productionAssetRelationInputSchema = z
  .object({
    toAssetVersionId: z.string().uuid(),
    relationType: z.enum([
      "DEFAULT_VOICE",
      "IDENTITY_LORA",
      "REQUIRES",
      "COMPATIBLE_WITH",
      "PART_OF",
      "DERIVED_FROM",
    ]),
  })
  .strict();
export const createCharacterVersionSchema = z
  .object({
    productionAssetVersionId: z.string().uuid(),
    basedOnCharacterVersionId: z.string().uuid().optional(),
  })
  .strict();
export const createCharacterStateSchema = z
  .object({
    stateKey: z.string().regex(/^[a-z0-9-]{1,80}$/),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4_000).optional(),
  })
  .strict();
export const characterStateComponentSchema = z
  .object({
    slotType: z.enum(["OUTFIT", "HAIR", "MAKEUP", "ACCESSORY"]),
    componentAssetVersionId: z.string().uuid(),
    slotKey: z.string().trim().max(80).default(""),
    sortOrder: z.number().int().min(0).max(1_000).default(0),
    required: z.boolean().default(true),
  })
  .strict();

export const ifMatchRowVersionSchema = z
  .string()
  .regex(/^"[0-9]+"$/)
  .transform((value) => Number(value.slice(1, -1)))
  .pipe(z.number().int().nonnegative().safe());

export type CreateProductionAsset = z.infer<typeof createProductionAssetSchema>;
export type AssetVersionFileInput = z.infer<typeof assetVersionFileInputSchema>;
export type CreateCharacterState = z.infer<typeof createCharacterStateSchema>;
