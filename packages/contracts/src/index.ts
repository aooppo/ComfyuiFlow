import { z } from "zod";

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const UuidSchema = z.string().uuid();

export const AssetRoleSchema = z.enum(["CHARACTER", "SCENE"]);
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

export const SpikeRequestSchema = z.object({
  characterImage: z.string().min(1),
  sceneImage: z.string().min(1),
  creativeDescription: z.string().min(1).max(4_000),
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
  imageInputs: z.array(InputAssetSchema).length(2),
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
    .length(2),
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
