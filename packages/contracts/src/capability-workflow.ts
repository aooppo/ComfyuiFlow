import { z } from "zod";

const CapabilityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const CapabilityVersionSchema = z.string().trim().min(1).max(80);
const CapabilityCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Z0-9][A-Z0-9_]*$/);
const CapabilitySha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CapabilityUuidSchema = z.string().uuid();
const DateTimeSchema = z.string().datetime();
const RuntimeNodeIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/);

export const CapabilityWorkflowContractFamily = "capability-workflow-v3" as const;
export const VersionRefV2Schema = z
  .object({ id: CapabilityIdSchema, version: CapabilityVersionSchema })
  .strict();
const VersionedIdentityShape = { id: CapabilityIdSchema, version: CapabilityVersionSchema };

export const RuntimeProfileV2Schema = z
  .object({
    ...VersionedIdentityShape,
    name: z.string().trim().min(1).max(160),
    kind: z.enum(["COMFYUI_MCP", "DIRECT_API"]),
    connectionRef: CapabilityIdSchema,
    credentialRef: CapabilityIdSchema.nullable().optional(),
    enabled: z.boolean(),
  })
  .strict();

export const ProviderProfileV2Schema = z
  .object({
    ...VersionedIdentityShape,
    name: z.string().trim().min(1).max(160),
    kind: z.enum(["LOCAL_COMPUTE", "COMFYUI_PARTNER", "DIRECT_PROVIDER", "THIRD_PARTY_NODE"]),
    authorityRef: CapabilityIdSchema,
    credentialRef: CapabilityIdSchema.nullable().optional(),
    regions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    enabled: z.boolean(),
  })
  .strict();

export const ModelProfileV2Schema = z
  .object({
    ...VersionedIdentityShape,
    providerRef: VersionRefV2Schema,
    family: CapabilityIdSchema,
    displayName: z.string().trim().min(1).max(160),
    modality: z.literal("VIDEO"),
    capabilityCodes: z.array(CapabilityCodeSchema).min(1).max(60),
  })
  .strict()
  .refine((value) => new Set(value.capabilityCodes).size === value.capabilityCodes.length, {
    message: "capabilityCodes must be unique",
  });

export const AdapterOperationV2Schema = z.enum([
  "READINESS",
  "SUBMIT",
  "STATUS",
  "CANCEL",
  "RECONCILE",
  "ARTIFACTS",
]);
export const AdapterProfileV2Schema = z
  .object({
    ...VersionedIdentityShape,
    protocol: CapabilityIdSchema,
    factoryKey: CapabilityIdSchema,
    operations: z.array(AdapterOperationV2Schema).min(1).max(10),
  })
  .strict()
  .refine((value) => new Set(value.operations).size === value.operations.length, {
    message: "operations must be unique",
  });

const ModalityCardinalitySchema = z
  .object({
    min: z.number().int().nonnegative().max(20),
    max: z.number().int().nonnegative().max(20),
  })
  .strict()
  .refine((value) => value.min <= value.max, { message: "min must not exceed max" });

const DynamicInputGroupV2Schema = z
  .object({
    modality: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
    prefix: CapabilityIdSchema,
    min: z.number().int().nonnegative().max(20),
    max: z.number().int().nonnegative().max(20),
  })
  .strict()
  .refine((value) => value.min <= value.max, { message: "min must not exceed max" });

export const InputContractV2Schema = z
  .object({
    modalities: z
      .object({
        text: ModalityCardinalitySchema,
        image: ModalityCardinalitySchema,
        video: ModalityCardinalitySchema,
        audio: ModalityCardinalitySchema,
      })
      .strict(),
    requiredNamedInputs: z.array(CapabilityIdSchema).max(40).default([]),
    dynamicGroups: z.array(DynamicInputGroupV2Schema).max(20).default([]),
    crossFieldInvariants: z
      .array(z.enum(["IMAGE_OR_VIDEO_REQUIRED", "AUDIO_REQUIRES_IMAGE_OR_VIDEO"]))
      .max(10),
    ordering: z.literal("MODALITY_CONNECTION_ORDER"),
    promptLabels: z.literal("PROVIDER_NATIVE_ORDINALS"),
    outputMediaType: z.literal("video/mp4"),
  })
  .strict();

export const CompilerProfileV2Schema = z
  .object({
    ...VersionedIdentityShape,
    compilerKey: CapabilityIdSchema,
    inputContract: InputContractV2Schema,
    outputMappingKey: CapabilityIdSchema,
    sourceDigest: CapabilitySha256Schema,
  })
  .strict();

const MonetaryCostPolicyV2Schema = z
  .object({
    kind: z.literal("MONETARY"),
    currency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/),
    pricingVersion: CapabilityVersionSchema,
    estimatedCostMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    maximumCostMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    effectiveAt: DateTimeSchema,
    expiresAt: DateTimeSchema,
  })
  .strict()
  .refine((value) => value.estimatedCostMicros <= value.maximumCostMicros, {
    message: "estimated cost exceeds maximum",
  })
  .refine((value) => Date.parse(value.effectiveAt) < Date.parse(value.expiresAt), {
    message: "pricing expiry must follow effective time",
  });
const LocalComputeCostPolicyV2Schema = z
  .object({
    kind: z.literal("LOCAL_COMPUTE"),
    resourceClass: CapabilityIdSchema.optional(),
    estimate: z
      .object({
        unit: z.enum(["GPU_SECONDS", "CPU_SECONDS", "DEVICE_SECONDS"]),
        amount: z.number().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();
const TestCostPolicyV2Schema = z.object({ kind: z.literal("TEST_ZERO_CALL") }).strict();
export const CostPolicyV2Schema = z.discriminatedUnion("kind", [
  MonetaryCostPolicyV2Schema,
  LocalComputeCostPolicyV2Schema,
  TestCostPolicyV2Schema,
]);

export const GenerationImplementationLifecycleV2Schema = z.enum([
  "DISCOVERED",
  "TRIAL",
  "READY",
  "DEPRECATED",
  "DISABLED",
]);
export const GenerationImplementationV2Schema = z
  .object({
    ...VersionedIdentityShape,
    runtimeRef: VersionRefV2Schema,
    providerRef: VersionRefV2Schema,
    modelRef: VersionRefV2Schema,
    adapterRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    capabilityCodes: z.array(CapabilityCodeSchema).min(1).max(60),
    costPolicy: CostPolicyV2Schema,
    lifecycle: GenerationImplementationLifecycleV2Schema,
    evidencePolicy: z.enum(["FIXTURE_ONLY", "EXACT_VERSION_REAL_RESULT"]),
    testOnly: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.capabilityCodes).size !== value.capabilityCodes.length)
      context.addIssue({ code: "custom", path: ["capabilityCodes"], message: "must be unique" });
    if (value.testOnly !== (value.costPolicy.kind === "TEST_ZERO_CALL"))
      context.addIssue({
        code: "custom",
        path: ["testOnly"],
        message: "testOnly must match TEST_ZERO_CALL policy",
      });
  });

const refKey = (value: { id: string; version: string }) => `${value.id}@${value.version}`;
export const GenerationRegistryV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    registryVersion: CapabilityVersionSchema,
    runtimes: z.array(RuntimeProfileV2Schema).min(1).max(100),
    providers: z.array(ProviderProfileV2Schema).min(1).max(200),
    models: z.array(ModelProfileV2Schema).min(1).max(500),
    adapters: z.array(AdapterProfileV2Schema).min(1).max(100),
    compilers: z.array(CompilerProfileV2Schema).min(1).max(500),
    implementations: z.array(GenerationImplementationV2Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    const sets = {
      runtime: new Set(value.runtimes.map(refKey)),
      provider: new Set(value.providers.map(refKey)),
      model: new Set(value.models.map(refKey)),
      adapter: new Set(value.adapters.map(refKey)),
      compiler: new Set(value.compilers.map(refKey)),
      implementation: new Set(value.implementations.map(refKey)),
    };
    const unique = (length: number, set: Set<string>, path: string) => {
      if (length !== set.size)
        context.addIssue({ code: "custom", path: [path], message: "version refs must be unique" });
    };
    unique(value.runtimes.length, sets.runtime, "runtimes");
    unique(value.providers.length, sets.provider, "providers");
    unique(value.models.length, sets.model, "models");
    unique(value.adapters.length, sets.adapter, "adapters");
    unique(value.compilers.length, sets.compiler, "compilers");
    unique(value.implementations.length, sets.implementation, "implementations");
    for (const [index, model] of value.models.entries()) {
      if (!sets.provider.has(refKey(model.providerRef)))
        context.addIssue({
          code: "custom",
          path: ["models", index, "providerRef"],
          message: "unknown provider version",
        });
    }
    for (const [index, implementation] of value.implementations.entries()) {
      const refs = [
        ["runtimeRef", sets.runtime, implementation.runtimeRef],
        ["providerRef", sets.provider, implementation.providerRef],
        ["modelRef", sets.model, implementation.modelRef],
        ["adapterRef", sets.adapter, implementation.adapterRef],
        ["compilerRef", sets.compiler, implementation.compilerRef],
      ] as const;
      for (const [path, set, reference] of refs) {
        if (!set.has(refKey(reference)))
          context.addIssue({
            code: "custom",
            path: ["implementations", index, path],
            message: `unknown ${path.replace("Ref", "")} version`,
          });
      }
      const model = value.models.find((item) => refKey(item) === refKey(implementation.modelRef));
      if (model && refKey(model.providerRef) !== refKey(implementation.providerRef))
        context.addIssue({
          code: "custom",
          path: ["implementations", index, "modelRef"],
          message: "model/provider version mismatch",
        });
    }
  });

export const DiscoveryCandidateV2Schema = z
  .object({
    ...VersionedIdentityShape,
    runtimeRef: VersionRefV2Schema,
    discoveredAt: DateTimeSchema,
    sourceDigest: CapabilitySha256Schema,
    nodeIdentifier: RuntimeNodeIdentifierSchema,
    normalizedInputs: z.array(z.record(z.string(), z.unknown())).max(200),
    normalizedOutputs: z.array(z.record(z.string(), z.unknown())).max(50),
    dynamicGroups: z.array(DynamicInputGroupV2Schema).max(20),
    rawSchemaRef: CapabilityIdSchema,
    status: z.enum(["DISCOVERED", "REVIEW_REJECTED", "PUBLISHED"]),
  })
  .strict();
export const RegistryPublicationV2Schema = z
  .object({
    ...VersionedIdentityShape,
    candidateRef: VersionRefV2Schema,
    sourceDigest: CapabilitySha256Schema,
    providerRef: VersionRefV2Schema,
    modelRef: VersionRefV2Schema,
    adapterRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    implementationRef: VersionRefV2Schema,
    costPolicy: CostPolicyV2Schema,
    reviewerRef: CapabilityIdSchema,
    reviewedAt: DateTimeSchema,
  })
  .strict();
export const ImplementationEvidenceV2Schema = z
  .object({
    ...VersionedIdentityShape,
    implementationRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    kind: z.enum(["FIXTURE", "CONTRACT", "RUNTIME_READINESS", "AUTHORIZED_REAL_EXECUTION"]),
    outcome: z.enum(["PASS", "FAIL", "AMBIGUOUS"]),
    callCount: z.number().int().nonnegative().max(1_000),
    costDigest: CapabilitySha256Schema.nullable(),
    artifactRefs: z.array(VersionRefV2Schema).max(100),
    reviewerRef: CapabilityIdSchema,
    recordedAt: DateTimeSchema,
  })
  .strict();

export const RequirementPurposeV3Schema = z.enum([
  "CHARACTER",
  "PRODUCT",
  "ENVIRONMENT",
  "STYLE",
  "CONTINUITY",
  "MOTION",
  "AUDIO",
  "OTHER",
]);
export const RequirementNecessityV3Schema = z.enum(["REQUIRED", "OPTIONAL", "OMITTED"]);
export const WorkflowPlanningRequestV3Schema = z
  .object({
    schemaVersion: z.literal("workflow-planning-request-v3"),
    projectId: CapabilityUuidSchema,
    shotIds: z.array(CapabilityUuidSchema).min(1).max(20),
    storyboardRevisionRefs: z.array(VersionRefV2Schema).min(1).max(20),
    optionalOwnerConstraints: z
      .array(
        z
          .object({
            shotId: CapabilityUuidSchema,
            purpose: RequirementPurposeV3Schema,
          })
          .strict(),
      )
      .max(160)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.shotIds).size !== value.shotIds.length)
      context.addIssue({ code: "custom", path: ["shotIds"], message: "shotIds must be unique" });
    const revisionKeys = value.storyboardRevisionRefs.map(
      (reference) => `${reference.id}@${reference.version}`,
    );
    if (new Set(revisionKeys).size !== revisionKeys.length)
      context.addIssue({
        code: "custom",
        path: ["storyboardRevisionRefs"],
        message: "storyboardRevisionRefs must be unique",
      });
    const selected = new Set(value.shotIds);
    const constraintKeys = value.optionalOwnerConstraints.map(
      (constraint) => `${constraint.shotId}:${constraint.purpose}`,
    );
    if (value.optionalOwnerConstraints.some((constraint) => !selected.has(constraint.shotId)))
      context.addIssue({
        code: "custom",
        path: ["optionalOwnerConstraints"],
        message: "constraints must reference selected Shots",
      });
    if (new Set(constraintKeys).size !== constraintKeys.length)
      context.addIssue({
        code: "custom",
        path: ["optionalOwnerConstraints"],
        message: "optionalOwnerConstraints must be unique",
      });
  });
export const ShotRequirementSpecV3Schema = z
  .object({
    ...VersionedIdentityShape,
    shotId: CapabilityUuidSchema,
    storyboardRevisionRef: VersionRefV2Schema,
    purposes: z
      .array(
        z
          .object({
            purpose: RequirementPurposeV3Schema,
            necessity: RequirementNecessityV3Schema,
            reasonCode: CapabilityCodeSchema,
            constraints: z.array(CapabilityCodeSchema).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    requirementHash: CapabilitySha256Schema,
  })
  .strict();
export const PlanningInputBindingV3Schema = z
  .object({
    id: CapabilityUuidSchema,
    purpose: RequirementPurposeV3Schema,
    sourceKind: z.enum([
      "PROJECT_FILE",
      "SEMANTIC_ASSET_VERSION",
      "CHARACTER_STATE_VERSION",
      "UPSTREAM_FINAL_FRAME",
    ]),
    sourceRef: VersionRefV2Schema,
    sha256: CapabilitySha256Schema,
    modality: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
    order: z.number().int().nonnegative().max(100),
    roleLabel: z.string().trim().min(1).max(160),
    necessity: z.enum(["REQUIRED", "OPTIONAL"]),
  })
  .strict();
export const PlanningInputSnapshotV3Schema = z
  .object({
    ...VersionedIdentityShape,
    requirementSpecRef: VersionRefV2Schema,
    implementationRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    bindings: z.array(PlanningInputBindingV3Schema).max(100),
    omittedRequirementCodes: z.array(CapabilityCodeSchema).max(40),
    unresolvedRequirementCodes: z.array(CapabilityCodeSchema).max(40),
    sourceDigest: CapabilitySha256Schema,
    capabilityDigest: CapabilitySha256Schema,
    snapshotHash: CapabilitySha256Schema,
  })
  .strict();
export const GenerationSpecV3Schema = z
  .object({
    ...VersionedIdentityShape,
    shotId: CapabilityUuidSchema,
    storyboardRevisionRef: VersionRefV2Schema,
    requirementSpecRef: VersionRefV2Schema,
    planningInputSnapshotRef: VersionRefV2Schema,
    implementationRef: VersionRefV2Schema,
    runtimeRef: VersionRefV2Schema,
    providerRef: VersionRefV2Schema,
    modelRef: VersionRefV2Schema,
    adapterRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    generationIntent: z
      .object({
        prompt: z.string().trim().min(1).max(12_000),
        durationSeconds: z.number().positive().max(30),
      })
      .strict(),
    compiledRequestDigest: CapabilitySha256Schema,
    expectedOutput: z
      .object({
        mediaType: z.literal("video/mp4"),
        width: z.number().int().positive().max(8_192),
        height: z.number().int().positive().max(8_192),
        fps: z.number().positive().max(240),
      })
      .strict(),
    inputHash: CapabilitySha256Schema,
    dependencyHash: CapabilitySha256Schema,
    outputHash: CapabilitySha256Schema,
  })
  .strict();
export const GenerationPlanV3Schema = z
  .object({
    ...VersionedIdentityShape,
    storyboardRevisionRefs: z.array(VersionRefV2Schema).min(1).max(20),
    generationSpecRefs: z.array(VersionRefV2Schema).min(1).max(20),
    shotIds: z.array(CapabilityUuidSchema).min(1).max(20),
    planDigest: CapabilitySha256Schema,
    expectedCalls: z.number().int().nonnegative().max(20),
    costPolicyDigest: CapabilitySha256Schema,
    state: z.enum([
      "DRAFT",
      "VALID",
      "BLOCKED",
      "AUTHORIZED",
      "SUBMITTED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ]),
  })
  .strict()
  .refine((value) => value.generationSpecRefs.length === value.shotIds.length, {
    message: "every Shot requires exactly one Generation Spec",
  });

export const TrialScopeApprovalCreateRequestV3Schema = z
  .object({
    schemaVersion: z.literal("trial-scope-approval-create-request-v3"),
    generationPlanId: CapabilityUuidSchema,
    selectedShotIds: z.array(CapabilityUuidSchema).min(1).max(20),
    expiresInSeconds: z.number().int().min(60).max(86_400).default(1_800),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.selectedShotIds).size !== value.selectedShotIds.length)
      context.addIssue({
        code: "custom",
        path: ["selectedShotIds"],
        message: "selectedShotIds must be unique",
      });
  });

export const TrialScopeRevocationRequestV3Schema = z
  .object({
    schemaVersion: z.literal("trial-scope-revocation-request-v3"),
    reasonCode: z.literal("OWNER_REVOKED"),
    confirmed: z.literal(true),
  })
  .strict();

export const TrialScopeApprovalItemV3Schema = z
  .object({
    shotId: CapabilityUuidSchema,
    generationSpecRef: VersionRefV2Schema,
    implementationRef: VersionRefV2Schema,
    runtimeRef: VersionRefV2Schema,
    providerRef: VersionRefV2Schema,
    modelRef: VersionRefV2Schema,
    adapterRef: VersionRefV2Schema,
    compilerRef: VersionRefV2Schema,
    compiledRequestDigest: CapabilitySha256Schema,
    costPolicyDigest: CapabilitySha256Schema,
    compositionDigest: CapabilitySha256Schema,
  })
  .strict();

export const TrialScopeApprovalV3Schema = z
  .object({
    schemaVersion: z.literal("trial-scope-approval-v3"),
    id: CapabilityUuidSchema,
    projectId: CapabilityUuidSchema,
    storyboardId: CapabilityUuidSchema,
    storyboardRevisionRef: VersionRefV2Schema,
    generationPlanRef: VersionRefV2Schema,
    scopeDigest: CapabilitySha256Schema,
    idempotencyKey: z.string().trim().min(8).max(160),
    actorRef: CapabilityIdSchema,
    status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]),
    expiresAt: DateTimeSchema,
    createdAt: DateTimeSchema,
    items: z.array(TrialScopeApprovalItemV3Schema).min(1).max(20),
    revocation: z
      .object({
        id: CapabilityUuidSchema,
        reasonCode: z.literal("OWNER_REVOKED"),
        actorRef: CapabilityIdSchema,
        idempotencyKey: z.string().trim().min(8).max(160),
        createdAt: DateTimeSchema,
      })
      .strict()
      .nullable(),
    externalCalls: z.literal(0),
    generationAuthorized: z.literal(false),
    executionAuthorized: z.literal(false),
  })
  .strict();

export const TrialScopeApprovalHistoryV3Schema = z
  .object({
    schemaVersion: z.literal("trial-scope-approval-history-v3"),
    storyboardRevisionRef: VersionRefV2Schema,
    approvals: z.array(TrialScopeApprovalV3Schema).max(200),
    externalCalls: z.literal(0),
    generationAuthorized: z.literal(false),
    executionAuthorized: z.literal(false),
  })
  .strict();
export const GenerationAuthorizationV3Schema = z
  .object({
    id: CapabilityUuidSchema,
    planDigest: CapabilitySha256Schema,
    shotIds: z.array(CapabilityUuidSchema).min(1).max(20),
    generationSpecRefs: z.array(VersionRefV2Schema).min(1).max(20),
    implementationRefs: z.array(VersionRefV2Schema).min(1).max(20),
    providerRefs: z.array(VersionRefV2Schema).min(1).max(20),
    expectedCalls: z.number().int().nonnegative().max(40),
    maximumCalls: z.number().int().positive().max(40),
    costPolicyDigest: CapabilitySha256Schema,
    maximumCostMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    expiresAt: DateTimeSchema,
    noRetry: z.literal(true),
    noFallback: z.literal(true),
    consumedCalls: z.number().int().nonnegative().max(40),
    state: z.enum(["ACTIVE", "CONSUMED", "EXPIRED", "CANCELLED"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedCalls > value.maximumCalls)
      context.addIssue({ code: "custom", path: ["expectedCalls"], message: "exceeds call cap" });
    if (value.consumedCalls > value.maximumCalls)
      context.addIssue({ code: "custom", path: ["consumedCalls"], message: "exceeds call cap" });
    if (value.generationSpecRefs.length !== value.shotIds.length)
      context.addIssue({
        code: "custom",
        path: ["generationSpecRefs"],
        message: "every Shot requires exactly one Generation Spec",
      });
  });

export const GenerationExecutionPreviewRequestV3Schema = z
  .object({
    schemaVersion: z.literal("capability-generation-execution-preview-request-v3"),
    shotIds: z.array(CapabilityUuidSchema).min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.shotIds).size !== value.shotIds.length)
      context.addIssue({ code: "custom", path: ["shotIds"], message: "shotIds must be unique" });
  });

export const GenerationExecutionPreviewV3Schema = z
  .object({
    schemaVersion: z.literal("capability-generation-execution-preview-v3"),
    projectId: CapabilityUuidSchema,
    generationPlanId: CapabilityUuidSchema,
    planDigest: CapabilitySha256Schema,
    selectedShotIds: z.array(CapabilityUuidSchema).min(1).max(20),
    targets: z
      .array(
        z
          .object({
            shotId: CapabilityUuidSchema,
            ordinal: z.number().int().positive().max(20),
            generationSpecRef: VersionRefV2Schema,
            implementationRef: VersionRefV2Schema,
            runtimeRef: VersionRefV2Schema,
            providerRef: VersionRefV2Schema,
            modelRef: VersionRefV2Schema,
            adapterRef: VersionRefV2Schema,
            compilerRef: VersionRefV2Schema,
            lifecycle: z.enum(["READY", "TRIAL"]),
            compiledRequestDigest: CapabilitySha256Schema,
            inputHash: CapabilitySha256Schema,
            dependencyHash: CapabilitySha256Schema,
            outputHash: CapabilitySha256Schema,
            targetDigest: CapabilitySha256Schema,
            costPolicy: CostPolicyV2Schema,
            blockers: z.array(CapabilityCodeSchema).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    ready: z.boolean(),
    submissionBlockers: z.array(CapabilityCodeSchema).max(20),
    expectedCalls: z.number().int().nonnegative().max(20),
    maximumCalls: z.number().int().positive().max(20),
    maximumAiQaCalls: z.number().int().nonnegative().max(20),
    costPolicyDigest: CapabilitySha256Schema,
    maximumCostMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    currency: z.string().length(3).nullable(),
    localComputeResources: z.array(z.string().trim().min(1).max(160)).max(20),
    pricingExpiresAt: DateTimeSchema.nullable(),
    noRetry: z.literal(true),
    noFallback: z.literal(true),
    externalCalls: z.literal(0),
    generationAuthorized: z.literal(false),
    previewHash: CapabilitySha256Schema,
  })
  .strict();

export type VersionRefV2 = z.infer<typeof VersionRefV2Schema>;
export type WorkflowPlanningRequestV3 = z.infer<typeof WorkflowPlanningRequestV3Schema>;
export type RuntimeProfileV2 = z.infer<typeof RuntimeProfileV2Schema>;
export type ProviderProfileV2 = z.infer<typeof ProviderProfileV2Schema>;
export type ModelProfileV2 = z.infer<typeof ModelProfileV2Schema>;
export type AdapterProfileV2 = z.infer<typeof AdapterProfileV2Schema>;
export type InputContractV2 = z.infer<typeof InputContractV2Schema>;
export type CompilerProfileV2 = z.infer<typeof CompilerProfileV2Schema>;
export type CostPolicyV2 = z.infer<typeof CostPolicyV2Schema>;
export type GenerationImplementationV2 = z.infer<typeof GenerationImplementationV2Schema>;
export type GenerationRegistryV2 = z.infer<typeof GenerationRegistryV2Schema>;
export type DiscoveryCandidateV2 = z.infer<typeof DiscoveryCandidateV2Schema>;
export type RegistryPublicationV2 = z.infer<typeof RegistryPublicationV2Schema>;
export type ImplementationEvidenceV2 = z.infer<typeof ImplementationEvidenceV2Schema>;
export type ShotRequirementSpecV3 = z.infer<typeof ShotRequirementSpecV3Schema>;
export type PlanningInputSnapshotV3 = z.infer<typeof PlanningInputSnapshotV3Schema>;
export type GenerationSpecV3 = z.infer<typeof GenerationSpecV3Schema>;
export type GenerationPlanV3 = z.infer<typeof GenerationPlanV3Schema>;
export type TrialScopeApprovalCreateRequestV3 = z.infer<
  typeof TrialScopeApprovalCreateRequestV3Schema
>;
export type TrialScopeApprovalItemV3 = z.infer<typeof TrialScopeApprovalItemV3Schema>;
export type TrialScopeApprovalV3 = z.infer<typeof TrialScopeApprovalV3Schema>;
export type TrialScopeApprovalHistoryV3 = z.infer<typeof TrialScopeApprovalHistoryV3Schema>;
export type GenerationAuthorizationV3 = z.infer<typeof GenerationAuthorizationV3Schema>;
export type GenerationExecutionPreviewRequestV3 = z.infer<
  typeof GenerationExecutionPreviewRequestV3Schema
>;
export type GenerationExecutionPreviewV3 = z.infer<typeof GenerationExecutionPreviewV3Schema>;
