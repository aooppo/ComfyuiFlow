import { hashCanonical } from "@comfyuiflow/spike-core";
import type { ComfyUiFrozenExecutor } from "./execution.js";

export interface FrozenMainlineExecutionRecord {
  attemptId: string;
  attemptState: "SUBMITTING" | "SUBMITTED" | "RECONCILING";
  providerTaskId: string;
  adapterRef: { id: string; version: string };
  runtimeRef: { id: string; version: string };
  runtimeContractDigest: string;
  graphSha256: string;
  graphValidationEvidence: {
    id: string;
    outcome: "PASS";
    graphSha256: string;
    runtimeContractDigest: string;
    runtimeFingerprintSha256: string;
    nodeCatalogSha256: string;
  };
  runtimeNodeClasses: string[];
  graph: Readonly<Record<string, unknown>>;
  inputs: Array<{ localPath: string; sha256: string; stagedInputName: string }>;
}

export interface MainlineExecutionIdentity {
  attemptId: string;
  adapterRef: { id: string; version: string };
  runtimeRef: { id: string; version: string };
  runtimeContractDigest: string;
  graphSha256: string;
}

export interface ComfyUiMainlineExecutionStore {
  loadForSubmission(
    identity: MainlineExecutionIdentity,
  ): Promise<FrozenMainlineExecutionRecord | null>;
  loadSubmitted(attemptId: string): Promise<FrozenMainlineExecutionRecord | null>;
}

function assertIdentity(
  record: FrozenMainlineExecutionRecord,
  identity: MainlineExecutionIdentity,
) {
  if (
    record.attemptId !== identity.attemptId ||
    record.adapterRef.id !== identity.adapterRef.id ||
    record.adapterRef.version !== identity.adapterRef.version ||
    record.runtimeRef.id !== identity.runtimeRef.id ||
    record.runtimeRef.version !== identity.runtimeRef.version ||
    record.runtimeContractDigest !== identity.runtimeContractDigest ||
    record.graphSha256 !== identity.graphSha256
  )
    throw new Error("MAINLINE_FROZEN_IDENTITY_MISMATCH");
  if (!["SUBMITTING", "SUBMITTED", "RECONCILING"].includes(record.attemptState))
    throw new Error("MAINLINE_ATTEMPT_NOT_DISPATCHABLE");
  if (hashCanonical(record.graph) !== record.graphSha256)
    throw new Error("MAINLINE_FROZEN_GRAPH_DIGEST_MISMATCH");
  if (
    record.graphValidationEvidence.outcome !== "PASS" ||
    record.graphValidationEvidence.graphSha256 !== record.graphSha256 ||
    record.graphValidationEvidence.runtimeContractDigest !== record.runtimeContractDigest ||
    !/^[a-f0-9]{64}$/.test(record.graphValidationEvidence.nodeCatalogSha256) ||
    !/^[a-f0-9]{64}$/.test(record.graphValidationEvidence.runtimeFingerprintSha256) ||
    !record.runtimeNodeClasses.length
  )
    throw new Error("MAINLINE_GRAPH_EVIDENCE_STALE_OR_MISSING");
  if (
    record.inputs.length > 15 ||
    new Set(record.inputs.map((item) => item.stagedInputName)).size !== record.inputs.length
  )
    throw new Error("MAINLINE_FROZEN_INPUTS_INVALID");
}

export class ComfyUiMainlineExecutionService {
  constructor(
    private readonly dependencies: {
      store: ComfyUiMainlineExecutionStore;
      execution: ComfyUiFrozenExecutor;
      recheckRuntimeContract(input: {
        runtimeRef: { id: string; version: string };
        runtimeContractDigest: string;
        graphSha256: string;
        evidence: FrozenMainlineExecutionRecord["graphValidationEvidence"];
        nodeClasses: string[];
      }): Promise<{ ready: boolean; blockers: string[] }>;
    },
  ) {}

  async submit(identity: MainlineExecutionIdentity) {
    const record = await this.dependencies.store.loadForSubmission(identity);
    if (!record) throw new Error("MAINLINE_ATTEMPT_NOT_FOUND");
    assertIdentity(record, identity);
    this.dependencies.execution.assertLiveEnabled();
    const readiness = await this.dependencies.recheckRuntimeContract({
      runtimeRef: record.runtimeRef,
      runtimeContractDigest: record.runtimeContractDigest,
      graphSha256: record.graphSha256,
      evidence: record.graphValidationEvidence,
      nodeClasses: record.runtimeNodeClasses,
    });
    if (!readiness.ready)
      throw new Error(`MAINLINE_RUNTIME_BLOCKED:${readiness.blockers.join(",")}`);
    await Promise.all(
      record.inputs.map((input) => this.dependencies.execution.stageFrozenInput(input)),
    );
    return {
      taskId: (
        await this.dependencies.execution.submitFrozenGraph({
          promptId: record.providerTaskId,
          materializedGraph: record.graph,
          materializedGraphSha256: record.graphSha256,
        })
      ).promptId,
    };
  }

  async status(attemptId: string) {
    const record = await this.dependencies.store.loadSubmitted(attemptId);
    if (!record) throw new Error("MAINLINE_ATTEMPT_NOT_FOUND");
    return this.dependencies.execution.status(record.providerTaskId);
  }

  async retain(attemptId: string) {
    const record = await this.dependencies.store.loadSubmitted(attemptId);
    if (!record) throw new Error("MAINLINE_ATTEMPT_NOT_FOUND");
    return this.dependencies.execution.retain(record.providerTaskId);
  }
}
