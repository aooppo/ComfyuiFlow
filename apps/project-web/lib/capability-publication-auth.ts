import { timingSafeEqual } from "node:crypto";

export type CapabilityPublicationAuth =
  { ok: true } | { ok: false; status: 403 | 503; code: string };

/**
 * This is a deployment-local administrator boundary, not a generation gate.
 * The token is read only from the request header and is never stored or shown.
 */
export function checkCapabilityPublicationAdmin(token: string | null): CapabilityPublicationAuth {
  const expected = process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 503, code: "CAPABILITY_PUBLICATION_DISABLED" };
  if (!token) return { ok: false, status: 403, code: "CAPABILITY_PUBLICATION_ADMIN_REQUIRED" };
  const expectedBytes = Buffer.from(expected);
  const tokenBytes = Buffer.from(token);
  if (expectedBytes.length !== tokenBytes.length || !timingSafeEqual(expectedBytes, tokenBytes))
    return { ok: false, status: 403, code: "CAPABILITY_PUBLICATION_ADMIN_REQUIRED" };
  return { ok: true };
}
