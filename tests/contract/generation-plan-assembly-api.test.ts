import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("generation plan assembly API", () => {
  it("exposes read/create and byte-range content routes without provider submission", async () => {
    const stateRoutePath = "apps/project-web/app/api/generation-plans/[planId]/assemblies/route.ts";
    const contentRoutePath =
      "apps/project-web/app/api/generation-plan-assemblies/[assemblyId]/content/route.ts";
    await expect(access(stateRoutePath)).resolves.toBeUndefined();
    await expect(access(contentRoutePath)).resolves.toBeUndefined();

    const [stateRoute, contentRoute, service] = await Promise.all([
      readFile(stateRoutePath, "utf8"),
      readFile(contentRoutePath, "utf8"),
      readFile("packages/project-core/src/generation-plan-assembly-service.ts", "utf8"),
    ]);

    expect(stateRoute).toContain("getAssemblyState");
    expect(stateRoute).toContain("createAssembly");
    expect(contentRoute).toContain("parseSingleByteRange");
    expect(contentRoute).toContain("resolveAssemblyPath");
    expect(service).toContain("ffmpeg");
    expect(service).toContain("ffprobe");
    expect(service).not.toContain("generationProviderRegistry");
    expect(service).not.toContain("AuthorizationConsumption");
  });

  it("keeps the Shot Plan UI explicit and explains missing PASS shots", async () => {
    const editor = await readFile(
      "apps/project-web/components/storyboards/shot-plan-editor.tsx",
      "utf8",
    );
    expect(editor).toContain("生成合成预览");
    expect(editor).toContain("missingOrdinals");
    expect(editor).toContain("currentAssembly.contentUrl");
    expect(editor).toContain("历史合成版本");
    expect(editor).toContain("以此历史视频为重试基线");
    expect(editor).toContain("不得把沙发移到画面左侧");
    expect(editor).toContain("杯中红酒的颜色和液位必须与 Shot 2 尾帧一致");
  });
});
