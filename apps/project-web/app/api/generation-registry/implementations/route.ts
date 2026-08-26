import {
  CapabilityRegistryLoader,
  ImplementationEvidenceService,
  RegistryPublicationService,
  prisma,
} from "@comfyuiflow/project-core";
import {
  ImplementationEvidenceV2Schema,
  RegistryPublicationV2Schema,
  VersionRefV2Schema,
} from "@comfyuiflow/contracts";
import { z } from "zod";
import { apiError, jsonBody } from "../../../../lib/api";
import { assertCapabilityRegistryOperator } from "../../../../lib/capability-registry-operator";

export const runtime = "nodejs";
const publicationService = new RegistryPublicationService();
const evidenceService = new ImplementationEvidenceService();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PUBLISH"), publication: RegistryPublicationV2Schema }).strict(),
  z
    .object({ action: z.literal("APPEND_EVIDENCE"), evidence: ImplementationEvidenceV2Schema })
    .strict(),
  z.object({ action: z.literal("PROMOTE_READY"), implementationRef: VersionRefV2Schema }).strict(),
]);
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    assertCapabilityRegistryOperator(request);
    const [implementations, publications, evidence] = await Promise.all([
      prisma.capabilityGenerationImplementation.findMany({
        orderBy: [{ lifecycle: "asc" }, { implementationKey: "asc" }],
      }),
      prisma.capabilityRegistryPublication.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.capabilityImplementationEvidence.findMany({ orderBy: { recordedAt: "desc" } }),
    ]);
    return Response.json({ implementations, publications, evidence }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertCapabilityRegistryOperator(request);
    const body = actionSchema.parse(await jsonBody(request));
    if (body.action === "PUBLISH") {
      const registry = await new CapabilityRegistryLoader().load();
      await publicationService.syncRegistry(registry);
      return Response.json(
        await publicationService.persistPublication(body.publication, registry),
        { status: 201, headers: noStore },
      );
    }
    if (body.action === "APPEND_EVIDENCE")
      return Response.json(await evidenceService.append(body.evidence), {
        status: 201,
        headers: noStore,
      });
    return Response.json(await evidenceService.promoteReady(body.implementationRef), {
      headers: noStore,
    });
  } catch (error) {
    return apiError(error);
  }
}
