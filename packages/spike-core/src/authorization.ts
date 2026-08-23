import { randomUUID } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AuthorizationConsumptionSchema,
  AuthorizationGrantSchema,
  type AuthorizationConsumption,
  type AuthorizationGrant,
  type AuthorizationOperation,
} from "@comfyuiflow/contracts";
import { EvidenceStore } from "./evidence-store.js";

export interface CreateGrantInput {
  operation: AuthorizationOperation;
  scopeHash: string;
  expiresAt: string;
}

export interface ConsumeGrantInput {
  grantId: string;
  runId: string;
  operation: AuthorizationOperation;
  scopeHash: string;
  requestHash: string;
}

async function writeExclusive(path: string, value: unknown): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export class AuthorizationService {
  private readonly evidence: EvidenceStore;

  constructor(readonly root: string) {
    this.evidence = new EvidenceStore(root);
  }

  async createGrant(input: CreateGrantInput): Promise<AuthorizationGrant> {
    const grant = AuthorizationGrantSchema.parse({
      schemaVersion: "1.0.0",
      id: randomUUID(),
      operation: input.operation,
      scopeHash: input.scopeHash,
      maxCalls: 1,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    });
    if (Date.parse(grant.expiresAt) <= Date.now())
      throw new Error("Grant expiry must be in the future");
    const directory = join(this.root, "authorizations", "grants");
    await mkdir(directory, { recursive: true });
    await writeExclusive(join(directory, `${grant.id}.json`), grant);
    await this.evidence.append("authorizations", "GRANT_CREATED", {
      ...grant,
      scopeHash: grant.scopeHash,
    });
    return grant;
  }

  async readGrant(grantId: string): Promise<AuthorizationGrant> {
    const value = JSON.parse(
      await readFile(join(this.root, "authorizations", "grants", `${grantId}.json`), "utf8"),
    );
    return AuthorizationGrantSchema.parse(value);
  }

  async consumeGrant(input: ConsumeGrantInput): Promise<AuthorizationConsumption> {
    const grant = await this.readGrant(input.grantId);
    if (grant.operation !== input.operation) throw new Error("Grant operation mismatch");
    if (grant.scopeHash !== input.scopeHash) throw new Error("Grant scope mismatch");
    if (Date.parse(grant.expiresAt) <= Date.now()) throw new Error("Grant expired");

    const consumption = AuthorizationConsumptionSchema.parse({
      schemaVersion: "1.0.0",
      id: randomUUID(),
      grantId: grant.id,
      runId: input.runId,
      operation: input.operation,
      scopeHash: input.scopeHash,
      requestHash: input.requestHash,
      attemptNumber: 1,
      consumedAt: new Date().toISOString(),
    });
    const directory = join(this.root, "authorizations", "consumptions");
    await mkdir(directory, { recursive: true });
    try {
      await writeExclusive(join(directory, `${grant.id}.json`), consumption);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("Grant already consumed");
      }
      throw error;
    }
    await this.evidence.append("authorizations", "GRANT_CONSUMED", consumption);
    return consumption;
  }
}
