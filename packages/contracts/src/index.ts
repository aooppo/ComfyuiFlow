import { z } from "zod";

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const UuidSchema = z.string().uuid();

export const AssetRoleSchema = z.enum([
  "CHARACTER",
  "SCENE",
  "PRODUCT",
  "CHARACTER_FACE",
  "CHARACTER_REAR",
]);
export const InputAssetSchema = z.object({
  id: UuidSchema,
  role: AssetRoleSchema,
  originalPath: z.string().min(1),
  storedPath: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteSize: z.number().int().positive(),
  sha256: Sha256Schema,
});

export const ShotSpecificationSchema = z.object({
  id: UuidSchema,
  schemaVersion: z.literal("1.0.0"),
  promptTemplateVersion: z.literal("director-one-shot-v1"),
  creativeDescription: z.string().min(1).max(4_000),
  startState: z.string().min(1).max(2_000),
  action: z.string().min(1).max(2_000),
  endState: z.string().min(1).max(2_000),
  camera: z.string().min(1).max(1_000),
  composition: z.string().min(1).max(1_000),
  continuityRequirements: z.array(z.string().min(1).max(1_000)).max(20),
  durationSeconds: z.number().positive().max(30),
  directorRunId: UuidSchema,
});

export const WorkflowBindingSchema = z.object({
  pointer: z.string().startsWith("/"),
});

export const WorkflowManifestSchema = z.object({
  workflowId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  version: z.string().min(1).max(64),
  displayName: z.string().min(1).max(120),
  enabled: z.boolean(),
  apiWorkflowPath: z.string().min(1),
  sha256: Sha256Schema,
  requiredNodeClasses: z.array(z.string().min(1)).min(1),
  requiredModels: z.array(
    z.object({
      folder: z.string().regex(/^[A-Za-z0-9_-]+$/),
      filename: z
        .string()
        .min(1)
        .refine((value) => !value.includes("..")),
    }),
  ),
  requiresComfyOrgAuth: z.boolean().default(false),
  constraints: z.object({
    durationSeconds: z.object({
      min: z.number().positive(),
      max: z.number().positive(),
      default: z.number().positive(),
    }),
    width: z.number().int().positive().max(4_096),
    height: z.number().int().positive().max(4_096),
    fps: z.number().positive().max(120),
    outputMediaType: z.literal("video"),
  }),
  bindings: z.object({
    character: WorkflowBindingSchema,
    scene: WorkflowBindingSchema,
    product: WorkflowBindingSchema.optional(),
    characterFace: WorkflowBindingSchema.optional(),
    characterRear: WorkflowBindingSchema.optional(),
    positivePrompt: WorkflowBindingSchema,
    durationSeconds: WorkflowBindingSchema.optional(),
    width: WorkflowBindingSchema.optional(),
    height: WorkflowBindingSchema.optional(),
    fps: WorkflowBindingSchema.optional(),
  }),
  output: z.object({
    nodeId: z.string().min(1),
    mediaKey: z.string().min(1),
  }),
});

export const WorkflowRegistrySchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  workflows: z.array(WorkflowManifestSchema),
});

const H3FullReferenceHeaders = [
  "subject_definitions:",
  "summary:",
  "retention_analysis:",
  "detailed_description:",
  "overall_soundscape:",
  "non_diegetic_music:",
] as const;

export const H3FullReferencePromptSchema = z
  .string()
  .min(1)
  .max(12_000)
  .superRefine((prompt, context) => {
    let previous = -1;
    for (const header of H3FullReferenceHeaders) {
      const matches = [...prompt.matchAll(new RegExp(`(?:^|\\n)${header}`, "g"))];
      if (matches.length !== 1) {
        context.addIssue({
          code: "custom",
          message: `H3 full-reference prompt requires exactly one ${header}`,
        });
        continue;
      }
      const index = matches[0]?.index ?? -1;
      if (index <= previous) {
        context.addIssue({
          code: "custom",
          message: `H3 full-reference prompt section order is invalid at ${header}`,
        });
      }
      previous = index;
    }
    for (let picture = 1; picture <= 5; picture += 1) {
      if (!prompt.includes(`<Picture ${picture}>`)) {
        context.addIssue({ code: "custom", message: `H3 prompt is missing Picture ${picture}` });
      }
    }
    const fullAdvertisementShots = [
      "[Shot 1]",
      "[Shot 2] At 00:02.500",
      "[Shot 3] At 00:05.500",
      "[Shot 4] At 00:08.500",
      "[Shot 5] At 00:11.500",
    ];
    const isFullAdvertisement = fullAdvertisementShots.every((shot) => prompt.includes(shot));
    const isSingleShotValidation = prompt.includes("[Shot 1]") && !/\[Shot [2-9]\]/.test(prompt);
    if (!isFullAdvertisement && !isSingleShotValidation) {
      context.addIssue({
        code: "custom",
        message:
          "H3 full-reference prompt requires either the approved five-shot timeline or one untimed validation shot",
      });
    }
  });

export const SpikeRequestSchema = z.object({
  characterImage: z.string().min(1),
  sceneImage: z.string().min(1),
  additionalReferenceImages: z
    .array(
      z.object({
        role: z.enum(["PRODUCT", "CHARACTER_FACE", "CHARACTER_REAR"]),
        image: z.string().min(1),
      }),
    )
    .max(7)
    .refine((items) => new Set(items.map((item) => item.role)).size === items.length, {
      message: "Additional reference roles must be unique",
    })
    .default([]),
  creativeDescription: z.string().min(1).max(4_000),
  generationPrompt: H3FullReferencePromptSchema.optional(),
  workflowId: z.string().min(1),
});

export const AuthorizationOperationSchema = z.enum(["DIRECTOR_GENERATE", "COMFYUI_SUBMIT"]);

export const AuthorizationGrantSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: UuidSchema,
  operation: AuthorizationOperationSchema,
  scopeHash: Sha256Schema,
  maxCalls: z.literal(1),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const AuthorizationConsumptionSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: UuidSchema,
  grantId: UuidSchema,
  runId: UuidSchema,
  operation: AuthorizationOperationSchema,
  scopeHash: Sha256Schema,
  requestHash: Sha256Schema,
  attemptNumber: z.literal(1),
  consumedAt: z.string().datetime(),
});

export const NormalizedJobStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
]);

export const ArtifactReferenceSchema = z.object({
  filename: z
    .string()
    .min(1)
    .refine((value) => !value.includes("..")),
  subfolder: z.string().refine((value) => !value.includes("..")),
  type: z.enum(["output", "temp"]),
  mediaKey: z.string().min(1),
  nodeId: z.string().min(1),
  format: z.string().optional(),
});

export const JobStatusResultSchema = z.object({
  promptId: UuidSchema,
  status: NormalizedJobStatusSchema,
  createTime: z.number().optional(),
  executionStartTime: z.number().optional(),
  executionEndTime: z.number().optional(),
  outputCount: z.number().int().nonnegative(),
  error: z.unknown().optional(),
  artifacts: z.array(ArtifactReferenceSchema),
});

export const VideoArtifactSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: UuidSchema,
  runId: UuidSchema,
  promptId: UuidSchema,
  storedPath: z.string().min(1),
  sourceReference: ArtifactReferenceSchema,
  sha256: Sha256Schema,
  byteSize: z.number().int().positive(),
  mimeType: z.string().startsWith("video/"),
  durationSeconds: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  codec: z.string().min(1),
  hasAudio: z.boolean(),
});

export const FeasibilityDecisionSchema = z.enum(["PASS", "FAIL", "RISK_ACCEPTED"]);
export const FeasibilityReviewSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: UuidSchema,
  runId: UuidSchema,
  artifactId: UuidSchema.optional(),
  decision: FeasibilityDecisionSchema,
  notes: z.string().max(8_000).default(""),
  reviewedAt: z.string().datetime(),
});

export const WorkflowReadinessSchema = z.object({
  workflowId: z.string().min(1),
  ready: z.boolean(),
  endpointReachable: z.boolean(),
  workflowHashMatches: z.boolean(),
  missingNodeClasses: z.array(z.string()),
  missingModels: z.array(z.string()),
  bindingErrors: z.array(z.string()),
  blockers: z.array(z.string()),
  comfyOrgCredentialConfigured: z.boolean(),
  serverFacts: z.record(z.string(), z.unknown()).optional(),
  generationCalls: z.literal(0),
});

export const AiTaskRequestSchema = z.object({
  taskType: z.literal("STORYBOARD_GENERATION"),
  modelRef: z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  creativeDescription: z.string().min(1),
  imageInputs: z.array(InputAssetSchema).min(2).max(9),
  promptTemplateVersion: z.literal("director-one-shot-v1"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const AiProviderResultSchema = z.object({
  providerId: z.string().min(1),
  requestedModelId: z.string().min(1),
  resolvedModelId: z.string().min(1),
  responseId: z.string().min(1),
  structuredOutput: ShotSpecificationSchema,
  usage: z.record(z.string(), z.number()).optional(),
  finishReason: z.string().optional(),
  providerMetadata: z.record(z.string(), z.unknown()).default({}),
});

export const RunProvenanceSchema = z.object({
  sourceAssets: z
    .array(
      z.object({
        role: AssetRoleSchema,
        sha256: Sha256Schema,
        mimeType: z.string().startsWith("image/"),
        byteSize: z.number().int().positive(),
      }),
    )
    .min(2)
    .max(9),
  creativeDescription: z.string().min(1),
  director: z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
    promptTemplateVersion: z.string().min(1),
    responseSchema: z.string().min(1),
  }),
  workflow: z.object({
    workflowId: z.string().min(1),
    version: z.string().min(1),
    sha256: Sha256Schema,
  }),
});

export type InputAsset = z.infer<typeof InputAssetSchema>;
export type ShotSpecification = z.infer<typeof ShotSpecificationSchema>;
export type WorkflowManifest = z.infer<typeof WorkflowManifestSchema>;
export type WorkflowRegistry = z.infer<typeof WorkflowRegistrySchema>;
export type SpikeRequest = z.infer<typeof SpikeRequestSchema>;
export type AuthorizationOperation = z.infer<typeof AuthorizationOperationSchema>;
export type AuthorizationGrant = z.infer<typeof AuthorizationGrantSchema>;
export type AuthorizationConsumption = z.infer<typeof AuthorizationConsumptionSchema>;
export type JobStatusResult = z.infer<typeof JobStatusResultSchema>;
export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;
export type VideoArtifact = z.infer<typeof VideoArtifactSchema>;
export type FeasibilityDecision = z.infer<typeof FeasibilityDecisionSchema>;
export type FeasibilityReview = z.infer<typeof FeasibilityReviewSchema>;
export type WorkflowReadiness = z.infer<typeof WorkflowReadinessSchema>;
export type AiTaskRequest = z.infer<typeof AiTaskRequestSchema>;
export type AiProviderResult = z.infer<typeof AiProviderResultSchema>;
export type RunProvenance = z.infer<typeof RunProvenanceSchema>;

export const AssetUnderstandingTaskTypeSchema = z.literal("ASSET_UNDERSTANDING");
export const AssetUnderstandingSlotSchema = z.string().regex(/^A[1-9]$/);
export const AssetUnderstandingSubjectTypeSchema = z.enum([
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
]);
export const AssetUnderstandingReferenceUsageSchema = z.enum([
  "IDENTITY",
  "FACE",
  "FULL_BODY",
  "OUTFIT_DETAIL",
  "PROP_DETAIL",
  "SCENE_STYLE",
  "POSE",
  "CONTROL",
  "TRAINING_SOURCE",
]);
export const AssetUnderstandingViewpointSchema = z.enum([
  "FRONT",
  "FRONT_THREE_QUARTER",
  "SIDE",
  "REAR_THREE_QUARTER",
  "REAR",
  "TOP",
  "LOW",
  "DETAIL",
  "UNSPECIFIED",
]);
export const AssetUnderstandingShotScaleSchema = z.enum([
  "EXTREME_CLOSE_UP",
  "CLOSE_UP",
  "MEDIUM_CLOSE_UP",
  "MEDIUM",
  "MEDIUM_FULL",
  "FULL",
  "WIDE",
  "EXTREME_WIDE",
  "UNSPECIFIED",
]);

const BoundedFactListSchema = z.array(z.string().trim().min(1).max(500)).max(30);
export const AssetUnderstandingFactsSchema = z
  .object({
    summary: z.string().trim().min(1).max(2_000),
    directObservations: BoundedFactListSchema,
    uncertainInterpretations: BoundedFactListSchema,
    visibleText: BoundedFactListSchema.default([]),
    subjectTypeSuggestions: z.array(AssetUnderstandingSubjectTypeSchema).max(10).default([]),
    referenceUsageSuggestions: z.array(AssetUnderstandingReferenceUsageSchema).max(10).default([]),
    viewpointSuggestion: AssetUnderstandingViewpointSchema.default("UNSPECIFIED"),
    shotScaleSuggestion: AssetUnderstandingShotScaleSchema.default("UNSPECIFIED"),
    scene: z.string().trim().max(1_000).default(""),
    composition: z.string().trim().max(1_000).default(""),
    lighting: z.string().trim().max(1_000).default(""),
    colorPalette: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    identityAnchors: BoundedFactListSchema.default([]),
    continuityRisks: BoundedFactListSchema.default([]),
    generationConstraints: BoundedFactListSchema.default([]),
    qualityFacts: z
      .object({
        sharpnessConfidence: z.number().min(0).max(1).nullable().default(null),
        exposureConfidence: z.number().min(0).max(1).nullable().default(null),
        subjectVisibility: z.number().min(0).max(1).nullable().default(null),
        usableFrameCoverage: z.number().min(0).max(1).nullable().default(null),
      })
      .strict()
      .default({
        sharpnessConfidence: null,
        exposureConfidence: null,
        subjectVisibility: null,
        usableFrameCoverage: null,
      }),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  })
  .strict();

export const AssetUnderstandingProviderRequestSchema = z
  .object({
    taskType: AssetUnderstandingTaskTypeSchema,
    contractVersion: z.literal("asset-understanding-v1"),
    modelRef: z.object({ providerId: z.string().min(1), modelId: z.string().min(1) }).strict(),
    promptVersion: z.literal("asset-understanding-v1"),
    schemaVersion: z.literal("asset-understanding-v1"),
    images: z
      .array(
        z
          .object({
            slot: AssetUnderstandingSlotSchema,
            mimeType: z.string().startsWith("image/"),
            content: z.instanceof(Uint8Array),
          })
          .strict(),
      )
      .min(1)
      .max(9)
      .refine((items) => new Set(items.map((item) => item.slot)).size === items.length, {
        message: "Asset understanding slots must be unique",
      }),
    context: z.string().max(4_000).default(""),
  })
  .strict();

export const AssetUnderstandingProviderResultSchema = z
  .object({
    providerId: z.string().min(1),
    requestedModelId: z.string().min(1),
    resolvedModelId: z.string().min(1),
    responseId: z.string().min(1),
    results: z
      .array(
        z
          .object({ slot: AssetUnderstandingSlotSchema, facts: AssetUnderstandingFactsSchema })
          .strict(),
      )
      .min(1)
      .max(9)
      .refine((items) => new Set(items.map((item) => item.slot)).size === items.length, {
        message: "Asset understanding results must have unique slots",
      }),
    usage: z.record(z.string(), z.number().finite()).optional(),
    finishReason: z.string().max(120).optional(),
    providerMetadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type AssetUnderstandingFacts = z.infer<typeof AssetUnderstandingFactsSchema>;
export type AssetUnderstandingProviderRequest = z.infer<
  typeof AssetUnderstandingProviderRequestSchema
>;
export type AssetUnderstandingProviderResult = z.infer<
  typeof AssetUnderstandingProviderResultSchema
>;

export const StoryboardAssetRequirementV1Schema = z
  .object({
    shotOrdinal: z.number().int().min(1).max(20),
    requirementKey: z.string().trim().min(1).max(120),
    contractVersion: z.literal("asset-candidate-v1"),
    candidateInput: z.record(z.string(), z.json()),
  })
  .strict();

export const ShotDraftV1Schema = z
  .object({
    schemaVersion: z.literal("shot-draft-v1"),
    shotKey: UuidSchema,
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
    assetRequirements: z.array(StoryboardAssetRequirementV1Schema).max(30).default([]),
  })
  .strict();

export const StoryboardGenerationRequestV1Schema = z
  .object({
    taskType: z.literal("STORYBOARD_GENERATION_V1"),
    contractVersion: z.literal("storyboard-generation-v1"),
    modelRef: z.object({
      providerId: z.string().trim().min(1).max(80),
      modelId: z.string().trim().min(1).max(160),
    }),
    projectId: UuidSchema,
    storyboardId: UuidSchema,
    creativeBrief: z.string().trim().min(1).max(4_000),
    shotCount: z.literal(3),
    promptTemplateVersion: z.literal("storyboard-three-shot-v1"),
    assetRequirements: z.array(StoryboardAssetRequirementV1Schema).max(90).default([]),
  })
  .strict();

export const StoryboardProposalV1Schema = z
  .object({
    providerId: z.string().trim().min(1).max(80),
    requestedModelId: z.string().trim().min(1).max(160),
    resolvedModelId: z.string().trim().min(1).max(160),
    responseId: z.string().trim().min(1).max(255),
    contractVersion: z.literal("storyboard-proposal-v1"),
    promptTemplateVersion: z.literal("storyboard-three-shot-v1"),
    shots: z.array(ShotDraftV1Schema).length(3),
    providerMetadata: z.object({ providerCalls: z.number().int().nonnegative() }).loose(),
  })
  .strict()
  .superRefine((value, context) => {
    const ordinals = value.shots.map((shot) => shot.ordinal);
    if (ordinals.some((ordinal, index) => ordinal !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["shots"],
        message: "Storyboard proposal shots must have ordinals 1, 2, and 3 in order",
      });
    }
    if (new Set(value.shots.map((shot) => shot.shotKey)).size !== value.shots.length) {
      context.addIssue({
        code: "custom",
        path: ["shots"],
        message: "Storyboard proposal shot keys must be unique",
      });
    }
    for (const [index, shot] of value.shots.entries()) {
      if (shot.assetRequirements.some((requirement) => requirement.shotOrdinal !== index + 1)) {
        context.addIssue({
          code: "custom",
          path: ["shots", index, "assetRequirements"],
          message: "Shot asset requirement ordinal must match its shot",
        });
      }
    }
  });

export type StoryboardAssetRequirementV1 = z.infer<typeof StoryboardAssetRequirementV1Schema>;
export type ShotDraftV1 = z.infer<typeof ShotDraftV1Schema>;
export type StoryboardGenerationRequestV1 = z.infer<typeof StoryboardGenerationRequestV1Schema>;
export type StoryboardProposalV1 = z.infer<typeof StoryboardProposalV1Schema>;

export const StoryboardReferenceV2Schema = z
  .object({
    alias: z.string().regex(/^ref_[a-z0-9_]{1,48}$/),
    kind: z.enum(["SCENE", "CHARACTER", "PRODUCT", "PROP", "APPEARANCE"]),
    displayName: z.string().trim().min(1).max(120),
    semanticFacts: z.record(z.string(), z.json()),
    imageDataUrl: z.string().startsWith("data:image/").optional(),
  })
  .strict();

export const StoryboardHeadSnapshotV2Schema = z
  .object({
    versionNumber: z.number().int().positive(),
    contentHash: Sha256Schema,
  })
  .strict();

export const StoryboardGenerationRequestV2Schema = z
  .object({
    taskType: z.literal("STORYBOARD_GENERATION_V2"),
    contractVersion: z.literal("storyboard-generation-v2"),
    promptTemplateVersion: z.literal("storyboard-director-v2"),
    modelRef: z.object({
      providerId: z.string().trim().min(1).max(80),
      modelId: z.string().trim().min(1).max(160),
    }),
    creativeBrief: z.string().trim().min(1).max(4_000),
    maxShotCount: z.number().int().min(1).max(20).default(3),
    currentHead: StoryboardHeadSnapshotV2Schema,
    references: z.array(StoryboardReferenceV2Schema).min(1).max(9),
  })
  .strict()
  .superRefine((value, context) => {
    const aliases = value.references.map((reference) => reference.alias);
    if (new Set(aliases).size !== aliases.length) {
      context.addIssue({
        code: "custom",
        path: ["references"],
        message: "Reference aliases must be unique",
      });
    }
  });

export const StoryboardProposalShotV2Schema = z
  .object({
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
    referenceAliases: z
      .array(z.string().regex(/^ref_[a-z0-9_]{1,48}$/))
      .min(1)
      .max(9),
  })
  .strict();

export const StoryboardProposalV2Schema = z
  .object({
    providerId: z.string().trim().min(1).max(80),
    requestedModelId: z.string().trim().min(1).max(160),
    resolvedModelId: z.string().trim().min(1).max(160),
    responseId: z.string().trim().min(1).max(255),
    contractVersion: z.literal("storyboard-proposal-v2"),
    promptTemplateVersion: z.literal("storyboard-director-v2"),
    narrativeSummary: z.string().trim().min(1).max(4_000),
    shots: z.array(StoryboardProposalShotV2Schema).min(1).max(20),
    providerMetadata: z.object({ providerCalls: z.number().int().min(0).max(1) }).loose(),
  })
  .strict();

export function validateStoryboardProposalV2(
  proposal: unknown,
  request: StoryboardGenerationRequestV2,
): StoryboardProposalV2 {
  const value = StoryboardProposalV2Schema.parse(proposal);
  if (value.shots.length > request.maxShotCount) throw new Error("Proposal exceeds maxShotCount");
  const knownAliases = new Set(request.references.map((reference) => reference.alias));
  for (const [index, shot] of value.shots.entries()) {
    if (shot.ordinal !== index + 1) throw new Error("Proposal shot ordinals must be contiguous");
    if (new Set(shot.referenceAliases).size !== shot.referenceAliases.length) {
      throw new Error("Proposal shot reference aliases must be unique");
    }
    if (shot.referenceAliases.some((alias) => !knownAliases.has(alias))) {
      throw new Error("Proposal uses an unknown reference alias");
    }
  }
  return value;
}

export type StoryboardReferenceV2 = z.infer<typeof StoryboardReferenceV2Schema>;
export type StoryboardGenerationRequestV2 = z.infer<typeof StoryboardGenerationRequestV2Schema>;
export type StoryboardProposalShotV2 = z.infer<typeof StoryboardProposalShotV2Schema>;
export type StoryboardProposalV2 = z.infer<typeof StoryboardProposalV2Schema>;

export * from "./workflow-agent.js";

export const GenerationSpecReferenceV1Schema = z
  .object({
    requirementId: UuidSchema,
    productionAssetVersionId: UuidSchema,
    characterStateVersionId: UuidSchema.nullable(),
    assetVersionFileId: UuidSchema,
    projectAssetId: UuidSchema,
    sha256: Sha256Schema,
    referenceUsage: AssetUnderstandingReferenceUsageSchema,
  })
  .strict();

export const GenerationCapabilityRequirementsV1Schema = z
  .object({
    mode: z.literal("REFERENCE_TO_VIDEO"),
    aspectRatio: z.enum(["PORTRAIT_9_16", "LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5"]),
    durationSeconds: z.number().positive().max(30),
    referenceImageCount: z.number().int().nonnegative().max(30),
    audioRequired: z.literal(false),
  })
  .strict();

export const GenerationSpecV1Schema = z
  .object({
    schemaVersion: z.literal("generation-spec-v1"),
    plannerVersion: z.literal("deterministic-shot-planner-v1"),
    projectId: UuidSchema,
    storyboardId: UuidSchema,
    storyboardVersionId: UuidSchema,
    manifestId: UuidSchema,
    storyboardShotId: UuidSchema,
    shotKey: UuidSchema,
    ordinal: z.number().int().min(1).max(20),
    startState: z.string().trim().min(1).max(2_000),
    action: z.string().trim().min(1).max(2_000),
    endState: z.string().trim().min(1).max(2_000),
    camera: z.string().trim().min(1).max(1_000),
    composition: z.string().trim().min(1).max(1_000),
    continuityRequirements: z.array(z.string().trim().min(1).max(1_000)).max(20),
    durationSeconds: z.number().positive().max(30),
    positivePrompt: z.string().trim().min(1).max(12_000),
    references: z.array(GenerationSpecReferenceV1Schema).max(30),
    capabilityRequirements: GenerationCapabilityRequirementsV1Schema,
    inputHash: Sha256Schema,
    referencesHash: Sha256Schema,
    outputHash: Sha256Schema,
  })
  .strict();

export const GenerationPlanVersionInputV1Schema = z
  .object({
    parentVersionId: UuidSchema,
    specs: z.array(GenerationSpecV1Schema).min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.specs.some((spec, index) => spec.ordinal !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["specs"],
        message: "Specs must have contiguous ordinals beginning at 1",
      });
    }
  });

export type GenerationSpecReferenceV1 = z.infer<typeof GenerationSpecReferenceV1Schema>;
export type GenerationSpecV1 = z.infer<typeof GenerationSpecV1Schema>;
export type GenerationPlanVersionInputV1 = z.infer<typeof GenerationPlanVersionInputV1Schema>;

export const GenerationProviderProfileIdSchema = z.enum(["fake-video-v1", "minimax-h3-4s-v1"]);
export const GenerationQaStatusSchema = z.enum(["PASS", "WARN", "FAIL", "NOT_ASSESSABLE"]);
export const GenerationQaConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const ReviewFrameRoleSchema = z.enum(["FIRST", "MIDDLE", "FINAL"]);

export const GenerationProviderCapabilitiesV1Schema = z
  .object({
    schemaVersion: z.literal("generation-provider-capabilities-v1"),
    profileId: GenerationProviderProfileIdSchema,
    providerId: z.string().min(1),
    modelId: z.string().min(1),
    videoControlTier: z.enum(["ORDINARY_REFERENCE", "LOCKED_START", "LOCKED_START_END"]),
    mode: z.literal("REFERENCE_TO_VIDEO"),
    aspectRatio: z.literal("PORTRAIT_9_16"),
    durationSeconds: z.literal(4),
    width: z.literal(768),
    height: z.literal(1344),
    fps: z.literal(24),
    referenceSlots: z.tuple([
      z.literal("SCENE"),
      z.literal("PRODUCT"),
      z.literal("CHARACTER_FULL_BODY"),
      z.literal("CHARACTER_FACE"),
      z.literal("CHARACTER_REAR"),
    ]),
    outputMediaType: z.literal("video/mp4"),
    cancellationSupported: z.boolean(),
    workflowId: z.string().min(1),
    workflowVersion: z.string().min(1),
    workflowSha256: Sha256Schema,
    costEstimateUsd: z.number().nonnegative().nullable(),
    costEstimateAsOf: z.string().datetime().nullable(),
  })
  .strict();

export const GenerationExecutionSlotV1Schema = z
  .object({
    role: z.enum(["SCENE", "PRODUCT", "CHARACTER_FULL_BODY", "CHARACTER_FACE", "CHARACTER_REAR"]),
    projectAssetId: UuidSchema,
    assetVersionFileId: UuidSchema,
    productionAssetVersionId: UuidSchema,
    characterStateVersionId: UuidSchema.nullable(),
    sha256: Sha256Schema,
    displayName: z.string().min(1).max(120),
    sourceKind: z.enum(["PROJECT_ASSET", "KEYFRAME_ARTIFACT"]).optional(),
    keyframeArtifactId: UuidSchema.optional(),
  })
  .strict();

export const GenerationExecutionPreviewShotV1Schema = z
  .object({
    generationSpecId: UuidSchema,
    ordinal: z.number().int().min(1).max(20),
    compatible: z.boolean(),
    blockers: z.array(z.string().min(1).max(80)),
    promptSummary: z.string().max(2_000),
    compiledPromptHash: Sha256Schema.nullable(),
    targetHash: Sha256Schema.nullable(),
    slots: z.array(GenerationExecutionSlotV1Schema).max(5),
    continuity: z
      .object({
        startBoundaryHash: Sha256Schema,
        endBoundaryHash: Sha256Schema,
        startKeyframeArtifactId: UuidSchema,
        startKeyframeHash: Sha256Schema,
        endKeyframeArtifactId: UuidSchema,
        endKeyframeHash: Sha256Schema,
        endKeyframeSoftTarget: z.boolean(),
        warnings: z.array(z.string().min(1).max(240)),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const GenerationExecutionPreviewV1Schema = z
  .object({
    schemaVersion: z.literal("generation-execution-preview-v1"),
    projectId: UuidSchema,
    generationPlanVersionId: UuidSchema,
    provider: GenerationProviderCapabilitiesV1Schema,
    previewHash: Sha256Schema,
    shots: z.array(GenerationExecutionPreviewShotV1Schema).min(1).max(20),
    ready: z.boolean(),
    maximumGenerationCalls: z.number().int().min(0).max(20),
    maximumAiQaCalls: z.number().int().min(0).max(20),
    aiQaProviderId: z.enum(["fake", "codexmanager-local"]),
    aiQaModelId: z.enum(["fake-video-qa-v1", "gpt-5.4"]),
    aiQaPriceAvailable: z.literal(false),
    externalCalls: z.literal(0),
    retryOfJobId: UuidSchema.nullable(),
    retryRequirements: z.string().trim().min(1).max(4_000).nullable(),
    continuityProfileVersionId: UuidSchema.nullable(),
    keyframePlanVersionId: UuidSchema.nullable(),
    continuityScopeHash: Sha256Schema.nullable(),
  })
  .strict();

export const CreateGenerationExecutionPreviewV1Schema = z
  .object({
    providerProfileId: GenerationProviderProfileIdSchema.default("fake-video-v1"),
    generationSpecIds: z.array(UuidSchema).min(1).max(20),
    retryOfJobId: UuidSchema.optional(),
    retryRequirements: z.string().trim().min(1).max(4_000).optional(),
    keyframePlanVersionId: UuidSchema.optional(),
    requiredVideoControlTier: z
      .enum(["ORDINARY_REFERENCE", "LOCKED_START", "LOCKED_START_END"])
      .optional(),
  })
  .strict()
  .refine((value) => new Set(value.generationSpecIds).size === value.generationSpecIds.length, {
    message: "Generation targets must be unique",
  })
  .refine((value) => Boolean(value.retryOfJobId) === Boolean(value.retryRequirements), {
    message: "Retry source and requirements must be supplied together",
  });

export const CreateGenerationBatchV1Schema = z
  .object({
    generationPlanVersionId: UuidSchema,
    providerProfileId: GenerationProviderProfileIdSchema,
    generationSpecIds: z.array(UuidSchema).min(1).max(20),
    previewHash: Sha256Schema,
    confirmed: z.literal(true),
    expiresInSeconds: z.number().int().min(30).max(900).default(300),
    retryOfJobId: UuidSchema.optional(),
    retryRequirements: z.string().trim().min(1).max(4_000).optional(),
    keyframePlanVersionId: UuidSchema.optional(),
    requiredVideoControlTier: z
      .enum(["ORDINARY_REFERENCE", "LOCKED_START", "LOCKED_START_END"])
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.retryOfJobId) === Boolean(value.retryRequirements), {
    message: "Retry source and requirements must be supplied together",
  });

export const GenerationJobStatusV1Schema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUBMITTED",
  "AMBIGUOUS",
  "TECHNICAL_FAILED",
  "AWAITING_HUMAN_QA",
  "QA_PASS",
  "QA_FAIL",
  "CANCELLED",
]);

export const HumanQaDecisionV1Schema = z
  .object({
    decision: z.enum(["PASS", "FAIL"]),
    notes: z.string().trim().max(8_000).optional(),
  })
  .strict()
  .refine((value) => value.decision !== "FAIL" || Boolean(value.notes?.trim()), {
    path: ["notes"],
    message: "Owner FAIL requires a reason and retry requirements",
  });

export const AiQaCriterionV1Schema = z
  .object({
    criterion: z.enum([
      "IDENTITY",
      "WARDROBE_STATE",
      "PRODUCT_STRUCTURE",
      "BODY_PROPORTION_SCALE",
      "SCENE",
      "COMPOSITION",
      "CROSS_FRAME_CONTINUITY",
      "VISUAL_DAMAGE",
      "UNEXPECTED_OBJECTS",
    ]),
    status: GenerationQaStatusSchema,
    confidence: GenerationQaConfidenceSchema,
    evidence: z.string().min(1).max(2_000),
    frameRoles: z.array(ReviewFrameRoleSchema).max(3),
  })
  .strict();

export const AiQaResultV1Schema = z
  .object({
    schemaVersion: z.literal("ai-qa-result-v1"),
    providerId: z.string().min(1),
    requestedModelId: z.string().min(1),
    resolvedModelId: z.string().min(1),
    responseId: z.string().min(1),
    overallStatus: GenerationQaStatusSchema,
    summary: z.string().min(1).max(4_000),
    limitations: z.array(z.string().min(1).max(1_000)).min(2).max(10),
    criteria: z.array(AiQaCriterionV1Schema).length(9),
    usage: z.record(z.string(), z.number()).optional(),
  })
  .strict();

export const AiQaRequestV1Schema = z
  .object({
    schemaVersion: z.literal("ai-qa-request-v1"),
    artifactId: UuidSchema,
    generationSpecId: UuidSchema,
    generationSpecHash: Sha256Schema,
    referenceSlots: z.array(GenerationExecutionSlotV1Schema).max(30),
    reviewFrames: z
      .array(
        z.object({
          role: ReviewFrameRoleSchema,
          sha256: Sha256Schema,
          mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
          content: z.instanceof(Uint8Array),
        }),
      )
      .length(3),
    referenceImages: z
      .array(
        z.object({
          role: GenerationExecutionSlotV1Schema.shape.role,
          sha256: Sha256Schema,
          mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
          content: z.instanceof(Uint8Array),
        }),
      )
      .max(30),
    technicalFacts: z.record(z.string(), z.unknown()),
    expectedFacts: z.record(z.string(), z.unknown()),
    modelRef: z.object({
      providerId: z.enum(["fake", "codexmanager-local"]),
      modelId: z.enum(["fake-video-qa-v1", "gpt-5.4"]),
    }),
  })
  .strict();

export type GenerationProviderProfileId = z.infer<typeof GenerationProviderProfileIdSchema>;
export type GenerationProviderCapabilitiesV1 = z.infer<
  typeof GenerationProviderCapabilitiesV1Schema
>;
export type GenerationExecutionSlotV1 = z.infer<typeof GenerationExecutionSlotV1Schema>;
export type GenerationExecutionPreviewV1 = z.infer<typeof GenerationExecutionPreviewV1Schema>;
export type CreateGenerationExecutionPreviewV1 = z.infer<
  typeof CreateGenerationExecutionPreviewV1Schema
>;
export type CreateGenerationBatchV1 = z.infer<typeof CreateGenerationBatchV1Schema>;
export type GenerationJobStatusV1 = z.infer<typeof GenerationJobStatusV1Schema>;
export type AiQaRequestV1 = z.infer<typeof AiQaRequestV1Schema>;
export type AiQaResultV1 = z.infer<typeof AiQaResultV1Schema>;
export type HumanQaDecisionV1 = z.infer<typeof HumanQaDecisionV1Schema>;

export const ContinuitySubjectKindV1Schema = z.enum([
  "ENVIRONMENT",
  "CHARACTER",
  "PRODUCT",
  "PROP",
  "CAMERA",
  "VISUAL_STYLE",
]);
export const ContinuityPolicyV1Schema = z.enum(["WHOLE_FILM_HOLD", "SHOT_CHANGE", "UNIMPORTANT"]);
export const ContinuityImportanceV1Schema = z.enum(["HARD", "SOFT"]);
export const ContinuityIssueSeverityV1Schema = z.enum(["BLOCKER", "WARNING"]);
export const ContinuityActionV1Schema = z.enum([
  "INHERIT_PREVIOUS",
  "DECLARE_SHOT_CHANGE",
  "SELECT_APPROVED_REFERENCE",
]);

export const ContinuityRuleInputV1Schema = z
  .object({
    propertyKey: z.string().trim().min(1).max(120),
    policy: ContinuityPolicyV1Schema,
    importance: ContinuityImportanceV1Schema,
    expectedValue: z.unknown(),
    explanation: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const ContinuitySubjectInputV1Schema = z
  .object({
    subjectKey: z.string().trim().min(1).max(160),
    kind: ContinuitySubjectKindV1Schema,
    label: z.string().trim().min(1).max(160),
    productionAssetVersionId: UuidSchema.nullable().optional(),
    assetVersionFileId: UuidSchema.nullable().optional(),
    sourceSha256: Sha256Schema.nullable().optional(),
    facts: z.record(z.string(), z.unknown()),
    rules: z.array(ContinuityRuleInputV1Schema).min(1).max(40),
  })
  .strict();

export const ContinuityBoundaryInputV1Schema = z
  .object({
    boundaryIndex: z.number().int().min(0).max(20),
    label: z.string().trim().min(1).max(160),
    state: z.record(z.string(), z.unknown()),
  })
  .strict();

export const ShotContinuityStateInputV1Schema = z
  .object({
    storyboardShotId: UuidSchema,
    ordinal: z.number().int().min(1).max(20),
    startBoundaryIndex: z.number().int().min(0).max(19),
    endBoundaryIndex: z.number().int().min(1).max(20),
    declaredChanges: z.record(z.string(), z.unknown()),
  })
  .strict()
  .refine((value) => value.endBoundaryIndex === value.startBoundaryIndex + 1, {
    message: "Each shot must reference two adjacent shared boundaries",
  });

export const CreateContinuityVersionV1Schema = z
  .object({
    parentVersionId: UuidSchema.optional(),
    expectedRowVersion: z.number().int().nonnegative(),
    subjects: z.array(ContinuitySubjectInputV1Schema).min(1).max(100),
    boundaries: z.array(ContinuityBoundaryInputV1Schema).min(2).max(21),
    shots: z.array(ShotContinuityStateInputV1Schema).min(1).max(20),
    idempotencyKey: z.string().trim().min(1).max(120),
  })
  .strict();

export const ContinuityIssueV1Schema = z
  .object({
    severity: ContinuityIssueSeverityV1Schema,
    code: z.string().min(1).max(80),
    subjectKey: z.string().max(160).nullable(),
    shotOrdinal: z.number().int().min(1).max(20).nullable(),
    boundaryIndex: z.number().int().min(0).max(20).nullable(),
    message: z.string().min(1).max(2_000),
    actions: z.array(ContinuityActionV1Schema).max(3),
  })
  .strict();

export const ContinuityPreflightV1Schema = z
  .object({
    schemaVersion: z.literal("continuity-preflight-v1"),
    continuityProfileVersionId: UuidSchema,
    ready: z.boolean(),
    blockers: z.array(ContinuityIssueV1Schema),
    warnings: z.array(ContinuityIssueV1Schema),
    preflightHash: Sha256Schema,
    externalCalls: z.literal(0),
  })
  .strict();

export const ContinuityDecisionInputV1Schema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "REVOKED"]),
    preflightHash: Sha256Schema,
    idempotencyKey: z.string().trim().min(1).max(120),
    notes: z.string().trim().max(8_000).optional(),
  })
  .strict();

export const KeyframeProviderProfileIdSchema = z.enum([
  "fake-keyframe-v1",
  "codexmanager-gpt-image-2-v1",
]);
export const KeyframeCapabilityV1Schema = z
  .object({
    schemaVersion: z.literal("keyframe-capability-v1"),
    profileId: KeyframeProviderProfileIdSchema,
    providerId: z.enum(["fake", "codexmanager-local"]),
    modelId: z.string().min(1).max(160),
    modelSnapshot: z.string().min(1).max(160),
    generation: z.boolean(),
    editing: z.boolean(),
    multipleReferenceImages: z.boolean(),
    highFidelityInput: z.boolean(),
    maximumReferenceImages: z.number().int().min(0).max(20),
    providerRequestSize: z.literal("1024x1536"),
    width: z.literal(768),
    height: z.literal(1344),
    quality: z.literal("low"),
    priceAvailable: z.boolean(),
    estimatedCostUsdPerImage: z.number().nonnegative().nullable(),
    priceAsOf: z.string().datetime().nullable(),
    priceExpiresAt: z.string().datetime().nullable(),
    liveReady: z.boolean(),
    blockers: z.array(z.string().min(1).max(80)),
  })
  .strict();

export const KeyframePlanPreviewTargetV1Schema = z
  .object({
    boundaryId: UuidSchema,
    boundaryIndex: z.number().int().min(0).max(20),
    label: z.string().min(1).max(160),
    stateHash: Sha256Schema,
    referenceCount: z.number().int().min(0).max(20),
    referencesHash: Sha256Schema,
    promptHash: Sha256Schema,
    targetHash: Sha256Schema,
  })
  .strict();

export const KeyframePlanPreviewV1Schema = z
  .object({
    schemaVersion: z.literal("keyframe-plan-preview-v1"),
    projectId: UuidSchema,
    continuityProfileVersionId: UuidSchema,
    capability: KeyframeCapabilityV1Schema,
    targets: z.array(KeyframePlanPreviewTargetV1Schema).min(2).max(21),
    maximumCalls: z.number().int().min(0).max(21),
    estimatedMaximumCostUsd: z.number().nonnegative().nullable(),
    noRetry: z.literal(true),
    externalCalls: z.literal(0),
    ready: z.boolean(),
    blockers: z.array(z.string().min(1).max(80)),
    planHash: Sha256Schema,
  })
  .strict();

export const PreviewKeyframePlanV1Schema = z
  .object({ providerProfileId: KeyframeProviderProfileIdSchema.default("fake-keyframe-v1") })
  .strict();

export const CreateKeyframePlanV1Schema = z
  .object({
    providerProfileId: KeyframeProviderProfileIdSchema,
    planHash: Sha256Schema,
  })
  .strict();

export const AuthorizeKeyframePlanV1Schema = z
  .object({
    planHash: Sha256Schema,
    confirmed: z.literal(true),
    maximumCalls: z.number().int().min(1).max(21),
    expiresInSeconds: z.number().int().min(30).max(900).default(300),
    idempotencyKey: z.string().trim().min(1).max(120),
  })
  .strict();

export const KeyframeDecisionInputV1Schema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    idempotencyKey: z.string().trim().min(1).max(120),
    notes: z.string().trim().max(8_000).optional(),
  })
  .strict();

export const VideoControlTierV1Schema = z.enum([
  "ORDINARY_REFERENCE",
  "LOCKED_START",
  "LOCKED_START_END",
]);

export type ContinuitySubjectKindV1 = z.infer<typeof ContinuitySubjectKindV1Schema>;
export type ContinuityPolicyV1 = z.infer<typeof ContinuityPolicyV1Schema>;
export type ContinuitySubjectInputV1 = z.infer<typeof ContinuitySubjectInputV1Schema>;
export type CreateContinuityVersionV1 = z.infer<typeof CreateContinuityVersionV1Schema>;
export type ContinuityPreflightV1 = z.infer<typeof ContinuityPreflightV1Schema>;
export type KeyframeProviderProfileId = z.infer<typeof KeyframeProviderProfileIdSchema>;
export type KeyframeCapabilityV1 = z.infer<typeof KeyframeCapabilityV1Schema>;
export type KeyframePlanPreviewV1 = z.infer<typeof KeyframePlanPreviewV1Schema>;
export type VideoControlTierV1 = z.infer<typeof VideoControlTierV1Schema>;
