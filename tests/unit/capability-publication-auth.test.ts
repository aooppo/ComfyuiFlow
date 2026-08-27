import { afterEach, describe, expect, it } from "vitest";

import { checkCapabilityPublicationAdmin } from "../../apps/project-web/lib/capability-publication-auth.js";

const originalToken = process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN;
  else process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN = originalToken;
});

describe("Capability Pack local-admin boundary", () => {
  it("fails closed when disabled or the administrator token does not match", () => {
    delete process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN;
    expect(checkCapabilityPublicationAdmin("anything")).toEqual({
      ok: false,
      status: 503,
      code: "CAPABILITY_PUBLICATION_DISABLED",
    });

    process.env.CAPABILITY_PUBLICATION_ADMIN_TOKEN = "local-only-token";
    expect(checkCapabilityPublicationAdmin(null)).toMatchObject({ ok: false, status: 403 });
    expect(checkCapabilityPublicationAdmin("wrong-token")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(checkCapabilityPublicationAdmin("local-only-token")).toEqual({ ok: true });
  });
});
