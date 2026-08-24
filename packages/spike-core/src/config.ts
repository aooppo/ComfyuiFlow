import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

const EnvironmentSchema = z.object({
  COMFYUI_BASE_URL: z.string().url().default("http://127.0.0.1:8188"),
  COMFYUI_LIVE_ENABLED: z.string().optional(),
  CODEX_MANAGER_LIVE_ENABLED: z.string().optional(),
  OPENAI_LIVE_ENABLED: z.string().optional(),
  SPIKE_DATA_DIR: z.string().default("./var/spike"),
  WORKFLOW_REGISTRY_PATH: z.string().default("./workflows/registry.json"),
  OPENAI_API_KEY: z.string().optional(),
  CODEX_MANAGER_API_KEY: z.string().optional(),
  COMFYUI_API_KEY: z.string().optional(),
  COMFY_API_KEY: z.string().optional(),
  COMFYUI_AUTH_TOKEN: z.string().optional(),
});

export interface RuntimeConfig {
  comfyuiBaseUrl: string;
  comfyuiLiveEnabled: boolean;
  codexManagerBaseUrl: "http://127.0.0.1:48760/v1";
  codexManagerLiveEnabled: boolean;
  codexManagerConfigured: boolean;
  comfyOrgApiKey?: string;
  comfyOrgAuthToken?: string;
  comfyOrgCredentialConfigured: boolean;
  openaiLiveEnabled: boolean;
  spikeDataDir: string;
  workflowRegistryPath: string;
  openaiConfigured: boolean;
}

export function assertLocalHttpEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:") throw new Error("ComfyUI endpoint must use http");
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("ComfyUI endpoint must be loopback-local");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

export function loadProjectEnvFile(cwd = process.cwd()): boolean {
  try {
    loadEnvFile(resolve(cwd, ".env"));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): RuntimeConfig {
  const parsed = EnvironmentSchema.parse(environment);
  const comfyOrgApiKey = parsed.COMFYUI_API_KEY ?? parsed.COMFY_API_KEY;
  return {
    comfyuiBaseUrl: assertLocalHttpEndpoint(parsed.COMFYUI_BASE_URL),
    comfyuiLiveEnabled: parsed.COMFYUI_LIVE_ENABLED === "1",
    codexManagerBaseUrl: "http://127.0.0.1:48760/v1",
    codexManagerLiveEnabled: parsed.CODEX_MANAGER_LIVE_ENABLED === "1",
    codexManagerConfigured: Boolean(parsed.CODEX_MANAGER_API_KEY),
    ...(comfyOrgApiKey ? { comfyOrgApiKey } : {}),
    ...(parsed.COMFYUI_AUTH_TOKEN ? { comfyOrgAuthToken: parsed.COMFYUI_AUTH_TOKEN } : {}),
    comfyOrgCredentialConfigured: Boolean(comfyOrgApiKey || parsed.COMFYUI_AUTH_TOKEN),
    openaiLiveEnabled: parsed.OPENAI_LIVE_ENABLED === "1",
    spikeDataDir: resolve(cwd, parsed.SPIKE_DATA_DIR),
    workflowRegistryPath: resolve(cwd, parsed.WORKFLOW_REGISTRY_PATH),
    openaiConfigured: Boolean(parsed.OPENAI_API_KEY),
  };
}

const secretPatterns = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{12,}/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[^\s"']{12,}/gi,
];

const secretKeyPattern = /^(?:.*_)?(?:api_?key|authorization|credential|secret)$/i;

export function redactSecrets(value: unknown, additionalSecrets: string[] = []): unknown {
  if (typeof value === "string") {
    let redacted = value;
    for (const secret of additionalSecrets.filter((item) => item.length >= 8)) {
      redacted = redacted.replaceAll(secret, "[REDACTED_SECRET]");
    }
    for (const pattern of secretPatterns) {
      redacted = redacted.replace(pattern, (_match, prefix?: string) =>
        prefix ? `${prefix}[REDACTED_SECRET]` : "[REDACTED_SECRET]",
      );
    }
    return redacted;
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, additionalSecrets));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        secretKeyPattern.test(key) && typeof item === "string"
          ? "[REDACTED_SECRET]"
          : redactSecrets(item, additionalSecrets),
      ]),
    );
  }
  return value;
}
