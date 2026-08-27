import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}
export function hashCanonical(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalize(value)))
    .digest("hex");
}
export function sha256Bytes(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
export async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export function loadProjectEnvFile(root = process.cwd()) {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    const key = match?.[1];
    const value = match?.[2];
    if (key && value !== undefined && !process.env[key])
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
  }
}
export function loadRuntimeConfig() {
  return {
    comfyuiBaseUrl: process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188",
    comfyuiLiveEnabled: process.env.COMFYUI_LIVE_ENABLED === "true",
    comfyOrgApiKey: process.env.COMFYUI_API_KEY,
    comfyOrgAuthToken: process.env.COMFYUI_AUTH_TOKEN,
    spikeDataDir: process.env.SPIKE_DATA_DIR ?? "var/spike",
  };
}
