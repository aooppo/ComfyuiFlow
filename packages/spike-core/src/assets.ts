import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { InputAssetSchema, type InputAsset } from "@comfyuiflow/contracts";
import { sha256File } from "./integrity.js";

function detectImageMime(bytes: Buffer): "image/png" | "image/jpeg" | "image/webp" {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  throw new Error("Unsupported or invalid image input");
}

export async function ingestAsset(
  originalPath: string,
  role: InputAsset["role"],
  dataRoot: string,
): Promise<InputAsset> {
  const absolute = resolve(originalPath);
  const facts = await stat(absolute);
  if (!facts.isFile() || facts.size <= 0) throw new Error(`${role} input must be a non-empty file`);
  const header = (await readFile(absolute)).subarray(0, 16);
  const mimeType = detectImageMime(header);
  const sha256 = await sha256File(absolute);
  const extension = extname(absolute).toLowerCase() || `.${mimeType.split("/")[1]}`;
  const directory = join(dataRoot, "inputs");
  const storedPath = join(directory, `${sha256}${extension}`);
  await mkdir(directory, { recursive: true });
  try {
    await copyFile(absolute, storedPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return InputAssetSchema.parse({
    id: randomUUID(),
    role,
    originalPath: absolute,
    storedPath,
    originalFilename: basename(absolute),
    mimeType,
    byteSize: facts.size,
    sha256,
  });
}

export async function ingestSpikeAssets(
  characterImage: string,
  sceneImage: string,
  dataRoot: string,
  additionalReferenceImages: Array<{
    role: "PRODUCT" | "CHARACTER_FACE" | "CHARACTER_REAR";
    image: string;
  }> = [],
): Promise<InputAsset[]> {
  return Promise.all([
    ingestAsset(characterImage, "CHARACTER", dataRoot),
    ingestAsset(sceneImage, "SCENE", dataRoot),
    ...additionalReferenceImages.map((item) => ingestAsset(item.image, item.role, dataRoot)),
  ]);
}
