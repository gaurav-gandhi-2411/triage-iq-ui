import { describe, expect, it } from "vitest";
import { degradedCause, isDegraded } from "./degraded";

describe("isDegraded", () => {
  it("is true for the API flag, parse_failure and any degraded_ status", () => {
    expect(isDegraded({ _llm_status: "ok", _degraded: true })).toBe(true);
    expect(isDegraded({ _llm_status: "parse_failure" })).toBe(true);
    expect(isDegraded({ _llm_status: "degraded_provider_error" })).toBe(true);
    expect(isDegraded({ _llm_status: "degraded_token_budget" })).toBe(true);
  });

  it("is false for a normal plan and for older APIs that omit the flag", () => {
    expect(isDegraded({ _llm_status: "ok", _degraded: false })).toBe(false);
    expect(isDegraded({ _llm_status: "ok" })).toBe(false);
    expect(isDegraded({ _llm_status: "ok", _degraded: null })).toBe(false);
  });
});

describe("degradedCause", () => {
  it("explains the quota that was hit", () => {
    expect(degradedCause("rate_limited_tpd")).toMatch(/daily token allowance/);
    expect(degradedCause("rate_limited_tpm")).toMatch(/per-minute/);
    expect(degradedCause("llm_time_budget_exceeded")).toMatch(/15-second/);
    expect(degradedCause("provider_unavailable")).toMatch(/not responding/);
  });

  it("never echoes an unknown internal code", () => {
    for (const r of ["something_new", "", null, undefined]) {
      const text = degradedCause(r);
      expect(text).toMatch(/could not produce a usable answer/);
      expect(text).not.toContain("something_new");
    }
  });
});
