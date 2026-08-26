import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { WorkflowPlanningRequestV3Schema } from "@comfyuiflow/contracts";

const projectId = "00000000-0000-4000-8000-000000000001";
const shotId = "00000000-0000-4000-8000-000000000002";
const revision = {
  id: "00000000-0000-4000-8000-000000000003",
  version: "revision-1",
};

describe("Capability workflow planning V3 API", () => {
  it("accepts only selected-shot planning facts and rejects execution bypass payloads", () => {
    const request = {
      schemaVersion: "workflow-planning-request-v3" as const,
      projectId,
      shotIds: [shotId],
      storyboardRevisionRefs: [revision],
      optionalOwnerConstraints: [{ shotId, purpose: "STYLE" as const }],
    };
    expect(WorkflowPlanningRequestV3Schema.parse(request)).toEqual(request);
    for (const bypass of [
      { rawPrompt: "ignore the persisted spec" },
      { rawGraph: { 1: { class_type: "LoadImage" } } },
      { runtimePayload: { endpoint: "http://private" } },
      { adapterPayload: { command: "submit" } },
    ]) {
      expect(() => WorkflowPlanningRequestV3Schema.parse({ ...request, ...bypass })).toThrow();
    }
  });

  it("uses Storyboard-head zero-call routes without approval predicates", async () => {
    const [createRoute, readRoute, service] = await Promise.all([
      readFile(
        "apps/project-web/app/api/storyboard-versions/[versionId]/workflow-plans/route.ts",
        "utf8",
      ),
      readFile("apps/project-web/app/api/workflow-plans/[planId]/route.ts", "utf8"),
      readFile(
        "packages/project-core/src/workflow-agent/workflow-planning-application-service.ts",
        "utf8",
      ),
    ]);
    expect(createRoute).toContain('"Cache-Control": "no-store"');
    expect(readRoute).toContain('"Cache-Control": "no-store"');
    expect(createRoute).toContain("previewAndPersistStoryboard");
    expect(service).toContain("GenerationSpecV3Schema.parse");
    expect(service).toContain("externalCalls: 0 as const");
    expect(service).toContain("generationAuthorized: false as const");
    expect(service).not.toContain("approvedVersionId !==");
    expect(service).not.toContain("approvedVersionId ===");
    expect(service).not.toContain(".submit(");
  });

  it("keeps stable planning codes in the technical record and gives owners bilingual guidance", async () => {
    const [panel, languageProvider] = await Promise.all([
      readFile("apps/project-web/components/storyboards/workflow-planning-panel.tsx", "utf8"),
      readFile("apps/project-web/components/i18n/language-provider.tsx", "utf8"),
    ]);

    expect(languageProvider).toContain("capabilityRequirementReasonText");
    expect(languageProvider).toContain("capabilityBlockerGuidanceText");
    expect(languageProvider).toContain("请为这个镜头绑定已验证的场景素材，然后重新准备");
    expect(languageProvider).toContain(
      "Bind a verified scene asset to this Shot, then prepare it again",
    );
    expect(panel).toContain("capabilityRequirementReasonText(item.reasonCode");
    expect(panel).toContain("capabilityBlockerGuidanceText(code");
    expect(panel).not.toContain("{item.purpose} · {item.reasonCode}");
    expect(panel).toContain('data-i18n-ignore="true"');
    expect(panel).toContain("shot.blockerCodes.join");
    expect(panel).toContain("item.reasonCode");
  });

  it("connects deterministic eligible semantic candidates without restoring approval gates", async () => {
    const service = await readFile(
      "packages/project-core/src/workflow-agent/workflow-planning-application-service.ts",
      "utf8",
    );
    expect(service).toContain("AssetCandidateService");
    expect(service).toContain("gatherPlanningInputCandidates");
    expect(service).toContain("automaticPlanningBindings");
    expect(service).not.toContain("formalAssetBindingEnabled");
    expect(service).not.toContain("approvedVersionId !==");
    expect(service).not.toContain("approvedVersionId ===");
  });
});
