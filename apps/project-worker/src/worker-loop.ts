export interface WorkerLoopOptions {
  once: boolean;
  pollIntervalMs: number;
  shouldStop: () => boolean;
  runAnalysis: () => Promise<unknown | null>;
  runGeneration: () => Promise<unknown | null>;
  runDirector: () => Promise<unknown | null>;
  onResult: (
    operation: "asset_understanding_worker" | "generation_worker" | "storyboard_director_worker",
    result: any,
  ) => void;
  onError: (error: unknown) => void;
  wait?: (milliseconds: number) => Promise<void>;
}

export function workerPollInterval(value: string | undefined): number {
  const parsed = Number(value ?? 1_000);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 250), 60_000) : 1_000;
}

export async function runWorkerLoop(options: WorkerLoopOptions) {
  const wait =
    options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  do {
    try {
      const analysis = await options.runAnalysis();
      if (analysis) options.onResult("asset_understanding_worker", analysis);
      const generation = await options.runGeneration();
      if (generation) options.onResult("generation_worker", generation);
      const director = await options.runDirector();
      if (director) options.onResult("storyboard_director_worker", director);
    } catch (error) {
      options.onError(error);
    }
    if (options.once || options.shouldStop()) return;
    await wait(options.pollIntervalMs);
  } while (!options.shouldStop());
}
