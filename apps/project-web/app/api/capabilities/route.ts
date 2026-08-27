import { NextResponse } from "next/server";
import { prisma } from "@comfyuiflow/project-core";

export const dynamic = "force-dynamic";

type CapabilityRow = {
  ref: string;
  version: string;
  runtimeId: string;
  runtimeVersion: string;
};

/** Read-only registry surface. Registration remains a server-side release operation; this route
 * deliberately cannot create a capability or accept graph material from a browser. */
export async function GET() {
  const rows = await prisma.$queryRawUnsafe<CapabilityRow[]>(
    `SELECT i."ref", i."version", r."ref" AS "runtimeId", r."version" AS "runtimeVersion"
     FROM "GenerationImplementation" i
     JOIN "RuntimeContract" r ON r."id" = i."runtimeContractId"
     WHERE i."lifecycle" = 'READY'
     ORDER BY i."ref", i."version"`,
  );
  return NextResponse.json({
    capabilities: rows.map((row) => ({
      ref: row.ref,
      version: row.version,
      runtimeRef: { id: row.runtimeId, version: row.runtimeVersion },
    })),
    externalCalls: 0,
  });
}
