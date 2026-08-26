import { ProjectAssetError } from "../contracts.js";
import { prisma, type ProjectPrisma } from "../prisma.js";
import { GenerationRegistryLoader } from "./registry.js";

type SafeDependencyStatus = { ready: boolean; blocker: string | null };

function flag(environment: NodeJS.ProcessEnv, name: string): boolean {
  return environment[name] === "true" || environment[name] === "1";
}

export class WorkflowAgentReadinessService {
  constructor(
    private readonly client: ProjectPrisma = prisma,
    private readonly registryLoader = new GenerationRegistryLoader(),
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async get(projectId: string) {
    const project = await this.client.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project) throw new ProjectAssetError("PROJECT_NOT_FOUND", "Project was not found", 404);
    const registry = await this.registryLoader.load();
    const records = await this.client.generationImplementation.findMany({
      include: { evidence: { orderBy: { recordedAt: "desc" }, take: 20 } },
    });
    const byIdentity = new Map(
      records.map((item) => [`${item.implementationKey}@${item.version}`, item]),
    );
    const realGenerationEnabled =
      flag(this.environment, "REAL_GENERATION_ENABLED") &&
      flag(this.environment, "PROJECT_GENERATION_LIVE_ENABLED");
    const engineMode =
      this.environment.PROJECT_GENERATION_ENGINE === "legacy-v1"
        ? "legacy-v1"
        : "workflow-agent-v1";
    const credentialsReady = Boolean(
      this.environment.COMFYUI_API_KEY ||
      this.environment.COMFY_API_KEY ||
      this.environment.COMFYUI_AUTH_TOKEN,
    );
    const dependencies: Record<string, SafeDependencyStatus> = {
      database: { ready: true, blocker: null },
      worker: flag(this.environment, "PROJECT_WORKER_READY")
        ? { ready: true, blocker: null }
        : { ready: false, blocker: "WORKER_HEALTH_NOT_CONFIRMED" },
      generationRuntime: realGenerationEnabled
        ? { ready: true, blocker: null }
        : { ready: false, blocker: "REAL_GENERATION_DISABLED" },
      bridge: flag(this.environment, "PROJECT_COMFYUI_MCP_READY")
        ? { ready: true, blocker: null }
        : { ready: false, blocker: "GENERATION_BRIDGE_NOT_READY" },
      credential: credentialsReady
        ? { ready: true, blocker: null }
        : { ready: false, blocker: "GENERATION_CREDENTIAL_MISSING" },
      quota: flag(this.environment, "PROJECT_GENERATION_QUOTA_READY")
        ? { ready: true, blocker: null }
        : { ready: false, blocker: "GENERATION_QUOTA_NOT_CONFIRMED" },
    };
    const now = Date.now();
    const implementations = registry.document.implementations.map((implementation) => {
      const record = byIdentity.get(`${implementation.implementationId}@${implementation.version}`);
      const priceReady = Boolean(
        implementation.pricing && Date.parse(implementation.pricing.expiresAt) > now,
      );
      const technicalEvidenceReady = Boolean(
        record?.evidence.some(
          (evidence) =>
            evidence.technicalResult === "TECHNICALLY_VALID" && evidence.providerCallCount >= 0,
        ),
      );
      const lifecycleReady = record?.status === "READY" && technicalEvidenceReady;
      const blockers = [
        ...(!implementation.selectable ? [implementation.availabilityCode] : []),
        ...(!priceReady ? ["CURRENT_PRICE_UNAVAILABLE"] : []),
        ...(!lifecycleReady
          ? [record ? "REAL_TECHNICAL_EVIDENCE_REQUIRED" : "IMPLEMENTATION_NOT_SYNCED"]
          : []),
      ];
      return {
        implementationId: implementation.implementationId,
        version: implementation.version,
        modelProfileId: implementation.modelProfileId,
        executorType: implementation.executorType,
        status: record?.status ?? implementation.defaultStatus,
        selectable: implementation.selectable && priceReady && lifecycleReady,
        priceReady,
        technicalEvidenceReady,
        blockers: [...new Set(blockers)],
      };
    });
    const dependencyReady = Object.values(dependencies).every((item) => item.ready);
    return {
      schemaVersion: "generation-readiness-v1",
      projectId,
      projectActive: project.status === "ACTIVE",
      engineMode,
      realGenerationEnabled,
      readyForNewRealSubmission:
        project.status === "ACTIVE" &&
        engineMode === "workflow-agent-v1" &&
        dependencyReady &&
        implementations.some((item) => item.selectable),
      dependencies,
      implementations,
      rollback: {
        disableFlag: "REAL_GENERATION_ENABLED=false",
        legacyEngine: "PROJECT_GENERATION_ENGINE=legacy-v1",
        submittedWorkPolicy: "QUERY_RETAIN_CANCEL_RECONCILE_ONLY",
        historyPreserved: true,
      },
      externalCalls: 0,
    } as const;
  }
}
