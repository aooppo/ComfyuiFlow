import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  createStoryboardDirectorRunSchema,
  directorCreatePreviewInputSchema,
} from "@comfyuiflow/project-core";

describe("create-time AI Storyboard contract", () => {
  const valid = {
    title: "Red cup story",
    creativeBrief: "Create a coherent three-shot red ceramic cup story.",
  };

  it("keeps Provider, model, Shot cap, cost, and runtime fields server-owned", () => {
    expect(directorCreatePreviewInputSchema.parse(valid)).toEqual(valid);
    expect(() =>
      directorCreatePreviewInputSchema.parse({ ...valid, profileId: "openai-terra" }),
    ).toThrow();
    expect(() => directorCreatePreviewInputSchema.parse({ ...valid, maxShotCount: 20 })).toThrow();
    expect(() => directorCreatePreviewInputSchema.parse({ ...valid, maxCostUsd: 100 })).toThrow();
    expect(() =>
      directorCreatePreviewInputSchema.parse({ ...valid, endpoint: "http://example" }),
    ).toThrow();
    expect(
      createStoryboardDirectorRunSchema.parse({
        ...valid,
        previewHash: "a".repeat(64),
        idempotencyKey: "create-ai-12345678",
      }),
    ).toMatchObject({ previewHash: "a".repeat(64), idempotencyKey: "create-ai-12345678" });
  });

  it("exposes a zero-call preview and one atomic create-and-queue route", async () => {
    const [previewRoute, createRoute] = await Promise.all([
      readFile(
        "apps/project-web/app/api/projects/[projectId]/storyboards/director-preview/route.ts",
        "utf8",
      ),
      readFile("apps/project-web/app/api/projects/[projectId]/storyboards/route.ts", "utf8"),
    ]);
    expect(previewRoute).toContain("previewCreate");
    expect(previewRoute).toContain("externalCalls");
    expect(createRoute).toContain("createAndConfirm");
    expect(createRoute).toContain("status: 201");
    await expect(
      access("apps/project-web/app/api/projects/[projectId]/storyboards/director-preview/route.ts"),
    ).resolves.toBeUndefined();
  });

  it("shows exact authorization facts and never exposes a Fake choice", async () => {
    const ui = await readFile(
      "apps/project-web/components/storyboards/storyboard-library.tsx",
      "utf8",
    );
    expect(ui).toContain("Create and call AI");
    expect(ui).toContain("director-preview");
    expect(ui).toContain("maxCostUsd");
    expect(ui).toContain("maxExternalCalls");
    expect(ui).toContain("NO_RETRY_NO_FALLBACK");
    expect(ui).not.toContain("fake-storyboard-v2");
  });
});
