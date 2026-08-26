import { z } from "zod";

const IdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const StableCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const UuidSchema = z.string().uuid();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CurrencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/);
const CostMicrosSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const GenerationCapabilitySchema = z.enum([
  "REFERENCE_TO_VIDEO",
  "MULTI_REFERENCE_VIDEO",
  "FIRST_FRAME_TO_VIDEO",
  "PREVIOUS_FINAL_FRAME_TO_VIDEO",
  "FIRST_LAST_FRAME_TO_VIDEO",
  "MULTI_CHARACTER_REFERENCE_VIDEO",
  "AUDIO_DRIVEN_VIDEO",
  "LIP_SYNC_VIDEO",
]);
export const ExecutorTypeSchema = z.enum(["COMFYUI_GRAPH", "DIRECT_PROVIDER_API"]);
export const ModelFamilySchema = IdSchema;
export const ImplementationStatusSchema = z.enum([
  "DISCOVERED",
  "TRIAL",
  "READY",
  "BLOCKED",
  "RETIRED",
]);
export const ImplementationAvailabilityCodeSchema = StableCodeSchema;

export const workflowAgentErrorCodes = [
  "ADAPTER_NOT_IMPLEMENTED",
  "PROVIDER_NOT_CONFIGURED",
  "COST_UNAVAILABLE",
  "DEPENDENCY_CYCLE",
  "UPSTREAM_PLAN_INVALIDATED",
  "EXECUTION_PLAN_SHA_MISMATCH",
  "MATERIALIZED_INPUT_SHA_MISMATCH",
  "FIRST_LAST_FRAME_IMPLEMENTATION_NOT_AVAILABLE",
  "LOCKED_MODEL_INCOMPATIBLE",
  "REPAIR_PROPOSAL_STALE",
  "STATIC_GRAPH_INVALID",
  "CATALOG_STALE",
  "PRE_DISPATCH_BLOCKED",
  "PROVIDER_REJECTED",
  "SUBMISSION_AMBIGUOUS",
  "UPSTREAM_ARTIFACT_NOT_READY",
  "BATCH_COST_LIMIT_EXCEEDED",
] as const;
export const WorkflowAgentErrorCodeSchema = z.enum(workflowAgentErrorCodes);

export const ProviderProfileSchema = z
  .object({
    providerId: IdSchema,
    displayName: z.string().trim().min(1).max(120),
    authenticationProfileId: IdSchema,
    regions: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
    readinessCheckId: IdSchema,
  })
  .strict();

export const ModelProfileSchema = z
  .object({
    modelProfileId: IdSchema,
    providerId: IdSchema,
    modelFamily: ModelFamilySchema,
    displayName: z.string().trim().min(1).max(120),
    modelVersion: z.string().trim().min(1).max(160),
  })
  .strict();

const GenerationConstraintsSchema = z
  .object({
    durationSeconds: z.object({ min: z.number().positive(), max: z.number().positive() }).strict(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    aspectRatios: z
      .array(z.enum(["PORTRAIT_9_16", "LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5"]))
      .min(1),
  })
  .strict()
  .refine((value) => value.durationSeconds.min <= value.durationSeconds.max, {
    message: "durationSeconds min must not exceed max",
  });

const ImplementationPricingSchema = z
  .object({
    currency: CurrencySchema,
    estimatedCostMicros: CostMicrosSchema,
    effectiveAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .refine((value) => Date.parse(value.effectiveAt) < Date.parse(value.expiresAt), {
    message: "pricing expiry must follow effective time",
  });

export const GenerationImplementationSchema = z
  .object({
    implementationId: IdSchema,
    version: z.string().trim().min(1).max(40),
    providerId: IdSchema,
    modelProfileId: IdSchema,
    executorType: ExecutorTypeSchema,
    adapterId: IdSchema,
    adapterVersion: z.string().trim().min(1).max(40),
    defaultStatus: ImplementationStatusSchema,
    selectable: z.boolean(),
    availabilityCode: ImplementationAvailabilityCodeSchema,
    capabilities: z.array(GenerationCapabilitySchema).min(1).max(30),
    referenceSlots: z.array(StableCodeSchema).max(30),
    constraints: GenerationConstraintsSchema,
    referenceWorkflowIds: z.array(IdSchema).max(20),
    referenceWorkflowSha256: Sha256Schema.optional(),
    patternIds: z.array(IdSchema).max(20),
    nodeClasses: z.array(z.string().trim().min(1).max(160)).max(80),
    pricing: ImplementationPricingSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.referenceWorkflowIds.length > 0 && !value.referenceWorkflowSha256) {
      context.addIssue({ code: "custom", path: ["referenceWorkflowSha256"], message: "required" });
    }
    if (new Set(value.capabilities).size !== value.capabilities.length) {
      context.addIssue({ code: "custom", path: ["capabilities"], message: "must be unique" });
    }
  });

export const GenerationRegistrySchema = z
  .object({
    schemaVersion: z.literal("generation-registry-v1"),
    registryVersion: z.string().trim().min(1).max(80),
    providers: z.array(ProviderProfileSchema).min(1).max(100),
    models: z.array(ModelProfileSchema).min(1).max(300),
    implementations: z.array(GenerationImplementationSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const unique = (items: string[], path: string) => {
      if (new Set(items).size !== items.length)
        context.addIssue({ code: "custom", path: [path], message: "IDs must be unique" });
    };
    unique(
      value.providers.map((item) => item.providerId),
      "providers",
    );
    unique(
      value.models.map((item) => item.modelProfileId),
      "models",
    );
    unique(
      value.implementations.map((item) => `${item.implementationId}@${item.version}`),
      "implementations",
    );
    const providers = new Set(value.providers.map((item) => item.providerId));
    const models = new Map(value.models.map((item) => [item.modelProfileId, item]));
    for (const [index, model] of value.models.entries()) {
      if (!providers.has(model.providerId))
        context.addIssue({
          code: "custom",
          path: ["models", index, "providerId"],
          message: "unknown provider",
        });
    }
    for (const [index, implementation] of value.implementations.entries()) {
      const model = models.get(implementation.modelProfileId);
      if (!providers.has(implementation.providerId))
        context.addIssue({
          code: "custom",
          path: ["implementations", index, "providerId"],
          message: "unknown provider",
        });
      if (!model || model.providerId !== implementation.providerId)
        context.addIssue({
          code: "custom",
          path: ["implementations", index, "modelProfileId"],
          message: "model/provider mismatch",
        });
    }
  });

export const RequirementImportanceSchema = z.enum(["HARD", "HIGH", "MEDIUM", "LOW"]);
export const ShotModelSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("AUTO") }).strict(),
  z
    .object({
      mode: z.literal("PREFERRED"),
      preferredModelFamilies: z.array(ModelFamilySchema).min(1).max(20),
    })
    .strict(),
  z.object({ mode: z.literal("LOCKED"), providerId: IdSchema, modelProfileId: IdSchema }).strict(),
]);

export const WorkflowPlanningPreferenceSchema = z
  .object({
    shotKey: UuidSchema,
    modelSelection: ShotModelSelectionSchema,
    promptOverride: z.string().trim().min(1).max(4_000).optional(),
    skip: z.boolean().default(false),
    acceptedRelaxationRefs: z.array(IdSchema).max(30).default([]),
  })
  .strict();

export const WorkflowPlanningRequestSchema = z
  .object({
    schemaVersion: z.literal("workflow-planning-request-v1"),
    shotPreferences: z.array(WorkflowPlanningPreferenceSchema).max(20).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.shotPreferences.map((item) => item.shotKey);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["shotPreferences"],
        message: "Shot keys must be unique",
      });
    }
  });

export const WorkflowPlanningPreferencesUpdateSchema = z
  .object({
    schemaVersion: z.literal("workflow-planning-preferences-update-v1"),
    parentVersionId: UuidSchema,
    currentPreferenceHash: Sha256Schema.nullable(),
    shotPreferences: z.array(WorkflowPlanningPreferenceSchema).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.shotPreferences.map((item) => item.shotKey);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["shotPreferences"],
        message: "Shot keys must be unique",
      });
    }
  });

export const ShotDependencySchema = z
  .object({
    sourceShotKey: UuidSchema,
    targetShotKey: UuidSchema,
    type: z.enum(["PREVIOUS_SHOT_FINAL_FRAME", "SEMANTIC_CONTINUITY"]),
    importance: RequirementImportanceSchema,
    requiredInputSlot: IdSchema,
  })
  .strict()
  .refine((value) => value.sourceShotKey !== value.targetShotKey, { message: "self dependency" });

export const ShotDependencyGraphSchema = z
  .object({
    shotKeys: z.array(UuidSchema).min(1).max(20),
    dependencies: z.array(ShotDependencySchema).max(190),
  })
  .strict();

export const ShotRequirementSpecV2Schema = z
  .object({
    schemaVersion: z.literal("shot-requirement-spec-v2"),
    projectId: UuidSchema,
    storyboardId: UuidSchema,
    storyboardVersionId: UuidSchema,
    generationPlanVersionId: UuidSchema,
    storyboardShotId: UuidSchema,
    shotKey: UuidSchema,
    ordinal: z.number().int().min(1).max(20),
    startState: z.string().trim().min(1).max(2_000),
    action: z.string().trim().min(1).max(2_000),
    endState: z.string().trim().min(1).max(2_000),
    camera: z.string().trim().min(1).max(1_000),
    composition: z.string().trim().min(1).max(1_000),
    durationSeconds: z.number().positive().max(30),
    aspectRatio: z.enum(["PORTRAIT_9_16", "LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5"]),
    references: z
      .array(
        z
          .object({ assetVersionFileId: UuidSchema, sha256: Sha256Schema, semanticRole: IdSchema })
          .strict(),
      )
      .max(30),
    dependencies: z.array(ShotDependencySchema).max(19),
    modelSelection: ShotModelSelectionSchema,
    requirementHash: Sha256Schema,
  })
  .strict();

export const GenerationRequirementsSchema = z
  .object({
    schemaVersion: z.literal("generation-requirements-v1"),
    shotKey: UuidSchema,
    requiredCapabilities: z
      .array(
        z
          .object({
            capability: GenerationCapabilitySchema,
            importance: RequirementImportanceSchema,
          })
          .strict(),
      )
      .max(30),
    optionalCapabilities: z
      .array(
        z
          .object({
            capability: GenerationCapabilitySchema,
            importance: RequirementImportanceSchema,
          })
          .strict(),
      )
      .max(30),
    requiredInputSlots: z.array(StableCodeSchema).max(30),
    blockers: z.array(StableCodeSchema).max(30),
    requirementsHash: Sha256Schema,
  })
  .strict();

export const InputBindingSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ASSET_VERSION"),
      assetVersionFileId: UuidSchema,
      sha256: Sha256Schema,
      inputSlot: StableCodeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("PREVIOUS_SHOT_FINAL_FRAME"),
      sourceShotKey: UuidSchema,
      sourceShotExecutionPlanSha256: Sha256Schema,
      extractorVersion: IdSchema,
      inputSlot: StableCodeSchema,
    })
    .strict(),
]);
export const DependencyBindingSchema = InputBindingSchema;

export const CapabilitySnapshotSchema = z
  .object({
    schemaVersion: z.literal("capability-snapshot-v1"),
    registrySha256: Sha256Schema,
    policyVersion: IdSchema,
    capturedAt: z.string().datetime(),
    snapshotHash: Sha256Schema,
  })
  .strict();
export const ImplementationSnapshotSchema = z
  .object({
    schemaVersion: z.literal("implementation-snapshot-v1"),
    implementationId: IdSchema,
    version: z.string().min(1),
    registrySha256: Sha256Schema,
    status: ImplementationStatusSchema,
    snapshotHash: Sha256Schema,
  })
  .strict();
export const ExecutionPlanSnapshotSchema = z
  .object({
    schemaVersion: z.literal("execution-plan-snapshot-v1"),
    planTemplateSha256: Sha256Schema,
    capabilitySnapshotHash: Sha256Schema,
    implementationSnapshotHash: Sha256Schema,
  })
  .strict();

const ExecutionPlanCommon = {
  schemaVersion: z.literal("shot-execution-plan-v1"),
  planId: UuidSchema,
  projectId: UuidSchema,
  generationPlanVersionId: UuidSchema,
  generationSpecId: UuidSchema,
  implementationId: IdSchema,
  implementationVersion: z.string().min(1),
  adapterId: IdSchema,
  adapterVersion: z.string().min(1),
  planTemplateSha256: Sha256Schema,
  estimatedCostMicros: CostMicrosSchema.nullable(),
  maximumCostMicros: CostMicrosSchema.nullable(),
  currency: CurrencySchema.nullable(),
  inputBindings: z.array(InputBindingSchema).max(30),
} as const;

export const ComfyUiGraphExecutionPlanSchema = z
  .object({
    ...ExecutionPlanCommon,
    executorType: z.literal("COMFYUI_GRAPH"),
    referenceWorkflowId: IdSchema.optional(),
    referenceWorkflowSha256: Sha256Schema.optional(),
    catalogSha256: Sha256Schema,
    compilerVersion: IdSchema,
    graphSha256: Sha256Schema,
  })
  .strict();
export const DirectProviderApiExecutionPlanSchema = z
  .object({
    ...ExecutionPlanCommon,
    executorType: z.literal("DIRECT_PROVIDER_API"),
    endpointProfileVersion: IdSchema,
    safeRequestSnapshotHash: Sha256Schema,
  })
  .strict();
export const ShotExecutionPlanSchema = z.discriminatedUnion("executorType", [
  ComfyUiGraphExecutionPlanSchema,
  DirectProviderApiExecutionPlanSchema,
]);

export const ExecutionInputSnapshotSchema = z
  .object({
    schemaVersion: z.literal("execution-input-snapshot-v1"),
    planTemplateSha256: Sha256Schema,
    bindings: z
      .array(
        z
          .object({
            sourceArtifactSha256: Sha256Schema,
            frameSha256: Sha256Schema.optional(),
            extractorVersion: IdSchema.optional(),
          })
          .strict(),
      )
      .max(30),
    materializedInputHash: Sha256Schema,
    materializedExecutionSha256: Sha256Schema,
  })
  .strict();

export const RepairActionSchema = z.enum([
  "CHANGE_IMPLEMENTATION",
  "RELAX_REQUIREMENT",
  "REWRITE_SHOT",
  "SPLIT_SHOT",
  "REPLACE_ASSET",
]);
export const RepairProposalSchema = z
  .object({
    schemaVersion: z.literal("repair-proposal-v1"),
    action: RepairActionSchema,
    blockerCode: StableCodeSchema,
    reason: z.string().trim().min(1).max(2_000),
    affectedShotKeys: z.array(UuidSchema).min(1).max(20),
    transitiveInvalidationShotKeys: z.array(UuidSchema).max(20),
    creativeImpact: z.string().trim().min(1).max(2_000),
    estimatedNewCapabilities: z.array(GenerationCapabilitySchema).max(30),
    estimatedCalls: z.number().int().nonnegative().max(1),
    estimatedCostMicros: CostMicrosSchema.nullable(),
    requiresAiDirector: z.boolean(),
    proposalHash: Sha256Schema,
  })
  .strict();
export const StoryboardRepairProposalSchema = z
  .object({
    schemaVersion: z.literal("storyboard-repair-proposal-v1"),
    sourceStoryboardVersionId: UuidSchema,
    blockedShotKey: UuidSchema,
    proposals: z.array(RepairProposalSchema).min(1).max(20),
    impactHash: Sha256Schema,
  })
  .strict();

export const BatchCostSnapshotSchema = z
  .object({
    schemaVersion: z.literal("batch-cost-snapshot-v1"),
    currency: CurrencySchema,
    estimatedCostMicros: CostMicrosSchema,
    maximumCostMicros: CostMicrosSchema,
    generationCalls: z.number().int().nonnegative().max(20),
    qaCalls: z.number().int().nonnegative().max(20),
    pricingExpiresAt: z.string().datetime(),
    retryPolicy: z.literal("NO_RETRY_NO_FALLBACK"),
    snapshotHash: Sha256Schema,
  })
  .strict()
  .refine((value) => value.estimatedCostMicros <= value.maximumCostMicros, {
    message: "estimated cost exceeds maximum",
  });
export const QaContinuationPolicySchema = z
  .object({
    schemaVersion: z.literal("qa-continuation-policy-v1"),
    mode: z.enum(["AUTO_CONTINUE_AFTER_QA_PASS", "PAUSE_AFTER_EACH_SHOT"]),
    hardCriteria: z
      .array(
        z.enum([
          "IDENTITY",
          "PRODUCT_STRUCTURE",
          "VISUAL_DAMAGE",
          "UNEXPECTED_OBJECTS",
          "CROSS_FRAME_CONTINUITY",
        ]),
      )
      .max(5),
    hardFailConfidence: z.literal("HIGH"),
    policyHash: Sha256Schema,
  })
  .strict();

export type GenerationRegistry = z.infer<typeof GenerationRegistrySchema>;
export type GenerationImplementation = z.infer<typeof GenerationImplementationSchema>;
export type ShotRequirementSpecV2 = z.infer<typeof ShotRequirementSpecV2Schema>;
export type GenerationRequirements = z.infer<typeof GenerationRequirementsSchema>;
export type ShotExecutionPlan = z.infer<typeof ShotExecutionPlanSchema>;
export type RepairProposal = z.infer<typeof RepairProposalSchema>;
export type QaContinuationPolicy = z.infer<typeof QaContinuationPolicySchema>;
