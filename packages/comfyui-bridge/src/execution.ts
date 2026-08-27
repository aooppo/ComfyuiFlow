import { relative } from "node:path";
import { realpath } from "node:fs/promises";
import { hashCanonical, sha256File } from "@comfyuiflow/spike-core";
import {
  ComfyUiHttpError,
  type ComfyUiClient,
  type StagedInput,
  type SubmitResult,
} from "./comfyui-client.js";

export class AmbiguousSubmissionError extends Error {
  constructor(readonly taskId: string) {
    super(`ComfyUI submission outcome is ambiguous for task ${taskId}`);
  }
}

export interface FrozenStagedInput extends StagedInput {
  sourceSha256: string;
}

/** The generic MCP-side executor. It accepts only a server-loaded immutable graph and frozen
 * input facts; callers cannot choose an implementation, alter a graph, or submit while LIVE is off. */
export class ComfyUiFrozenExecutor {
  constructor(
    private readonly dependencies: {
      client: ComfyUiClient;
      liveEnabled: boolean;
      allowedInputRoots: string[];
    },
  ) {}

  assertLiveEnabled() {
    if (!this.dependencies.liveEnabled) throw new Error("COMFYUI_LIVE_DISABLED");
  }

  async stageFrozenInput(input: { localPath: string; sha256: string; stagedInputName: string }) {
    const localPath = await realpath(input.localPath);
    const roots = await Promise.all(
      this.dependencies.allowedInputRoots.map((root) => realpath(root)),
    );
    if (
      !roots.some((root) => {
        const traversal = relative(root, localPath);
        return traversal === "" || (!traversal.startsWith("..") && !traversal.includes("/.."));
      })
    )
      throw new Error("FROZEN_INPUT_OUTSIDE_STORAGE_ROOT");
    if ((await sha256File(localPath)) !== input.sha256)
      throw new Error("FROZEN_INPUT_HASH_MISMATCH");
    const staged = await this.dependencies.client.stageInput(localPath);
    const stagedName = staged.subfolder ? `${staged.subfolder}/${staged.name}` : staged.name;
    if (stagedName !== input.stagedInputName) throw new Error("FROZEN_STAGED_INPUT_NAME_MISMATCH");
    return { ...staged, sourceSha256: input.sha256 } satisfies FrozenStagedInput;
  }

  async submitFrozenGraph(input: {
    promptId: string;
    materializedGraph: Readonly<Record<string, unknown>>;
    materializedGraphSha256: string;
  }): Promise<SubmitResult> {
    this.assertLiveEnabled();
    if (hashCanonical(input.materializedGraph) !== input.materializedGraphSha256)
      throw new Error("FROZEN_GRAPH_DIGEST_MISMATCH");
    try {
      const result = await this.dependencies.client.submitWorkflow(
        input.promptId,
        input.materializedGraph,
      );
      if (result.promptId !== input.promptId) throw new Error("FROZEN_TASK_ID_MISMATCH");
      return result;
    } catch (error) {
      if (error instanceof ComfyUiHttpError && error.classification === "TRANSPORT")
        throw new AmbiguousSubmissionError(input.promptId);
      throw error;
    }
  }

  status(taskId: string) {
    return this.dependencies.client.getJobStatus(taskId);
  }

  async retain(taskId: string) {
    return (await this.dependencies.client.getJobStatus(taskId)).artifacts;
  }
}
