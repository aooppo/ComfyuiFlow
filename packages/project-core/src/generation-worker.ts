import type { AdapterRegistry, FrozenGenerationAttemptInput } from "./capability-adapter.js";

export interface GenerationAttemptWork extends FrozenGenerationAttemptInput {
  state: "QUEUED" | "SUBMITTED" | "RECONCILING";
  taskId?: string;
}

/** Persistence methods are deliberately compare-and-set operations. An implementation must make
 * `claimNext` and `consumeBeforeSubmit` transactional so a restart or competing Worker cannot
 * create another external submission. */
export interface GenerationWorkStore {
  claimReconciliation(): Promise<GenerationAttemptWork | null>;
  claimNext(): Promise<GenerationAttemptWork | null>;
  consumeBeforeSubmit(attemptId: string): Promise<boolean>;
  markSubmitted(attemptId: string, taskId: string): Promise<void>;
  markTerminal(attemptId: string, code: string): Promise<void>;
  markReconciled(attemptId: string, state: string): Promise<void>;
}

/** The sole generation Worker. It submits only an immutable, fully resolved attempt and never
 * selects a provider, compiler, runtime, graph, or alternate submission. */
export class GenerationWorker {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly store: GenerationWorkStore,
  ) {}

  async runOnce() {
    const reconciling = await this.store.claimReconciliation();
    if (reconciling) return this.reconcile(reconciling);
    const attempt = await this.store.claimNext();
    if (!attempt) return null;
    const consumed = await this.store.consumeBeforeSubmit(attempt.attemptId);
    if (!consumed) {
      await this.store.markTerminal(attempt.attemptId, "AUTHORIZATION_CONSUMPTION_REJECTED");
      return { attemptId: attempt.attemptId, state: "CONSUMPTION_REJECTED" as const };
    }
    try {
      const task = await this.adapters.resolve(attempt).submit(attempt);
      await this.store.markSubmitted(attempt.attemptId, task.taskId);
      return { attemptId: attempt.attemptId, state: "SUBMITTED" as const, taskId: task.taskId };
    } catch {
      await this.store.markTerminal(attempt.attemptId, "SUBMISSION_AMBIGUOUS");
      return { attemptId: attempt.attemptId, state: "AMBIGUOUS" as const };
    }
  }

  private async reconcile(attempt: GenerationAttemptWork) {
    if (!attempt.taskId) {
      await this.store.markTerminal(attempt.attemptId, "RECONCILIATION_TASK_ID_MISSING");
      return { attemptId: attempt.attemptId, state: "AMBIGUOUS" as const };
    }
    try {
      const state = await this.adapters
        .resolve(attempt)
        .reconcile({ ...attempt, taskId: attempt.taskId });
      if (state === "UNKNOWN") {
        await this.store.markTerminal(attempt.attemptId, "RECONCILIATION_AMBIGUOUS");
        return { attemptId: attempt.attemptId, state: "AMBIGUOUS" as const };
      }
      await this.store.markReconciled(attempt.attemptId, state);
      return { attemptId: attempt.attemptId, state: "RECONCILED" as const, remoteState: state };
    } catch {
      await this.store.markTerminal(attempt.attemptId, "RECONCILIATION_AMBIGUOUS");
      return { attemptId: attempt.attemptId, state: "AMBIGUOUS" as const };
    }
  }
}
