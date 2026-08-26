import { ComfyUiClient, discoverNodeCapabilities } from "@comfyuiflow/comfyui-bridge";
import { CapabilityDiscoveryService } from "@comfyuiflow/project-core";
import { z } from "zod";
import { apiError, jsonBody } from "../../../../lib/api";
import { assertCapabilityRegistryOperator } from "../../../../lib/capability-registry-operator";

export const runtime = "nodejs";
const service = new CapabilityDiscoveryService();
const requestSchema = z
  .object({
    runtimeRef: z
      .object({ id: z.string().min(1).max(160), version: z.string().min(1).max(80) })
      .strict(),
    nodeClasses: z
      .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]*$/))
      .min(1)
      .max(100),
  })
  .strict();

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    assertCapabilityRegistryOperator(request);
    return Response.json({ candidates: await service.listCandidates() }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertCapabilityRegistryOperator(request);
    const body = requestSchema.parse(await jsonBody(request));
    const source = await new ComfyUiClient(
      process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188",
    ).getObjectInfo();
    const candidates = discoverNodeCapabilities(
      source,
      body.nodeClasses,
      body.runtimeRef,
      new Date().toISOString(),
    );
    const persisted = [];
    for (const candidate of candidates) persisted.push(await service.persistCandidate(candidate));
    return Response.json(
      { candidates: persisted, externalGenerationCalls: 0 },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    return apiError(error);
  }
}
