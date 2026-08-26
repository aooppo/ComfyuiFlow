import type { ChildProcess } from "node:child_process";

export interface OwnedProcess {
  child: ChildProcess;
  marker: {
    ownerPid: number;
    childPid: number | undefined;
    cwd: string;
    startedAt: string;
    ownershipToken: string;
  };
}

export function assertLoopbackUrl(value: string, label?: string): URL;
export function redactSecrets(
  value: unknown,
  environment?: Record<string, string | undefined>,
): string;
export function assertNoInstallCommand(command: string, args?: readonly string[]): void;
export function createOwnedProcess(
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; stdio?: "inherit" },
  ownership: string,
): OwnedProcess;
export function stopOwnedProcess(
  owned: {
    child: { kill(signal?: NodeJS.Signals): boolean };
    marker: { ownerPid: number; ownershipToken: string };
  },
  ownership: string,
  signal?: NodeJS.Signals,
): boolean;
export function runProjectDevSupervisor(input: {
  workspaceRoot: string;
  environment?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
}): Promise<{ ownership: string; owned: OwnedProcess[]; stop(signal?: NodeJS.Signals): void }>;
