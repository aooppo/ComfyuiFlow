import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  TrialScopeApprovalCreateRequestV3Schema,
  TrialScopeApprovalV3Schema,
  TrialScopeRevocationRequestV3Schema,
} from "@comfyuiflow/contracts";

const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const hash = (value: string) => value.repeat(64);

describe("first real TRIAL scope API", () => {
  it("accepts only a confirmed bounded selected-Shot create request", () => {
    const request = {
      schemaVersion: "trial-scope-approval-create-request-v3" as const,
      generationPlanId: uuid("1"),
      selectedShotIds: [uuid("2"), uuid("3")],
      expiresInSeconds: 1_800,
      confirmed: true as const,
    };
    expect(TrialScopeApprovalCreateRequestV3Schema.parse(request)).toEqual(request);
    expect(() =>
      TrialScopeApprovalCreateRequestV3Schema.parse({
        ...request,
        selectedShotIds: [uuid("2"), uuid("2")],
      }),
    ).toThrow(/unique/);
    for (const forbidden of [
      { allowedTrialRefs: ["implementation.any@1"] },
      { providerPayload: { submit: true } },
      { generationAuthorized: true },
    ])
      expect(() =>
        TrialScopeApprovalCreateRequestV3Schema.parse({ ...request, ...forbidden }),
      ).toThrow();
  });

  it("freezes exact composition facts while remaining zero-call and unauthorized", () => {
    const item = {
      shotId: uuid("2"),
      generationSpecRef: { id: uuid("4"), version: hash("a") },
      implementationRef: { id: "implementation.hailuo03-text-partner", version: "1.0.0" },
      runtimeRef: { id: "runtime.comfyui-local", version: "1.0.0" },
      providerRef: { id: "provider.comfyui-partner", version: "1.0.0" },
      modelRef: { id: "model.hailuo03-partner", version: "1.0.0" },
      adapterRef: { id: "adapter.comfyui-mcp", version: "2.0.0" },
      compilerRef: { id: "compiler.hailuo03-text", version: "1.0.0" },
      compiledRequestDigest: hash("b"),
      costPolicyDigest: hash("c"),
      compositionDigest: hash("d"),
    };
    expect(
      TrialScopeApprovalV3Schema.parse({
        schemaVersion: "trial-scope-approval-v3",
        id: uuid("5"),
        projectId: uuid("6"),
        storyboardId: uuid("7"),
        storyboardRevisionRef: { id: uuid("8"), version: hash("e") },
        generationPlanRef: { id: uuid("1"), version: hash("f") },
        scopeDigest: hash("1"),
        idempotencyKey: "trial-scope-request-1",
        actorRef: "owner-local",
        status: "ACTIVE",
        expiresAt: "2026-08-26T12:30:00.000Z",
        createdAt: "2026-08-26T12:00:00.000Z",
        items: [item],
        revocation: null,
        externalCalls: 0,
        generationAuthorized: false,
        executionAuthorized: false,
      }),
    ).toMatchObject({ items: [item], externalCalls: 0, executionAuthorized: false });
    expect(
      TrialScopeRevocationRequestV3Schema.parse({
        schemaVersion: "trial-scope-revocation-request-v3",
        reasonCode: "OWNER_REVOKED",
        confirmed: true,
      }),
    ).toBeTruthy();
  });

  it("keeps route and owner UI boundaries zero-call and separate from execution confirmation", async () => {
    const [approvalRoute, revokeRoute, service, planning, panel] = await Promise.all([
      readFile(
        "apps/project-web/app/api/storyboard-versions/[versionId]/trial-scope-approvals/route.ts",
        "utf8",
      ),
      readFile(
        "apps/project-web/app/api/trial-scope-approvals/[approvalId]/revoke/route.ts",
        "utf8",
      ),
      readFile("packages/project-core/src/workflow-agent/trial-scope-approval-service.ts", "utf8"),
      readFile(
        "packages/project-core/src/workflow-agent/workflow-planning-application-service.ts",
        "utf8",
      ),
      readFile("apps/project-web/components/storyboards/workflow-planning-panel.tsx", "utf8"),
    ]);
    expect(approvalRoute).toContain('request.headers.get("Idempotency-Key")');
    expect(approvalRoute).toContain('"Cache-Control": "no-store"');
    expect(revokeRoute).toContain("service.revoke");
    expect(service).toContain("externalCalls: 0");
    expect(service).toContain("generationAuthorized: false");
    expect(service).toContain("executionAuthorized: false");
    expect(service).not.toMatch(/\.submit\(|\/prompt|GenerationAdapter/);
    expect(planning).toContain("activeTrialItemsByShot.get(shot.id)");
    expect(planning).toContain("allowedTrialRefs: new Set(shotTrialItems.keys())");
    expect(panel).toContain("批准本次首次真实试运行范围");
    expect(panel).toContain("批准本身不会调用外部服务");
    expect(panel).toContain("真实执行仍需新的动作时确认");
    expect(panel).toContain("零调用生成预览");
    expect(panel).toContain("确认一次有界视频批次");
  });
});
