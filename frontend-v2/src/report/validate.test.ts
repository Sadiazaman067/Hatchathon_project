import { describe, expect, it } from "vitest";
import { FIXTURES } from "./fixtures";
import { validateReport } from "./validate";

function clone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("validateReport", () => {
  it("accepts the different fixtures and keeps status different", () => {
    for (const fixture of FIXTURES.filter((f) => f.status === "different")) {
      const result = validateReport(fixture.data);
      expect(result.ok, fixture.id).toBe(true);
      if (result.ok) {
        expect(result.report.status).toBe("different");
        expect(result.report.first_divergence).not.toBeNull();
        expect(result.report.trace_window).not.toBeNull();
      }
    }
  });

  it("accepts the needs_review fixture without treating it as a crash", () => {
    const fixture = FIXTURES.find((f) => f.status === "needs_review");
    expect(fixture).toBeDefined();
    const result = validateReport(fixture?.data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.status).toBe("needs_review");
      expect(result.report.first_divergence).toBeNull();
      expect(result.report.trace_window).toBeNull();
      expect(result.report.warnings.length).toBeGreaterThan(0);
    }
  });

  it("accepts the no_difference_observed fixture", () => {
    const fixture = FIXTURES.find((f) => f.status === "no_difference_observed");
    expect(fixture).toBeDefined();
    const result = validateReport(fixture?.data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.status).toBe("no_difference_observed");
      expect(result.report.first_divergence).toBeNull();
      expect(result.report.trace_window).not.toBeNull();
    }
  });

  it("rejects a missing object", () => {
    const result = validateReport(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Invalid Report/);
  });

  it("rejects an invented status string", () => {
    const result = validateReport({ status: "proven" });
    expect(result.ok).toBe(false);
  });

  it("rejects different without first_divergence", () => {
    const source = FIXTURES.find((f) => f.status === "different")?.data;
    expect(source).toBeDefined();
    const broken = clone(source) as Record<string, unknown>;
    broken.first_divergence = null;
    const result = validateReport(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects no_difference_observed without a trace_window", () => {
    const source = FIXTURES.find((f) => f.status === "no_difference_observed")?.data;
    expect(source).toBeDefined();
    const broken = clone(source) as Record<string, unknown>;
    broken.trace_window = null;
    const result = validateReport(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects needs_review with a trace_window", () => {
    const source = FIXTURES.find((f) => f.status === "needs_review")?.data;
    const different = FIXTURES.find((f) => f.status === "different")?.data as Record<string, unknown> | undefined;
    expect(source).toBeDefined();
    expect(different?.trace_window).toBeDefined();
    const broken = clone(source) as Record<string, unknown>;
    broken.trace_window = clone(different?.trace_window);
    const result = validateReport(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects needs_review with a first_divergence object", () => {
    const source = FIXTURES.find((f) => f.status === "needs_review")?.data;
    expect(source).toBeDefined();
    const broken = clone(source) as Record<string, unknown>;
    broken.first_divergence = { scan: 1, tag: "O:2/0", legacy: 1, target: 0, rung: null };
    const result = validateReport(broken);
    expect(result.ok).toBe(false);
  });
});
