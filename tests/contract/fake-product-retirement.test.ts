import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GenerationExecutionService, StoryboardDirectorService } from "@comfyuiflow/project-core";

describe("Fake product retirement", () => {
  it("rejects Fake Director preview before any database access with a stable 410 code", async () => {
    const client = { storyboard: { findUnique: () => Promise.reject(new Error("DB_WRITE")) } };
    const service = new StoryboardDirectorService(client as any, undefined, {});
    await expect(
      service.preview("00000000-0000-4000-8000-000000000001", {
        profileId: "fake-storyboard-v2",
        maxShotCount: 3,
      }),
    ).rejects.toMatchObject({ code: "FAKE_PRODUCT_RETIRED", status: 410 });
  });

  it("rejects Fake video preview before reading a generation plan", async () => {
    const client = {
      generationPlanVersion: { findUnique: () => Promise.reject(new Error("DB_WRITE")) },
    };
    const service = new GenerationExecutionService(client as any, undefined, {});
    await expect(
      service.preview("00000000-0000-4000-8000-000000000001", {
        providerProfileId: "fake-video-v1",
        generationSpecIds: ["00000000-0000-4000-8000-000000000002"],
      }),
    ).rejects.toMatchObject({ code: "FAKE_PRODUCT_RETIRED", status: 410 });
  });

  it("retires the legacy deterministic generate write and preserves historical GET handlers", async () => {
    const [generate, proposals, proposal] = await Promise.all([
      readFile("apps/project-web/app/api/storyboards/[storyboardId]/generate/route.ts", "utf8"),
      readFile(
        "apps/project-web/app/api/storyboards/[storyboardId]/director-proposals/route.ts",
        "utf8",
      ),
      readFile(
        "apps/project-web/app/api/storyboard-director-proposals/[proposalId]/route.ts",
        "utf8",
      ),
    ]);
    expect(generate).toContain("FAKE_PRODUCT_RETIRED");
    expect(generate).toContain("status: 410");
    expect(proposals).toContain("export async function GET");
    expect(proposal).toContain("export async function GET");
  });

  it("does not construct Fake Director or Fake generation providers in the production Worker", async () => {
    const worker = await readFile("apps/project-worker/src/index.ts", "utf8");
    expect(worker).not.toContain("new FakeGenerationProvider");
    expect(worker).not.toContain("new FakeVideoQaProvider");
    expect(worker).toContain("DisabledGenerationProvider");
    expect(worker).toContain("PROJECT_STORYBOARD_DIRECTOR_LIVE_ENABLED");
  });
});
