import { randomUUID } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hashCanonical } from "./integrity.js";

export interface EvidenceEvent {
  schemaVersion: "1.0.0";
  id: string;
  stream: string;
  eventType: string;
  createdAt: string;
  payload: unknown;
  previousEventHash: string | null;
  eventHash: string;
}

export class EvidenceStore {
  constructor(readonly root: string) {}

  private pathFor(stream: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(stream)) throw new Error("Invalid evidence stream name");
    return join(this.root, "events", `${stream}.jsonl`);
  }

  async read(stream: string): Promise<EvidenceEvent[]> {
    try {
      const text = await readFile(this.pathFor(stream), "utf8");
      if (!text.trim()) return [];
      return text
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as EvidenceEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async append(stream: string, eventType: string, payload: unknown): Promise<EvidenceEvent> {
    const path = this.pathFor(stream);
    const prior = await this.read(stream);
    const previousEventHash = prior.at(-1)?.eventHash ?? null;
    const core = {
      schemaVersion: "1.0.0" as const,
      id: randomUUID(),
      stream,
      eventType,
      createdAt: new Date().toISOString(),
      payload,
      previousEventHash,
    };
    const event: EvidenceEvent = { ...core, eventHash: hashCanonical(core) };
    await mkdir(dirname(path), { recursive: true });
    const handle = await open(path, "a", 0o600);
    try {
      await handle.appendFile(`${JSON.stringify(event)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return event;
  }

  verify(events: EvidenceEvent[]): boolean {
    let prior: string | null = null;
    for (const event of events) {
      const { eventHash, ...core } = event;
      if (core.previousEventHash !== prior || hashCanonical(core) !== eventHash) return false;
      prior = eventHash;
    }
    return true;
  }
}
