import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "./fixtures";

const DEMO = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../backend/tests/fixtures/demo_samples");

function read(rel: string): string {
  return readFileSync(resolve(DEMO, rel), "utf8").replace(/\n+$/, "");
}

describe("sample programs match backend fixtures", () => {
  it("keeps match / dropped_stop / unsupported_osr texts in sync", () => {
    const match = FIXTURES.find((row) => row.id === "match_no_difference");
    const dropped = FIXTURES.find((row) => row.id === "dropped_stop_different");
    const osr = FIXTURES.find((row) => row.id === "unsupported_osr_needs_review");
    expect(match?.legacyText).toBe(read("match/legacy.txt"));
    expect(match?.targetText).toBe(read("match/target.txt"));
    expect(dropped?.legacyText).toBe(read("dropped_stop/legacy.txt"));
    expect(dropped?.targetText).toBe(read("dropped_stop/target.txt"));
    expect(osr?.legacyText).toBe(read("unsupported_osr/legacy.txt"));
    expect(osr?.targetText).toBe(read("unsupported_osr/target.txt"));
    expect(JSON.stringify(match?.tagMap)).toBe(
      JSON.stringify(JSON.parse(readFileSync(resolve(DEMO, "tag_map.json"), "utf8"))),
    );
  });
});
