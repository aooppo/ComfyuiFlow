import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("graph validation evidence storage", () => {
  it("declares immutable PASS/FAIL evidence and prevents database mutation", async () => {
    const migration = await readFile(
      "packages/project-core/prisma/migrations/202608270002_zero_call_graph_evidence/migration.sql",
      "utf8",
    );
    const schema = await readFile("packages/project-core/prisma/schema.prisma", "utf8");
    expect(schema).toContain("enum GraphValidationOutcome");
    expect(schema).toContain("model GraphValidationEvidence");
    expect(migration).toContain("CREATE TYPE \"GraphValidationOutcome\" AS ENUM ('PASS', 'FAIL')");
    expect(migration).toContain('CREATE TRIGGER "GraphValidationEvidence_no_mutation"');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "GraphValidationEvidence"');
    expect(migration).toContain('EXECUTE FUNCTION "mainline_append_only"()');
  });
});
