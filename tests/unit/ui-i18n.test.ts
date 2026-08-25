import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("project web UI internationalization", () => {
  it("keeps one shared bilingual catalog, persisted selector, and dynamic patterns", async () => {
    const [
      provider,
      shell,
      characterStates,
      productionAssetEditor,
      productionAssetLibrary,
      analysisPreview,
      analysisRun,
      analysisSelection,
      projectHeader,
    ] = await Promise.all([
      readFile("apps/project-web/components/i18n/language-provider.tsx", "utf8"),
      readFile("apps/project-web/components/i18n/app-shell.tsx", "utf8"),
      readFile("apps/project-web/components/character-states/character-state-editor.tsx", "utf8"),
      readFile("apps/project-web/components/production-assets/production-asset-editor.tsx", "utf8"),
      readFile(
        "apps/project-web/components/production-assets/production-asset-library.tsx",
        "utf8",
      ),
      readFile("apps/project-web/components/asset-understanding/analysis-preview.tsx", "utf8"),
      readFile("apps/project-web/components/asset-understanding/analysis-run.tsx", "utf8"),
      readFile("apps/project-web/components/asset-understanding/analysis-selection.tsx", "utf8"),
      readFile("apps/project-web/components/project-header.tsx", "utf8"),
    ]);
    expect(provider).toContain('"Create project": "创建项目"');
    expect(provider).toContain("comfyuiflow.ui.locale");
    expect(provider).toContain("MutationObserver");
    expect(provider).toContain("No candidate gaps");
    expect(provider).toContain('REFERENCE_USAGE_MISSING: "缺少所需用途"');
    expect(provider).toContain("/^Shot (\\d+)$/");
    expect(shell).toContain('setLocale("zh-CN")');
    expect(shell).toContain('setLocale("en")');
    expect(provider).toContain("当前组件类型没有可用的已发布版本");
    expect(provider).toContain('"Go to the Semantic catalog": "前往语义素材库"');
    expect(provider).toContain('IDENTITY_LORA: "身份 LoRA"');
    expect(provider).toContain('DERIVED_FROM: "派生自"');
    expect(provider).toContain('"Target version (optional)": "目标版本（可选）"');
    expect(provider).toContain("普通候选预览不强制要求命名状态");
    expect(provider).toContain("/^(.+) · v(\\d+) · (DRAFT|ACTIVE|RETIRED)$/");
    expect(characterStates).toContain("componentAvailabilityHint");
    expect(characterStates).toContain('href="#semantic-catalog"');
    expect(characterStates).toContain("aria-describedby={componentAvailabilityHint");
    expect(characterStates).toContain("<option key={value} value={value}>");
    expect(productionAssetEditor).toContain("<option key={value} value={value}>");
    expect(productionAssetLibrary.match(/<option key=\{value\} value=\{value\}>/g)).toHaveLength(4);
    expect(productionAssetLibrary).toContain('id="semantic-catalog"');
    expect(provider).toContain('QUEUED: "排队中"');
    expect(analysisPreview).toContain("已产生");
    expect(analysisRun).toContain("任务已进入队列，但尚未被 Worker 领取");
    expect(analysisSelection).toContain("`预览 ${selected.length} 张图片`");
    expect(analysisSelection).toContain('"预览图片"');
    expect(projectHeader).not.toContain("window.prompt");
    expect(projectHeader).not.toContain("window.confirm");
    expect(projectHeader).toContain('className="projectInlineForm"');
    expect(provider).toContain('"Edit project details": "编辑项目详情"');
  });
});
