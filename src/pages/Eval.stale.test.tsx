// /eval staleness fixes (2026-10-12, found in the post-#161 browser check):
//  1. no multi-column "Resolution Predictor Results" header over empty columns when the served
//     block exists (only a one-line retraction remains);
//  2. owner wording (ADR-0064) with the tail share rendered from data, never typed in;
//  3. section 5 shows the served vscode coverage (82.7%), names the split, and no stale 74.6% /
//     68.3% / 74.1% numbers anywhere on the page;
//  4. no console errors, and a malformed tail block degrades to the wording without the clause.
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Eval from "./Eval";
import servedRaw from "../test/fixtures/core-served-eval-summary.json?raw";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SERVED = JSON.parse(servedRaw) as Json;

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
  await waitFor(() => expect(document.body.textContent).toMatch(/Conformal Intervals/), {
    timeout: 4000,
  });
  return document.body.textContent ?? "";
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Eval page, served block (core #172)", () => {
  it("has no empty-column resolution table header, only a one-line retraction", async () => {
    const text = await renderEval(SERVED);
    expect(text).not.toContain("Resolution Predictor Results");
    expect(text).not.toContain("Improvement vs naive");
    expect(text).not.toContain("LightGBM MAE");
    expect(document.querySelector('[data-testid="retracted-metrics"]')?.textContent).toContain(
      "INVALIDATED",
    );
    expect(document.querySelector('[data-testid="resolution-served"]')).not.toBeNull();
  });

  it("uses the ADR-0064 wording, with the tail share taken from the data", async () => {
    const text = await renderEval(SERVED);
    const wording = document.querySelector('[data-testid="served-wording"]')?.textContent ?? "";
    expect(wording).toContain("The point estimate is the training-window median.");
    expect(wording).toContain("did not beat it on the typical issue in either repository");
    expect(wording).toContain("(median absolute error)");
    expect(wording).toContain("marginally better on mean error (+2%)");
    expect(wording).toContain("almost entirely from the longest-resolving 20% of issues");
    expect(wording).toContain(
      "The learned parts in production are the k8s bucket classifier and the conformal intervals.",
    );
    const tail = SERVED.resolution_served.repos["kubernetes/kubernetes"].learned_model_not_served
      .mae_gain_tail_share;
    expect(wording).toContain(`they carry ${(tail.share_of_total_gain * 100).toFixed(0)}% of that gain`);
    expect(tail.longest_resolving_fraction).toBe(0.2);
    expect(wording).toContain(`${tail.min_resolution_days.toFixed(0)}+ days`);
    expect(wording).not.toMatch(/ \./); // no stray space before a full stop
    for (const bad of ["undefined", "NaN", "[object"]) expect(text).not.toContain(bad);
  });

  it("section 5 shows the served vscode coverage, names the split, and no stale numbers", async () => {
    const text = await renderEval(SERVED);
    const vs = SERVED.conformal.by_repo["microsoft/vscode"];
    expect(vs.empirical_coverage).toBe(0.827);
    expect(text).toContain("82.7%");
    expect(text).toContain("[78.5%, 86.2%]");
    const basis = document.querySelector('[data-testid="vscode-interval-basis"]')?.textContent ?? "";
    expect(basis).toContain("chronological 40/60 split by created_at");
    expect(basis).toContain("246 issues");
    expect(basis).toContain("370 issues");
    for (const stale of ["74.6%", "74.1%", "68.3%", "[69.9%, 78.8%]", "Split sensitivity"]) {
      expect(text).not.toContain(stale);
    }
    // the served table names both splits
    const splits = document.querySelector('[data-testid="interval-splits"]')?.textContent ?? "";
    expect(splits).toContain("chronological 30/70");
    expect(splits).toContain("chronological 40/60");
  });

  it("renders without console errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderEval(SERVED);
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("negative control: a malformed tail block drops the parenthetical, not the page", async () => {
    const broken = structuredClone(SERVED);
    broken.resolution_served.repos["kubernetes/kubernetes"].learned_model_not_served.mae_gain_tail_share =
      { share_of_total_gain: "x" };
    delete broken.resolution_served.repos["microsoft/vscode"].interval.split;
    const text = await renderEval(broken);
    const wording = document.querySelector('[data-testid="served-wording"]')?.textContent ?? "";
    expect(wording).toContain("almost entirely from the longest-resolving issues. The learned parts");
    expect(text).not.toContain("Failed to load");
    for (const bad of ["undefined", "NaN", "[object"]) expect(text).not.toContain(bad);
  });
});
