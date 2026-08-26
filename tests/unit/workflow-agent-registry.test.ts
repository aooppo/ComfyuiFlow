import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GenerationRegistrySchema } from "@comfyuiflow/contracts";
import { GenerationRegistryLoader } from "@comfyuiflow/project-core";

describe("workflow agent generation registry", () => {
  it("rejects duplicate definitions and broken cross references", async () => {
    const path = resolve("generation/registry.json");
    const registry = JSON.parse(await readFile(path, "utf8"));
    expect(() =>
      GenerationRegistrySchema.parse({
        ...registry,
        providers: [...registry.providers, registry.providers[0]],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      GenerationRegistrySchema.parse({
        ...registry,
        implementations: [{ ...registry.implementations[0], modelProfileId: "missing" }],
      }),
    ).toThrow(/mismatch/i);
  });

  it("keeps First Frame non-selectable without a captured catalog fixture", async () => {
    const registry = GenerationRegistrySchema.parse(
      JSON.parse(await readFile(resolve("generation/registry.json"), "utf8")),
    );
    expect(
      registry.implementations.find(
        (item) => item.implementationId === "minimax-h3-first-frame-comfyui-partner-v1",
      ),
    ).toMatchObject({
      defaultStatus: "TRIAL",
      selectable: false,
      availabilityCode: "STATIC_GRAPH_PREPROCESSING_PRICE_EVIDENCE_REQUIRED",
    });
  });

  it("normalizes array order into a stable safe registry hash", async () => {
    const loaded = await new GenerationRegistryLoader().load();
    expect(loaded.registrySha256).toMatch(/^[a-f0-9]{64}$/);
    expect([...loaded.implementationsById.keys()]).toEqual([
      "minimax-h3-first-frame-comfyui-partner-v1",
      "minimax-h3-first-last-frame-comfyui-partner-v1",
      "minimax-h3-reference-comfyui-partner-v1",
    ]);
    expect(JSON.stringify(loaded.document)).not.toMatch(
      /credentialValue|apiKey|rawEndpoint|localPath/i,
    );
  });

  it("locks existing registry and H3 graph bytes", async () => {
    const fixture = JSON.parse(
      await readFile(resolve("tests/fixtures/generation/legacy-h3-registry.json"), "utf8"),
    );
    const { createHash } = await import("node:crypto");
    const sha = async (path: string) =>
      createHash("sha256")
        .update(await readFile(resolve(path)))
        .digest("hex");
    await expect(sha("workflows/registry.json")).resolves.toBe(fixture.workflowRegistrySha256);
    await expect(sha("workflows/minimax-h3-project-shot-4s-v1.api.json")).resolves.toBe(
      fixture.projectShotWorkflowSha256,
    );
  });
});
