// resolution_served rendering (core ADR-0064 / D7): new table from the new summary shape, the
// unchanged old table from the old shape, and a negative control for a malformed served block.
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Eval from "./Eval";
import oldSummaryRaw from "../test/fixtures/core-main-eval-summary.json?raw";
import newSummaryRaw from "../test/fixtures/core-integration-eval-summary.json?raw";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const OLD = JSON.parse(oldSummaryRaw) as Json;
const NEW = JSON.parse(newSummaryRaw) as Json;

async function renderEval(summary: Json): Promise<string> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(summary), { status: 200 })),
  );
  render(
    <MemoryRouter initialEntries={["/eval"]}>
      <Eval />
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.body.textContent).toMatch(/Feature Leakage Retraction/), {
    timeout: 4000,
  });
  return document.body.textContent ?? "";
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Eval resolution_served", () => {
  it("renders the served table, from JSON values, for the new shape", async () => {
    const text = await renderEval(NEW);
    expect(document.querySelector('[data-testid="resolution-served"]')).not.toBeNull();
    expect(text).toContain("The point estimate is the training-window median");
    const k8s = NEW.resolution_served.repos["kubernetes/kubernetes"];
    expect(text).toContain(`${k8s.served_point_days.toFixed(2)}d`);
    expect(text).toContain(`${k8s.learned_model_not_served.median_ae_days.toFixed(2)}d`);
    expect(text).toContain(`n=${k8s.interval.n_heldout}`);
    expect(text).toContain(`+${k8s.bucket.delta_pp.toFixed(2)}pp`);
    expect(text).toContain("038052a90225"); // short sha of the k8s predictor
    // Old honest-metrics rows and the "still served with a low-confidence badge" paragraph are gone.
    expect(text).not.toContain("Honest metrics (created_at split, deployed model)");
    expect(text).not.toContain("with a low-confidence badge");
    for (const bad of ["undefined", "NaN", "[object"]) expect(text).not.toContain(bad);
  });

  it("renders the old table and no caption for the old shape", async () => {
    const text = await renderEval(OLD);
    expect(document.querySelector('[data-testid="resolution-served"]')).toBeNull();
    expect(text).toContain("Honest metrics (created_at split, deployed model)");
    expect(text).toContain("with a low-confidence badge");
    expect(text).not.toContain("historical:");
  });

  it("shows the historical caption when the old table is rendered with honest_metrics_status", async () => {
    const withStatus = structuredClone(OLD);
    withStatus.leakage.honest_metrics_status = NEW.leakage.honest_metrics_status;
    const text = await renderEval(withStatus);
    expect(text).toContain(NEW.leakage.honest_metrics_status);
  });

  it("negative control: missing served sub-fields fall back to dashes instead of throwing", async () => {
    const broken = structuredClone(NEW);
    broken.resolution_served = {
      repos: {
        "kubernetes/kubernetes": { served_point_days: 3, bucket: {}, interval: {} },
        "microsoft/vscode": {},
      },
    };
    const text = await renderEval(broken);
    expect(document.querySelector('[data-testid="resolution-served"]')).not.toBeNull();
    expect(text).toContain("3.00d");
    expect(text).toContain("—");
    expect(text).not.toContain("Failed to load");
    for (const bad of ["undefined", "NaN", "[object"]) expect(text).not.toContain(bad);

    cleanup();
    const empty = structuredClone(NEW);
    empty.resolution_served = {};
    const text2 = await renderEval(empty);
    expect(text2).not.toContain("Failed to load");
  });
});
