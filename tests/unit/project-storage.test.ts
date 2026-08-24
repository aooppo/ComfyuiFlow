import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LocalContentStorage,
  ProjectAssetError,
  operationLog,
  sanitizeFilename,
} from "@comfyuiflow/project-core";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function* chunks(value: Buffer) {
  const midpoint = Math.ceil(value.length / 2);
  yield value.subarray(0, midpoint);
  yield value.subarray(midpoint);
}

describe("LocalContentStorage", () => {
  it("preserves verified immutable content by SHA-256 without overwriting duplicates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comfyuiflow-storage-"));
    const storage = new LocalContentStorage({ root, maxBytes: 10_000 });
    const expected = createHash("sha256").update(png).digest("hex");

    const first = await storage.preserve(chunks(png));
    const second = await storage.preserve(chunks(png));

    expect(first.sha256).toBe(expected);
    expect(first.storageKey).toBe(`sha256/${expected.slice(0, 2)}/${expected}`);
    expect(second.alreadyExisted).toBe(true);
    expect(await readFile(first.absolutePath)).toEqual(png);
    expect(await storage.resolveVerified(first.storageKey, expected, png.length)).toBe(
      first.absolutePath,
    );
  });

  it("rejects empty, unsupported, oversized, and escaped content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comfyuiflow-storage-"));
    const storage = new LocalContentStorage({ root, maxBytes: png.length - 1 });

    await expect(storage.preserve(chunks(Buffer.alloc(0)))).rejects.toMatchObject({
      code: "EMPTY_FILE",
    });
    await expect(storage.preserve(chunks(Buffer.from("plain text")))).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA",
    });
    await expect(storage.preserve(chunks(png))).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    await expect(storage.resolveVerified("../../escape", "a".repeat(64), 1)).rejects.toBeInstanceOf(
      ProjectAssetError,
    );
  });

  it("rejects a same-size stored object whose bytes no longer match its fingerprint", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comfyuiflow-storage-"));
    const storage = new LocalContentStorage({ root, maxBytes: 10_000 });
    const preserved = await storage.preserve(chunks(png));
    await writeFile(preserved.absolutePath, Buffer.alloc(png.length, 1));

    await expect(
      storage.resolveVerified(preserved.storageKey, preserved.sha256, preserved.byteSize),
    ).rejects.toMatchObject({ code: "STORAGE_VERIFY_FAILED" });
  });

  it("normalizes untrusted display filenames without returning a path", () => {
    expect(sanitizeFilename("../../dangerous\u0000name.png")).toBe("dangerousname.png");
    expect(sanitizeFilename("../")).toBe("unnamed-asset");
  });

  it("logs only the structured allowlist and cannot include source text or paths", () => {
    const lines: string[] = [];
    operationLog(
      { operation: "asset_import", result: "IMPORTED", projectId: "project-1", byteSize: 42 },
      (line) => lines.push(line),
    );
    expect(JSON.parse(lines[0]!)).toEqual({
      operation: "asset_import",
      result: "IMPORTED",
      projectId: "project-1",
      byteSize: 42,
    });
    expect(lines[0]).not.toContain("storage");
  });
});
