import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Next.js build output isolation", () => {
  it("keeps development and production artifacts in separate directories", async () => {
    const [config, packageJson, gitignore] = await Promise.all([
      readFile("apps/project-web/next.config.ts", "utf8"),
      readFile("apps/project-web/package.json", "utf8"),
      readFile(".gitignore", "utf8"),
    ]);

    expect(config).toContain('distDir: process.env.NEXT_DIST_DIR ?? ".next"');
    const scripts = JSON.parse(packageJson).scripts as Record<string, string>;
    expect(scripts.dev).toBe("next dev -p 3210");
    expect(scripts.build).toContain("NEXT_DIST_DIR=.next-build next build");
    expect(scripts.start).toContain("NEXT_DIST_DIR=.next-build next start -p 3210");
    expect(gitignore).toContain(".next-build/");
  });
});
