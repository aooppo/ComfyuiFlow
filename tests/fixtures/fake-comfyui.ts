import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeComfyUiOptions {
  nodeClasses?: string[];
  models?: Record<string, string[]>;
  promptStatus?: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  artifactBytes?: Buffer;
  rejectPrompt?: boolean;
}

export interface FakeComfyUi {
  baseUrl: string;
  counts: Record<string, number>;
  close(): Promise<void>;
}

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

export async function createFakeComfyUi(options: FakeComfyUiOptions = {}): Promise<FakeComfyUi> {
  const counts: Record<string, number> = {};
  const jobs = new Map<string, Record<string, unknown>>();
  const nodeClasses = options.nodeClasses ?? ["LoadImage", "Text", "SaveVideo"];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const key = `${request.method} ${url.pathname}`;
    counts[key] = (counts[key] ?? 0) + 1;

    if (request.method === "GET" && url.pathname === "/system_stats") {
      json(response, 200, { system: { comfyui_version: "0.33.2" }, devices: [] });
      return;
    }
    if (request.method === "GET" && url.pathname === "/object_info") {
      json(
        response,
        200,
        Object.fromEntries(nodeClasses.map((name) => [name, { name, input: {}, output: [] }])),
      );
      return;
    }
    const modelMatch = url.pathname.match(/^\/models\/([^/]+)$/);
    if (request.method === "GET" && modelMatch) {
      json(response, 200, options.models?.[modelMatch[1]!] ?? []);
      return;
    }
    if (request.method === "GET" && url.pathname === "/queue") {
      json(response, 200, { queue_running: [], queue_pending: [] });
      return;
    }
    if (request.method === "POST" && url.pathname === "/upload/image") {
      await bodyOf(request);
      json(response, 200, { name: "staged.png", subfolder: "comfyuiflow", type: "input" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/prompt") {
      const body = JSON.parse((await bodyOf(request)).toString("utf8")) as Record<string, unknown>;
      if (options.rejectPrompt) {
        json(response, 400, { error: { type: "invalid_prompt", message: "rejected" } });
        return;
      }
      const promptId = String(body.prompt_id);
      const state = options.promptStatus ?? "completed";
      const job = {
        id: promptId,
        status: state,
        create_time: 1,
        execution_start_time: 2,
        execution_end_time: 3,
        outputs_count: state === "completed" ? 1 : 0,
        outputs:
          state === "completed"
            ? {
                "4": {
                  video: [
                    {
                      filename: "shot.mp4",
                      subfolder: "comfyuiflow",
                      type: "output",
                      format: "video/mp4",
                    },
                  ],
                },
              }
            : {},
        execution_error: state === "failed" ? { message: "failed" } : undefined,
      };
      jobs.set(promptId, job);
      json(response, 200, { prompt_id: promptId, number: 1, node_errors: {} });
      return;
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]!);
      if (!job) json(response, 404, { error: "Job not found" });
      else json(response, 200, job);
      return;
    }
    const cancelMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (request.method === "POST" && cancelMatch) {
      const job = jobs.get(cancelMatch[1]!);
      if (job) job.status = "cancelled";
      json(response, 200, { cancelled: Boolean(job) });
      return;
    }
    if (request.method === "GET" && url.pathname === "/view") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.end(options.artifactBytes ?? Buffer.from("fake-video"));
      return;
    }
    json(response, 404, { error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    counts,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
