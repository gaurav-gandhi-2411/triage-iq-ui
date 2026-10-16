// Degraded-mode UX (2026-10-12): when the API returns the signals-only plan (`_degraded` true, core
// ADR-0063) the card says so, keeps what is still real (component + confidence, similar issues, the
// resolution interval) and labels everything LLM-written as absent instead of showing the API's fixed
// placeholders ("medium priority", "Manual triage required", ...).
// The degraded fixture is a REAL production response (revision triageiq-api-00055-boy, 2026-10-12,
// reason rate_limited_tpd). The normal plan is that response with the LLM fields filled in (synthetic).
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "./ui/tooltip";
import { TriagePlanCard } from "../App";
import type { TriagePlan } from "../lib/types";
import degradedRaw from "../test/fixtures/api-degraded-triage-2026-10-12.json?raw";

const DEGRADED = JSON.parse(degradedRaw) as TriagePlan;
const NORMAL = {
  ...DEGRADED,
  _degraded: false,
  _llm_status: "ok",
  _llm_status_reason: null,
  triage_summary: "The kubelet fails to start because of a cgroup driver mismatch after the upgrade.",
  expected_resolution_summary: "Likely resolved within hours once the driver setting is aligned.",
  priority_guess: "high",
  priority_rationale: "The node cannot join the cluster.",
  suggested_assignee_class: "sig-node",
  suggested_next_steps: ["Align the cgroup driver in the kubelet config", "Restart the kubelet"],
} as TriagePlan;

function renderCard(plan: TriagePlan): { text: string; q: (id: string) => Element | null } {
  const { container } = render(
    <TooltipProvider>
      <TriagePlanCard plan={plan} repo="kubernetes/kubernetes" onCopyLink={() => {}} onCopyJson={() => {}} />
    </TooltipProvider>,
  );
  // Raw JSON <details> holds the whole response, so exclude it when asserting on what the user reads.
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach((d) => d.remove());
  return { text: clone.textContent ?? "", q: (id) => container.querySelector(`[data-testid="${id}"]`) };
}

afterEach(cleanup);

describe("TriagePlanCard, degraded (ML-only) plan", () => {
  it("shows a clear notice with the cause and what is real versus absent", () => {
    const { text, q } = renderCard(DEGRADED);
    const notice = q("degraded-notice");
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute("role")).toBe("status");
    expect(text).toContain("The language model is busy, so this is an ML-only plan");
    expect(text).toContain("daily token allowance is used up");
    expect(text).toMatch(/Still real:.*component and confidence.*similar issues.*resolution interval/s);
    expect(text).toMatch(/Not generated:.*summary, priority.*assignee.*next steps/s);
  });

  it("still shows the real ML output: component + confidence, similar issues, resolution interval", () => {
    const { text } = renderCard(DEGRADED);
    expect(text).toContain("kubelet");
    expect(text).toMatch(/61%|0\.61/); // classifier confidence 0.606 rendered by ConfidenceBar
    for (const iss of DEGRADED.similar_issues ?? []) expect(text).toContain(String(iss.number));
    expect(text).toContain("Similar issues");
    expect(text).toContain("Interval from the trained resolution-time model");
    expect(text).toMatch(/hours/); // resolution bucket badge
  });

  it("hides or labels as absent everything the LLM would have written", () => {
    const { text, q } = renderCard(DEGRADED);
    for (const placeholder of [
      "medium priority",
      "Manual triage required",
      "Automated triage degraded",
      "LLM response unparseable",
      "defaulting to medium",
    ]) {
      expect(text).not.toContain(placeholder);
    }
    // The only mention of the rationale/next steps is the "not generated" label itself.
    expect(text).not.toMatch(/Priority rationale(?! and next steps are not generated)/);
    expect(text).not.toContain("Next steps");
    expect(text).toContain("ML-only plan");
    expect(text).toContain("Not generated");
    expect(q("degraded-absent")?.textContent).toMatch(/not generated in ML-only mode/);
  });

  it("is also used for parse failures and other degraded_ statuses without the API flag", () => {
    const { q } = renderCard({ ...DEGRADED, _degraded: undefined, _llm_status: "parse_failure", _llm_status_reason: null });
    expect(q("degraded-notice")).not.toBeNull();
  });
});

describe("TriagePlanCard, normal plan is unchanged", () => {
  it("shows the LLM summary, priority, assignee, rationale and next steps, and no notice", () => {
    const { text, q } = renderCard(NORMAL);
    expect(q("degraded-notice")).toBeNull();
    expect(q("degraded-absent")).toBeNull();
    expect(text).toContain("cgroup driver mismatch after the upgrade");
    expect(text).toContain("high priority");
    expect(text).toContain("sig-node");
    expect(text).toContain("Priority rationale");
    expect(text).toContain("Next steps");
    expect(text).toContain("Align the cgroup driver");
    expect(text).not.toContain("ML-only");
  });
});
