interface DiscoveryPort {
  listWorkflows(): Promise<Record<string, unknown>>;
  getQueue(): Promise<{ running: string[]; pending: string[] }>;
  checkReadiness(workflowId: string): Promise<{
    ready: boolean;
    blockers: string[];
    generationCalls: 0;
  }>;
}

export async function buildDiscovery(port: DiscoveryPort) {
  const registry = await port.listWorkflows();
  const workflows = Array.isArray(registry.workflows) ? registry.workflows : [];
  const blockers: string[] = [];
  if (workflows.length === 0) {
    blockers.push("NO_REGISTERED_WORKFLOW", "VIDEO_MODEL_UNVERIFIED");
  }
  let endpointReachable = false;
  let queue: { running: string[]; pending: string[] } = { running: [], pending: [] };
  try {
    queue = await port.getQueue();
    endpointReachable = true;
  } catch {
    blockers.push("COMFYUI_UNREACHABLE");
  }
  const workflowReadiness: unknown[] = [];
  if (endpointReachable) {
    for (const workflow of workflows) {
      const workflowId =
        typeof workflow === "object" && workflow !== null && "workflowId" in workflow
          ? String(workflow.workflowId)
          : "";
      if (!workflowId) {
        blockers.push("WORKFLOW_REGISTRY_INVALID");
        continue;
      }
      try {
        const readiness = await port.checkReadiness(workflowId);
        workflowReadiness.push(readiness);
        blockers.push(...readiness.blockers.map((blocker) => `${workflowId}:${blocker}`));
      } catch {
        blockers.push(`${workflowId}:READINESS_CHECK_FAILED`);
      }
    }
  }
  return {
    mode: "DISCOVERY" as const,
    ready: blockers.length === 0,
    endpointReachable,
    workflows,
    queue,
    workflowReadiness,
    blockers: [...new Set(blockers)],
    providerCalls: 0 as const,
    generationCalls: 0 as const,
  };
}
