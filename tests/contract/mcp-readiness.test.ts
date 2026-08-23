import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createComfyUiMcpServer } from "../../apps/comfyui-mcp/src/server.js";
import { ComfyUiClient, WorkflowRegistry } from "@comfyuiflow/comfyui-bridge";
import { sha256Bytes } from "@comfyuiflow/spike-core";
import { createFakeComfyUi, type FakeComfyUi } from "../fixtures/fake-comfyui.js";

const openServers: FakeComfyUi[] = [];
afterEach(async () => Promise.all(openServers.splice(0).map((server) => server.close())));

describe("MCP readiness tools", () => {
  it("lists the narrow tool surface and returns structured readiness", async () => {
    const fake = await createFakeComfyUi();
    openServers.push(fake);
    const root = await mkdtemp(join(tmpdir(), "comfyuiflow-mcp-"));
    const bytes = await readFile(join(process.cwd(), "tests/fixtures/workflows/ready.api.json"));
    await writeFile(join(root, "ready.api.json"), bytes);
    await writeFile(
      join(root, "registry.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        workflows: [
          {
            workflowId: "ready-video",
            version: "1",
            displayName: "Ready video",
            enabled: true,
            apiWorkflowPath: "ready.api.json",
            sha256: sha256Bytes(bytes),
            requiredNodeClasses: ["LoadImage", "Text", "SaveVideo"],
            requiredModels: [],
            constraints: {
              durationSeconds: { min: 1, max: 5, default: 2 },
              width: 512,
              height: 512,
              fps: 24,
              outputMediaType: "video",
            },
            bindings: {
              character: { pointer: "/1/inputs/image" },
              scene: { pointer: "/2/inputs/image" },
              positivePrompt: { pointer: "/3/inputs/text" },
            },
            output: { nodeId: "4", mediaKey: "video" },
          },
        ],
      }),
    );
    const server = createComfyUiMcpServer({
      client: new ComfyUiClient(fake.baseUrl),
      registry: new WorkflowRegistry(join(root, "registry.json")),
      liveEnabled: false,
      dataRoot: root,
    });
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "comfyui_list_workflows",
        "comfyui_check_readiness",
        "comfyui_get_queue",
      ]),
    );
    const result = await client.callTool({
      name: "comfyui_check_readiness",
      arguments: { workflowId: "ready-video" },
    });
    expect(result.structuredContent).toMatchObject({ ready: true, generationCalls: 0 });
    expect(fake.counts["POST /prompt"] ?? 0).toBe(0);
    await client.close();
    await server.close();
  });
});
