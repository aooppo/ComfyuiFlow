import { createHash, randomUUID } from "node:crypto";
import { createReadStream, constants as fsConstants, existsSync } from "node:fs";
import { link, lstat, mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";
import { ProjectAssetError } from "./contracts.js";

const defaultMaxBytes = 250 * 1024 * 1024;
const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/ogg",
]);

export interface PreservedObject {
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
  storageKey: string;
  absolutePath: string;
  alreadyExisted: boolean;
}

export interface StorageProvider {
  preserve(stream: AsyncIterable<Uint8Array>): Promise<PreservedObject>;
  resolveVerified(storageKey: string, sha256: string, byteSize: number): Promise<string>;
}

export function sanitizeFilename(value: string): string {
  const safe = [...path.basename(value)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
  return (!safe || safe === "." || safe === ".." ? "unnamed-asset" : safe).slice(0, 255);
}

export function resolveStorageRoot(
  configuredPath: string,
  startDirectory: string = process.cwd(),
): string {
  if (path.isAbsolute(configuredPath)) return path.normalize(configuredPath);

  let workspaceRoot = path.resolve(startDirectory);
  while (!existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(workspaceRoot);
    if (parent === workspaceRoot) {
      workspaceRoot = path.resolve(startDirectory);
      break;
    }
    workspaceRoot = parent;
  }
  return path.resolve(workspaceRoot, configuredPath);
}

export class LocalContentStorage implements StorageProvider {
  readonly root: string;
  readonly maxBytes: number;

  constructor(options?: { root?: string; maxBytes?: number }) {
    this.root = resolveStorageRoot(
      options?.root ?? process.env.PROJECT_ASSET_STORAGE_DIR ?? "var/project-assets",
    );
    this.maxBytes =
      options?.maxBytes ?? Number(process.env.PROJECT_ASSET_MAX_BYTES || defaultMaxBytes);
  }

  async preserve(stream: AsyncIterable<Uint8Array>): Promise<PreservedObject> {
    const temporaryRoot = path.join(this.root, ".tmp");
    await mkdir(temporaryRoot, { recursive: true });
    const temporaryPath = path.join(temporaryRoot, `${randomUUID()}.upload`);
    const handle = await open(
      temporaryPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    );
    const hash = createHash("sha256");
    let byteSize = 0;
    try {
      for await (const value of stream) {
        const chunk = Buffer.from(value);
        byteSize += chunk.byteLength;
        if (byteSize > this.maxBytes) {
          throw new ProjectAssetError(
            "FILE_TOO_LARGE",
            `File exceeds the ${this.maxBytes} byte limit`,
            413,
          );
        }
        hash.update(chunk);
        await handle.write(chunk);
      }
      if (byteSize === 0) {
        throw new ProjectAssetError("EMPTY_FILE", "The selected file is empty");
      }
      await handle.sync();
      await handle.close();

      const detected = await fileTypeFromFile(temporaryPath);
      if (!detected || !supportedMimeTypes.has(detected.mime)) {
        throw new ProjectAssetError(
          "UNSUPPORTED_MEDIA",
          "The selected file is not a supported image, video, or audio file",
        );
      }

      const sha256 = hash.digest("hex");
      const storageKey = path.posix.join("sha256", sha256.slice(0, 2), sha256);
      const finalPath = this.resolveKey(storageKey);
      await mkdir(path.dirname(finalPath), { recursive: true });
      let alreadyExisted = false;
      try {
        await link(temporaryPath, finalPath);
        await unlink(temporaryPath);
      } catch (error) {
        const existing = await stat(finalPath).catch(() => null);
        if (!existing?.isFile() || existing.size !== byteSize) throw error;
        const existingHash = await hashFile(finalPath);
        if (existingHash !== sha256) {
          throw new ProjectAssetError(
            "STORAGE_COLLISION",
            "Stored content does not match its content address",
            500,
          );
        }
        alreadyExisted = true;
        await unlink(temporaryPath).catch(() => undefined);
      }
      await stat(finalPath).then((value) => {
        if (!value.isFile() || value.size !== byteSize) {
          throw new ProjectAssetError(
            "STORAGE_VERIFY_FAILED",
            "Stored content could not be verified",
            500,
          );
        }
      });
      return {
        sha256,
        byteSize,
        detectedMimeType: detected.mime,
        storageKey,
        absolutePath: finalPath,
        alreadyExisted,
      };
    } catch (error) {
      await handle.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async resolveVerified(storageKey: string, sha256: string, byteSize: number): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new ProjectAssetError("STORAGE_KEY_INVALID", "Stored object identity is invalid", 500);
    }
    const expected = path.posix.join("sha256", sha256.slice(0, 2), sha256);
    if (storageKey !== expected) {
      throw new ProjectAssetError("STORAGE_KEY_INVALID", "Stored object location is invalid", 500);
    }
    const resolved = this.resolveKey(storageKey);
    const facts = await lstat(resolved).catch(() => null);
    if (!facts?.isFile() || facts.isSymbolicLink() || facts.size !== byteSize) {
      throw new ProjectAssetError(
        "STORAGE_VERIFY_FAILED",
        "Stored content is unavailable or changed",
        500,
      );
    }
    if ((await hashFile(resolved)) !== sha256) {
      throw new ProjectAssetError(
        "STORAGE_VERIFY_FAILED",
        "Stored content is unavailable or changed",
        500,
      );
    }
    return resolved;
  }

  createReadStream(absolutePath: string) {
    return createReadStream(absolutePath);
  }

  private resolveKey(storageKey: string): string {
    const resolved = path.resolve(this.root, storageKey);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new ProjectAssetError("STORAGE_KEY_INVALID", "Stored object location is invalid", 500);
    }
    return resolved;
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
