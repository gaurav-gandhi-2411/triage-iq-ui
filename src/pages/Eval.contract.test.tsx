// Expand/contract guard: render the Eval page against the API repo's (core) eval_summary.json so a
// breaking response-shape change in core fails UI CI instead of blanking the live page
// (2026-10-05: core #141 removed judge keys the deployed UI read -> "reading 'gap_pp'" crash).
//
// Two modes:
//   default                  committed fixture (src/test/fixtures, see its README for the core SHA)
//   CORE_CONTRACT_LIVE=1     core main's CURRENT reports/*.json; fails closed if unreachable.
import { cleanup, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Eval from "./Eval";
import baselineFixtureRaw from "../test/fixtures/core-main-eval-baseline.json?raw";
import summaryFixtureRaw from "../test/fixtures/core-main-eval-summary.json?raw";

const LIVE = import.meta.env.CORE_CONTRACT_LIVE === "1";
const RAW_BASE = "https://raw.githubusercontent.com/gaurav-gandhi-2411/triage-iq/main/reports";

type Json = Record<string, unknown>;

// Surfaces a render crash (e.g. "Cannot read properties of undefined") as a readable failure
// instead of an opaque waitFor timeout.
class CrashCatcher extends Component<{ children: ReactNode }, { crash: string | null }> {
  state = { crash: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { crash: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.crash !== null ? <div>RENDER_CRASH: {this.state.crash}</div> : this.props.children;
  }
}

// Mirrors core src/triage_iq/api/app.py::_current_llm_baseline.
function currentLlmBaseline(b: Json | null): Json | null {
  if (!b) return null;
  const perRepo = (b.per_repo ?? {}) as Record<string, Json>;
  return {
    judge_model: ((b.judge ?? {}) as Json).model ?? null,
    overall: b.overall ?? null,
    per_repo: Object.fromEntries(
      Object.entries(perRepo).map(([repo, v]) => [
        repo,
        Object.fromEntries(
          ["n", "mean", "fabrication_rate", "floor_fail_rate"].map((k) => [k, v[k] ?? null]),
        ),
      ]),
    ),
    cassette_hash: String(b.cassette_hash ?? "").slice(0, 12),
  };
}

function buildApiResponse(summary: Json, baseline: Json | null): Json {
  return { ...summary, current_llm_baseline: currentLlmBaseline(baseline) };
}

async function fetchCoreFile(name: string): Promise<Json> {
  const url = `${RAW_BASE}/${name}`;
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return (await r.json()) as Json;
      lastErr = `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 3) await new Promise((res) => setTimeout(res, 1000 * 2 ** (attempt - 1)));
  }
  // Fail closed: an unreachable core must never turn this guard into a silent pass.
  throw new Error(`CORE_CONTRACT_LIVE=1: could not fetch ${url} after 3 attempts (${lastErr})`);
}

// Capture before stubbing: the live loader needs the real network fetch.
const realFetch = globalThis.fetch;
let apiResponse: Json;
const uncaught: string[] = [];
const onWindowError = (e: ErrorEvent) => uncaught.push(String(e.error ?? e.message));

beforeEach(async () => {
  uncaught.length = 0;
  window.addEventListener("error", onWindowError);
  if (LIVE) {
    // Real fetch for core files; the page itself is served the composed response below.
    globalThis.fetch = realFetch;
    apiResponse = buildApiResponse(
      await fetchCoreFile("eval_summary.json"),
      await fetchCoreFile("eval_baseline.json"),
    );
  } else {
    apiResponse = buildApiResponse(
      JSON.parse(summaryFixtureRaw) as Json,
      JSON.parse(baselineFixtureRaw) as Json,
    );
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.endsWith("/eval/summary")) throw new Error(`unexpected fetch: ${url}`);
      return new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}, 30_000);

afterEach(() => {
  window.removeEventListener("error", onWindowError);
  cleanup();
  vi.unstubAllGlobals();
});

describe(`Eval page contract (${LIVE ? "core main LIVE" : "committed fixture"})`, () => {
  it("renders every section against core's eval_summary.json with no broken values", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CrashCatcher>
        <MemoryRouter initialEntries={["/eval"]}>
          <Eval />
        </MemoryRouter>
      </CrashCatcher>,
    );

    // Not blank: the data-driven sections appear (the loading/error states are not enough).
    await waitFor(
      () => expect(document.body.textContent).toMatch(/1 · Feature Leakage Retraction|RENDER_CRASH|Failed to load/),
      { timeout: 4000 },
    );
    const text = document.body.textContent ?? "";
    expect(text, "Eval page crashed while rendering").not.toContain("RENDER_CRASH");

    expect(text).not.toContain("Failed to load eval summary");
    for (const section of [
      "Feature Leakage Retraction",
      "Resolution Predictor Results",
      "Classifier Calibration",
      "LLM-as-Judge Evaluation",
      "Cross-Encoder Reranker",
      "Conformal Intervals",
    ]) {
      expect(text, `missing section: ${section}`).toContain(section);
    }

    // Judge section must show a real current baseline, not the "not available" fallback.
    const baseline = apiResponse.current_llm_baseline as { overall: { n: number; mean: number } } | null;
    expect(baseline?.overall, "current_llm_baseline.overall missing").toBeTruthy();
    expect(text).not.toContain("current judge baseline is not available");
    const dimMax = Object.values(
      ((apiResponse.judge ?? {}) as { dimension_max?: Record<string, number> }).dimension_max ?? {},
    ) as number[];
    const max = dimMax.length ? dimMax.reduce((a, b) => a + b, 0) : 15;
    expect(text).toContain(`${baseline!.overall.mean.toFixed(2)}/${max}`);
    expect(text).toContain(`n=${baseline!.overall.n}`);
    if (!LIVE) {
      // Pin the known committed baseline so a fixture refresh is a conscious act.
      expect(text).toContain("11.94/15");
      expect(text).toContain("n=64");
    }

    // No broken interpolations anywhere on the page.
    for (const bad of ["undefined", "NaN", "[object"]) {
      expect(text, `page text contains "${bad}"`).not.toContain(bad);
    }

    expect(uncaught, `uncaught errors: ${uncaught.join(" | ")}`).toEqual([]);
    const reactErrors = consoleError.mock.calls
      .map((c) => c.map(String).join(" "))
      .filter((m) => /error|uncaught|cannot read/i.test(m));
    expect(reactErrors, "console.error during render").toEqual([]);
    consoleError.mockRestore();
  });
});
