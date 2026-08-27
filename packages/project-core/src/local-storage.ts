import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";

export interface StorageProvider {
  resolveVerified(storageKey: string, sha256: string, byteSize: number): Promise<string>;
}

export function resolveStorageRoot(configuredPath: string, startDirectory = process.cwd()): string {
  if (path.isAbsolute(configuredPath)) return path.normalize(configuredPath);
  let root = path.resolve(startDirectory);
  while (!existsSync(path.join(root, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(root);
    if (parent === root) break;
    root = parent;
  }
  return path.resolve(root, configuredPath);
}

export class LocalContentStorage implements StorageProvider {
  readonly root: string;

  constructor(options: { root: string }) {
    this.root = resolveStorageRoot(options.root);
  }

  async resolveVerified(storageKey: string, sha256: string, byteSize: number): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("STORAGE_KEY_INVALID");
    const expected = path.posix.join("sha256", sha256.slice(0, 2), sha256);
    if (storageKey !== expected) throw new Error("STORAGE_KEY_INVALID");
    const absolutePath = path.resolve(this.root, storageKey);
    if (!absolutePath.startsWith(`${this.root}${path.sep}`)) throw new Error("STORAGE_KEY_INVALID");
    const facts = await lstat(absolutePath).catch(() => null);
    if (!facts?.isFile() || facts.isSymbolicLink() || facts.size !== byteSize)
      throw new Error("STORAGE_VERIFY_FAILED");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(absolutePath)) hash.update(chunk);
    if (hash.digest("hex") !== sha256) throw new Error("STORAGE_VERIFY_FAILED");
    return absolutePath;
  }
}
