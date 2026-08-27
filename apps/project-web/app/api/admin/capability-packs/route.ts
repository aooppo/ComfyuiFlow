import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canonicalizeCapabilityPack,
  CapabilityPublicationService,
  PrismaCapabilityPublicationStore,
  prisma,
} from "@comfyuiflow/project-core";

import { checkCapabilityPublicationAdmin } from "../../../../lib/capability-publication-auth";

export const dynamic = "force-dynamic";

function authorize(request: NextRequest) {
  return checkCapabilityPublicationAdmin(request.headers.get("x-capability-publication-token"));
}

/**
 * The only browser write surface for Capability Packs. It writes an immutable
 * TRIAL registration and receipt; it does not contact ComfyUI or a provider.
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code }, { status: auth.status });
  try {
    const body = (await request.json()) as { actorRef?: unknown; manifest?: unknown };
    const receipt = await new CapabilityPublicationService(
      new PrismaCapabilityPublicationStore(prisma),
    ).publishTrial(body.manifest, typeof body.actorRef === "string" ? body.actorRef : "");
    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { code: error instanceof Error ? error.message : "CAPABILITY_PUBLICATION_REJECTED" },
      { status: 400 },
    );
  }
}

/** Generate the canonical digest locally on the server for operator review; no database write occurs. */
export async function PUT(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code }, { status: auth.status });
  try {
    const manifest = canonicalizeCapabilityPack(await request.json());
    return NextResponse.json({ manifest, externalCalls: 0 });
  } catch (error) {
    return NextResponse.json(
      { code: error instanceof Error ? error.message : "CAPABILITY_PACK_INVALID" },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ code: auth.code }, { status: auth.status });
  const receipts = await prisma.capabilityPublicationReceipt.findMany({
    select: {
      id: true,
      actorRef: true,
      manifestSha256: true,
      createdAt: true,
      implementation: { select: { ref: true, version: true, lifecycle: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return NextResponse.json({
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      actorRef: receipt.actorRef,
      manifestSha256: receipt.manifestSha256,
      implementation: receipt.implementation,
      createdAt: receipt.createdAt.toISOString(),
    })),
    externalCalls: 0,
  });
}
