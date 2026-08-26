import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CapabilityRegistryLoader,
  projectLegacyGenerationRegistryV1,
} from "@comfyuiflow/project-core";
import { GenerationRegistrySchema } from "@comfyuiflow/contracts";

const hash = "a".repeat(64);
const ref = (id: string) => ({ id, version: "1.0.0" });

function registry() {
  const inputContract = {
    modalities: {
      text: { min: 1, max: 1 },
      image: { min: 0, max: 0 },
      video: { min: 0, max: 0 },
      audio: { min: 0, max: 0 },
    },
    crossFieldInvariants: [],
    ordering: "MODALITY_CONNECTION_ORDER",
    promptLabels: "PROVIDER_NATIVE_ORDINALS",
    outputMediaType: "video/mp4",
  };
  return {
    schemaVersion: 2,
    registryVersion: "2026-08-26.1",
    runtimes: [
      {
        ...ref("runtime.comfyui"),
        name: "ComfyUI",
        kind: "COMFYUI_MCP",
        connectionRef: "runtime.local",
        enabled: true,
      },
    ],
    providers: [
      {
        ...ref("provider.local"),
        name: "Local compute",
        kind: "LOCAL_COMPUTE",
        authorityRef: "local-owner",
        credentialRef: null,
        enabled: true,
      },
    ],
    models: [
      {
        ...ref("model.local-video"),
        providerRef: ref("provider.local"),
        family: "local-video",
        displayName: "Local video",
        modality: "VIDEO",
        capabilityCodes: ["TEXT_TO_VIDEO"],
      },
    ],
    adapters: [
      {
        ...ref("adapter.comfyui-mcp"),
        protocol: "comfyui-mcp-v2",
        factoryKey: "comfyui-mcp-v2",
        operations: ["READINESS", "SUBMIT", "STATUS", "CANCEL", "RECONCILE", "ARTIFACTS"],
      },
    ],
    compilers: [
      {
        ...ref("compiler.text"),
        compilerKey: "text-video-v1",
        inputContract,
        outputMappingKey: "video-output-v1",
        sourceDigest: hash,
      },
    ],
    implementations: [
      {
        ...ref("implementation.local-text"),
        runtimeRef: ref("runtime.comfyui"),
        providerRef: ref("provider.local"),
        modelRef: ref("model.local-video"),
        adapterRef: ref("adapter.comfyui-mcp"),
        compilerRef: ref("compiler.text"),
        capabilityCodes: ["TEXT_TO_VIDEO"],
        costPolicy: { kind: "LOCAL_COMPUTE", resourceClass: "local-gpu" },
        lifecycle: "READY",
        evidencePolicy: "EXACT_VERSION_REAL_RESULT",
        testOnly: false,
      },
      {
        ...ref("implementation.fixture"),
        runtimeRef: ref("runtime.comfyui"),
        providerRef: ref("provider.local"),
        modelRef: ref("model.local-video"),
        adapterRef: ref("adapter.comfyui-mcp"),
        compilerRef: ref("compiler.text"),
        capabilityCodes: ["TEXT_TO_VIDEO"],
        costPolicy: { kind: "TEST_ZERO_CALL" },
        lifecycle: "READY",
        evidencePolicy: "FIXTURE_ONLY",
        testOnly: true,
      },
    ],
  };
}

describe("capability registry loader", () => {
  it("loads the reviewed default registry and excludes trials, deprecated history, and fixtures", async () => {
    const loaded = await new CapabilityRegistryLoader().load();
    expect(loaded.resolveSelectable({ production: true }).map((item) => item.id)).toEqual([
      "implementation.hailuo03-reference-partner",
    ]);
    expect(loaded.explainResolution({ production: true }).rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonCode: "TRIAL_SCOPE_REQUIRED" }),
        expect.objectContaining({ reasonCode: "IMPLEMENTATION_NOT_SELECTABLE" }),
        expect.objectContaining({ reasonCode: "TEST_ONLY_IMPLEMENTATION" }),
      ]),
    );
  });

  it("loads exact independent versions with a stable canonical digest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capability-registry-"));
    const path = join(directory, "registry.json");
    await writeFile(path, JSON.stringify(registry()));
    const loaded = await new CapabilityRegistryLoader(path).load();
    expect(loaded.registrySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(loaded.implementationsByRef.get("implementation.local-text@1.0.0")).toMatchObject({
      lifecycle: "READY",
      runtimeRef: ref("runtime.comfyui"),
      providerRef: ref("provider.local"),
    });
  });

  it("rejects broken exact-version composition", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capability-registry-"));
    const path = join(directory, "registry.json");
    const broken = registry();
    broken.implementations[0]!.compilerRef.version = "2.0.0";
    await writeFile(path, JSON.stringify(broken));
    await expect(new CapabilityRegistryLoader(path).load()).rejects.toThrow(
      /compiler.*unknown|unknown.*compiler/i,
    );
  });

  it("excludes test-only and discovered identities from production resolution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "capability-registry-"));
    const path = join(directory, "registry.json");
    const document = registry();
    document.implementations.push({
      ...document.implementations[0]!,
      id: "implementation.discovered",
      lifecycle: "DISCOVERED",
    });
    await writeFile(path, JSON.stringify(document));
    const loaded = await new CapabilityRegistryLoader(path).load();
    expect(loaded.resolveSelectable({ production: true }).map((item) => item.id)).toEqual([
      "implementation.local-text",
    ]);
    expect(loaded.explainResolution({ production: true }).rejected).toEqual([
      expect.objectContaining({ reasonCode: "DISCOVERED_NOT_PUBLISHED" }),
      expect.objectContaining({ reasonCode: "TEST_ONLY_IMPLEMENTATION" }),
    ]);
  });

  it("preserves the locked legacy Registry V1 bytes", async () => {
    const fixture = JSON.parse(
      await readFile(resolve("tests/fixtures/generation/legacy-h3-registry.json"), "utf8"),
    );
    const { createHash } = await import("node:crypto");
    const actual = createHash("sha256")
      .update(await readFile(resolve("generation/registry.json")))
      .digest("hex");
    expect(actual).toBe(fixture.generationRegistrySha256);
    const legacy = GenerationRegistrySchema.parse(
      JSON.parse(await readFile(resolve("generation/registry.json"), "utf8")),
    );
    expect(projectLegacyGenerationRegistryV1(legacy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "minimax-h3-reference-comfyui-partner-v1",
          lifecycle: "DEPRECATED",
          historical: true,
          sourceSchemaVersion: "generation-registry-v1",
        }),
      ]),
    );
  });
});
