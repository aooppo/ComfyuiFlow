import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("generation mainline execution boundary", () => {
  it("consumes authorization before the only submission and terminalizes ambiguity", async () => {
    const source = await readFile("packages/project-core/src/generation-worker.ts", "utf8");
    const consumed = source.indexOf("consumeBeforeSubmit");
    const submit = source.indexOf(".submit(attempt)");
    expect(consumed).toBeGreaterThan(0);
    expect(submit).toBeGreaterThan(consumed);
    expect(source).toContain('markTerminal(attempt.attemptId, "SUBMISSION_AMBIGUOUS")');
    expect(source).toContain('markTerminal(attempt.attemptId, "RECONCILIATION_AMBIGUOUS")');
    expect(source).not.toMatch(/fallback|retry|GenerationProvider|workflowId/);
  });

  it("uses append-only attempt events for every externally relevant transition", async () => {
    const source = await readFile("packages/project-core/src/generation-mainline-store.ts", "utf8");
    expect(source).toContain('INSERT INTO "AuthorizationConsumption"');
    expect(source).toContain('INSERT INTO "GenerationAttemptEvent"');
    expect(source).toContain("FOR UPDATE OF a SKIP LOCKED");
    expect(source).not.toMatch(/UPDATE\s+"GenerationAttempt"|DELETE\s+FROM\s+"GenerationAttempt"/);
  });
});
