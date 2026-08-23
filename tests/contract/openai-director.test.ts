import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { OpenAiResponsesProvider } from "@comfyuiflow/ai-providers";
import { ingestSpikeAssets } from "@comfyuiflow/spike-core";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("OpenAI Director adapter", () => {
  it("uses Responses structured output, fixed snapshot, images, and store false", async () => {
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-openai-"));
    const character = join(root, "character.png");
    const scene = join(root, "scene.png");
    await writeFile(character, png);
    await writeFile(scene, Buffer.concat([png, Buffer.from([0])]));
    const assets = await ingestSpikeAssets(character, scene, join(root, "data"));
    const output = {
      id: randomUUID(),
      schemaVersion: "1.0.0",
      promptTemplateVersion: "director-one-shot-v1",
      creativeDescription: "walk in",
      startState: "At the doorway",
      action: "Walks into the room",
      endState: "Stops near the table",
      camera: "Medium tracking shot",
      composition: "Character centered",
      continuityRequirements: ["Keep wardrobe stable"],
      durationSeconds: 2,
      directorRunId: randomUUID(),
    };
    const parse = vi.fn().mockResolvedValue({
      id: "resp_test",
      model: "gpt-5.4-2026-03-05",
      output_parsed: output,
      usage: { input_tokens: 10, output_tokens: 20 },
      status: "completed",
    });
    const provider = new OpenAiResponsesProvider({ responses: { parse } } as any);
    const result = await provider.generateStructured({
      taskType: "STORYBOARD_GENERATION",
      modelRef: { providerId: "openai", modelId: "gpt-5.4-2026-03-05" },
      creativeDescription: "walk in",
      imageInputs: assets,
      promptTemplateVersion: "director-one-shot-v1",
      metadata: {},
    });
    expect(result.structuredOutput).toEqual(output);
    expect(parse).toHaveBeenCalledTimes(1);
    const request = parse.mock.calls[0]![0];
    expect(request).toMatchObject({ model: "gpt-5.4-2026-03-05", store: false });
    expect(
      request.input[0].content.filter((item: any) => item.type === "input_image"),
    ).toHaveLength(2);
  });

  it("rejects invalid structured output without a repair or fallback request", async () => {
    const parse = vi.fn().mockResolvedValue({
      id: "resp_invalid",
      model: "gpt-5.4-2026-03-05",
      output_parsed: { invalid: true },
      status: "completed",
    });
    const provider = new OpenAiResponsesProvider({ responses: { parse } } as any);
    await expect(
      provider.generateStructured({
        taskType: "STORYBOARD_GENERATION",
        modelRef: { providerId: "openai", modelId: "gpt-5.4-2026-03-05" },
        creativeDescription: "walk in",
        imageInputs: [] as any,
        promptTemplateVersion: "director-one-shot-v1",
        metadata: {},
      }),
    ).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
