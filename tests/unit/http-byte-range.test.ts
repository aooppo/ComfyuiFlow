import { describe, expect, it } from "vitest";
import { parseSingleByteRange } from "../../apps/project-web/lib/http-byte-range.js";

describe("parseSingleByteRange", () => {
  it("parses bounded, open-ended, and suffix ranges", () => {
    expect(parseSingleByteRange("bytes=0-1023", 4096)).toEqual({ start: 0, end: 1023 });
    expect(parseSingleByteRange("bytes=1024-", 4096)).toEqual({ start: 1024, end: 4095 });
    expect(parseSingleByteRange("bytes=-512", 4096)).toEqual({ start: 3584, end: 4095 });
  });

  it("clamps a requested end and an oversized suffix to the file", () => {
    expect(parseSingleByteRange("bytes=4000-9999", 4096)).toEqual({
      start: 4000,
      end: 4095,
    });
    expect(parseSingleByteRange("bytes=-9999", 4096)).toEqual({ start: 0, end: 4095 });
  });

  it("rejects malformed, multiple, empty, and unsatisfiable ranges", () => {
    expect(parseSingleByteRange("items=0-10", 4096)).toBeNull();
    expect(parseSingleByteRange("bytes=0-10,20-30", 4096)).toBeNull();
    expect(parseSingleByteRange("bytes=-", 4096)).toBeNull();
    expect(parseSingleByteRange("bytes=4096-", 4096)).toBeNull();
    expect(parseSingleByteRange("bytes=20-10", 4096)).toBeNull();
    expect(parseSingleByteRange("bytes=-0", 4096)).toBeNull();
  });
});
