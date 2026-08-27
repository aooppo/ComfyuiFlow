import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { sha256Bytes } from "@comfyuiflow/spike-core";

const historicalGraph = "tests/fixtures/generation/historical-h3-project-shot-4s.api.json";
const historicalSha256 = "6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a";

describe("historical fixed-H3 evidence", () => {
  it("preserves the original graph bytes and SHA only as a fixture", async () => {
    const bytes = await readFile(historicalGraph);
    expect(bytes.byteLength).toBe(1326);
    expect(sha256Bytes(bytes)).toBe(historicalSha256);
  });
});
