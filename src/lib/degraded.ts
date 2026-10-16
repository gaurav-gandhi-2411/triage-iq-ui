import type { TriagePlan } from "./types";

// Mirrors the API's own rule (core `app.py`): a plan is degraded when `_degraded` is true, which is the
// case for `llm_status == "parse_failure"` or any status starting with `degraded_`. Older API revisions
// omit `_degraded`, so the status is checked too.
export function isDegraded(plan: Pick<TriagePlan, "_llm_status"> & { _degraded?: boolean | null }): boolean {
  const status = plan._llm_status ?? "";
  return plan._degraded === true || status === "parse_failure" || status.startsWith("degraded_");
}

// What the user is told about WHY, keyed on the API's `_llm_status_reason` (core ADR-0063). Unknown
// reasons fall through to a generic sentence rather than echoing an internal code.
export function degradedCause(reason?: string | null): string {
  switch (reason) {
    case "rate_limited_tpd":
      return "The language model's daily token allowance is used up; it refills on a rolling 24-hour window.";
    case "rate_limited_tpm":
    case "rate_limited_rpm":
    case "rate_limited":
      return "The language model is receiving more requests than its per-minute allowance.";
    case "llm_time_budget_exceeded":
      return "The language model did not answer within the 15-second limit.";
    case "provider_timeout":
    case "provider_unavailable":
      return "The language model provider is not responding.";
    default:
      return "The language model could not produce a usable answer for this issue.";
  }
}
