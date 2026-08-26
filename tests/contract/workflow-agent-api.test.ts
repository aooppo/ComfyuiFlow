import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  WorkflowPlanningPreferencesUpdateSchema,
  WorkflowPlanningRequestSchema,
} from "@comfyuiflow/contracts";
import { apiError } from "../../apps/project-web/lib/api.js";

describe("Workflow Agent planning API", () => {
  it("keeps planning payloads strict and rejects duplicate Shot preferences", () => {
    const shotKey = "00000000-0000-4000-8000-000000000001";
    expect(() =>
      WorkflowPlanningRequestSchema.parse({
        schemaVersion: "workflow-planning-request-v1",
        shotPreferences: [],
        unsafeEndpoint: "https://private",
      }),
    ).toThrow();
    expect(() =>
      WorkflowPlanningRequestSchema.parse({
        schemaVersion: "workflow-planning-request-v1",
        shotPreferences: [
          { shotKey, modelSelection: { mode: "AUTO" } },
          { shotKey, modelSelection: { mode: "AUTO" } },
        ],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      WorkflowPlanningPreferencesUpdateSchema.parse({
        schemaVersion: "workflow-planning-preferences-update-v1",
        parentVersionId: shotKey,
        currentPreferenceHash: null,
        shotPreferences: [],
        rawGraph: {},
      }),
    ).toThrow();
  });

  it("uses thin no-store routes and never authorizes generation", async () => {
    const [planningRoute, preferenceRoute, service] = await Promise.all([
      readFile(
        "apps/project-web/app/api/generation-plan-versions/[versionId]/workflow-plans/route.ts",
        "utf8",
      ),
      readFile(
        "apps/project-web/app/api/generation-plans/[planId]/planning-preferences/route.ts",
        "utf8",
      ),
      readFile(
        "packages/project-core/src/workflow-agent/workflow-planning-application-service.ts",
        "utf8",
      ),
    ]);
    expect(planningRoute).toContain('"Cache-Control": "no-store"');
    expect(preferenceRoute).toContain('"Cache-Control": "no-store"');
    expect(preferenceRoute).toContain("requiredGenerationPlanRowVersion(request)");
    expect(preferenceRoute).toContain('request.headers.get("idempotency-key")');
    expect(service).toContain("externalCalls: 0 as const");
    expect(service).toContain("generationAuthorized: false as const");
    expect(service).not.toContain(".submit(");
  });

  it("maps unexpected internal details to a safe error", async () => {
    const response = apiError(new Error("/private/graph.json Authorization: Bearer secret"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed" },
    });
  });
});
