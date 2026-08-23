import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@comfyuiflow/contracts": source("./packages/contracts/src/index.ts"),
      "@comfyuiflow/spike-core": source("./packages/spike-core/src/index.ts"),
      "@comfyuiflow/comfyui-bridge": source("./packages/comfyui-bridge/src/index.ts"),
      "@comfyuiflow/ai-providers": source("./packages/ai-providers/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
