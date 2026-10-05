import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Monitor, ArrowLeft, ExternalLink } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

interface ConformalRepoStats {
  calibration_split: string;
  q_adjustment_hours: number;
  q_adjustment_days: number;
  empirical_coverage: number;
  coverage_ci95_lower: number;
  coverage_ci95_upper: number;
  raw_interval_coverage: number;
  median_width_raw_days: number;
  median_width_conformal_days: number;
  exchangeability_note?: string;
  // New API shape only (2026-10): sample sizes + vscode split sensitivity.
  n_calibration?: number;
  n_true_test?: number;
  split_sensitivity?: {
    split_30_70: { n_calibration: number; n_true_test: number; empirical_coverage: number };
    split_40_60: { n_calibration: number; n_true_test: number; empirical_coverage: number };
    divergence_pp: number;
  };
}

interface CurrentLlmBaseline {
  judge_model?: string | null;
  overall?: { n: number; mean: number } | null;
  per_repo?: Record<
    string,
    { n?: number | null; mean?: number | null; fabrication_rate?: number | null; floor_fail_rate?: number | null }
  >;
  cassette_hash?: string;
}

// Fallback only: the real max is the sum of judge.dimension_max (2+3+3+1+3+3 = 15), see judgeMaxScore().
const JUDGE_MAX_SCORE_FALLBACK = 15;

function judgeMaxScore(dimensionMax?: Record<string, number>): number {
  const vals = Object.values(dimensionMax ?? {});
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : JUDGE_MAX_SCORE_FALLBACK;
}

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const fmtOrNA = (x: number | null | undefined, digits = 4) => (x == null ? "n/a" : x.toFixed(digits));

interface CalibrationRepo {
  T_opt: number;
  // null in the new API shape: validation-split ECE was never recorded for the retrained classifier.
  ece_before_val?: number | null;
  ece_after_val?: number | null;
  ece_test: number;
  ece_eval_set?: number | null;
}

interface EvalSummary {
  leakage: {
    feature_removed: string;
    removal_reason: string;
    fixed_split: string;
    // New API shape: fixed_split is the bare name and previous_split carries the old one.
    // Old shape: fixed_split was "created_at (was: closed_at)".
    previous_split?: string;
    prior_metrics_invalidated: {
      k8s_improvement_pct: string;
      vscode_improvement_pct: string;
      note: string;
    };
    honest_metrics: {
      k8s: {
        lgbm_mae_days: number;
        naive_mae_days: number;
        improvement_pct: string;
        ci_coverage: number;
        n_test?: number;
      };
      vscode: {
        lgbm_mae_days: number;
        naive_mae_days: number;
        improvement_pct: string;
        ci_coverage: number;
        n_test?: number;
        note: string;
        bucket_vs_naive_delta_pp?: number;
        bucket_vs_naive_ci95_pp?: [number, number];
      };
    };
  };
  calibration: {
    method: string;
    test_accuracy_delta_pp: number;
    classifier?: string;
    ece_test_definition?: string;
    ece_eval_set_definition?: string;
    val_ece_note?: string;
    repos: {
      microsoft_vscode: CalibrationRepo;
      kubernetes_kubernetes: CalibrationRepo;
    };
  };
  // Old API shape (pre-2026-10) also carries stale W1-era keys (cross_family_*, w1_*,
  // production_llama_score, dimensions[*].production_mean). They are deliberately NOT typed or
  // read: the judge section renders only current_llm_baseline + judge.per_repo[*].dimensions.
  judge?: {
    production_judge_model?: string;
    dimension_max?: Record<string, number>;
    per_repo?: Record<string, { dimensions?: Record<string, number> }>;
  };
  current_llm_baseline?: CurrentLlmBaseline | null;
  reranker: {
    model_tested: string;
    phase2_robustness_n: number;
    phase2_n_bootstrap?: number;
    phase2_baseline_r5: number;
    phase2_reranker_r5: number;
    phase2_delta_pp: string;
    phase2_ci_95: string;
    phase2_verdict: string;
  };
  conformal?: {
    method: string;
    target_coverage: number;
    caveats: string;
    by_repo: {
      "kubernetes/kubernetes": ConformalRepoStats;
      "microsoft/vscode": ConformalRepoStats;
    };
  };
}

export default function Eval() {
  const [data, setData] = useState<EvalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useState(() => { setMounted(true); });

  useEffect(() => {
    fetch(`${API_BASE}/eval/summary`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EvalSummary>;
      })
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      });
  }, []);

  const baseline = data?.current_llm_baseline ?? null;
  const judgeMax = judgeMaxScore(data?.judge?.dimension_max);
  // Old API shape baked "(was: closed_at)" into fixed_split; strip it so it is never shown twice.
  const fixedSplit = (data?.leakage.fixed_split ?? "").replace(/\s*\(was:[^)]*\)\s*$/, "");
  const previousSplit =
    data?.leakage.previous_split ??
    /\(was:\s*([^)]*)\)/.exec(data?.leakage.fixed_split ?? "")?.[1] ??
    "closed_at";
  const vsc = data?.leakage.honest_metrics.vscode;
  // Dimensions come ONLY from judge.per_repo[*].dimensions (new API). The old API's
  // judge.dimensions[*].production_mean are stale n=65 values and are never read.
  const dimensionRepos = Object.entries(data?.judge?.per_repo ?? {}).flatMap(([repo, r]) =>
    r?.dimensions && Object.keys(r.dimensions).length > 0 ? [[repo, r.dimensions] as const] : [],
  );

  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background px-4 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-screen-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link
                  to="/"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                />
              }
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div>
              <span className="text-base font-semibold tracking-tight text-foreground">TriageIQ</span>
              <span className="ml-2 text-xs text-muted-foreground">Eval Methodology</span>
            </div>
          </div>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(nextTheme)}
              aria-label={`Switch to ${nextTheme} mode`}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-screen-lg w-full px-4 py-8 flex-1 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Evaluation Methodology</h2>
          <p className="text-sm text-muted-foreground">
            All numbers are sourced from checked-in reports/ files and ADRs. No recompute at
            request time — this page reads a static{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">eval_summary.json</code>.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load eval summary: {error}
          </div>
        )}

        {!data && !error && (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Section 1: Leakage Retraction */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>1 · Feature Leakage Retraction</span>
                  <Badge className="border border-red-300 bg-red-50 text-red-700 text-xs dark:border-red-700 dark:bg-red-950 dark:text-red-300">
                    ADR-0009
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/50 px-4 py-3 text-sm space-y-1">
                  <p>
                    <span className="font-medium">Feature removed:</span>{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                      {data.leakage.feature_removed}
                    </code>
                  </p>
                  <p className="text-muted-foreground text-xs">{data.leakage.removal_reason}</p>
                  <p className="text-muted-foreground text-xs">
                    Temporal split corrected:{" "}
                    <span className="font-mono">{fixedSplit}</span>{" "}
                    (was: <span className="font-mono">{previousSplit}</span>)
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Resolution Predictor Results
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                          <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Improvement vs naive</th>
                          <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">LightGBM MAE</th>
                          <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Naive MAE</th>
                          <th className="py-2 text-left text-xs font-medium text-muted-foreground">
                            Raw interval coverage (Q10–Q90)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Invalidated row header */}
                        <tr>
                          <td colSpan={5} className="pt-3 pb-1">
                            <span className="text-xs text-muted-foreground italic">
                              Prior metrics (broken closed_at split) —{" "}
                              <span className="font-medium text-destructive">INVALIDATED</span>
                            </span>
                          </td>
                        </tr>
                        <tr className="opacity-60">
                          <td className="py-1 pr-4 text-xs font-mono text-muted-foreground">k8s</td>
                          <td className="py-1 pr-4 text-xs">
                            <span className="line-through text-muted-foreground">
                              {data.leakage.prior_metrics_invalidated.k8s_improvement_pct}
                            </span>
                          </td>
                          <td colSpan={3} className="py-1 text-xs text-muted-foreground">—</td>
                        </tr>
                        <tr className="opacity-60">
                          <td className="py-1 pr-4 text-xs font-mono text-muted-foreground">vscode</td>
                          <td className="py-1 pr-4 text-xs">
                            <span className="line-through text-muted-foreground">
                              {data.leakage.prior_metrics_invalidated.vscode_improvement_pct}
                            </span>
                          </td>
                          <td colSpan={3} className="py-1 text-xs text-muted-foreground">—</td>
                        </tr>
                        {/* Honest metrics */}
                        <tr>
                          <td colSpan={5} className="pt-3 pb-1">
                            <span className="text-xs text-muted-foreground italic">
                              Honest metrics (created_at split, deployed model)
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-1.5 pr-4 text-xs font-mono">k8s</td>
                          <td className="py-1.5 pr-4 text-xs font-medium text-foreground">
                            {data.leakage.honest_metrics.k8s.improvement_pct}
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums">
                            {data.leakage.honest_metrics.k8s.lgbm_mae_days}d
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums text-muted-foreground">
                            {data.leakage.honest_metrics.k8s.naive_mae_days}d
                          </td>
                          <td className="py-1.5 text-xs tabular-nums">
                            {(data.leakage.honest_metrics.k8s.ci_coverage * 100).toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 pr-4 text-xs font-mono">vscode</td>
                          <td className="py-1.5 pr-4 text-xs font-medium text-amber-700 dark:text-amber-400">
                            {data.leakage.honest_metrics.vscode.improvement_pct}
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums">
                            {data.leakage.honest_metrics.vscode.lgbm_mae_days}d
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums text-muted-foreground">
                            {data.leakage.honest_metrics.vscode.naive_mae_days}d
                          </td>
                          <td className="py-1.5 text-xs tabular-nums text-amber-700 dark:text-amber-400">
                            {(data.leakage.honest_metrics.vscode.ci_coverage * 100).toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Interval coverage here is the raw Q10–Q90 interval on the full test split (before
                    conformal adjustment). Section 5 reports the conformal (CQR) coverage on a held-out
                    subset, which is a different measurement.
                  </p>
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>vscode:</strong> the LightGBM point estimate is worse than a naive median (
                    {vsc?.improvement_pct}, MAE {vsc?.lgbm_mae_days}d vs {vsc?.naive_mae_days}d
                    {vsc?.n_test != null ? `, n=${vsc.n_test}` : ""}) because there is no creation-time
                    signal that predicts resolution time for this repo, and its raw{data.conformal ? ` ${pct(data.conformal.target_coverage, 0)}` : ""} interval covers only{" "}
                    {vsc ? pct(vsc.ci_coverage) : "n/a"} of outcomes. The point estimate is still served,
                    with a low-confidence badge.
                    {vsc?.bucket_vs_naive_delta_pp != null && vsc.bucket_vs_naive_ci95_pp
                      ? ` The bucket classifier loses to the naive majority bucket by ${Math.abs(vsc.bucket_vs_naive_delta_pp).toFixed(2)}pp (95% CI [${vsc.bucket_vs_naive_ci95_pp[0].toFixed(2)}, ${vsc.bucket_vs_naive_ci95_pp[1].toFixed(2)}]), so vscode's bucket field is the naive prior, not the model.`
                      : ""}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Calibration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>2 · Classifier Calibration</span>
                  <Badge className="border border-green-300 bg-green-50 text-green-700 text-xs dark:border-green-700 dark:bg-green-950 dark:text-green-300">
                    ADR-0036 · ADR-0057
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {data.calibration.method}. Accuracy delta:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {data.calibration.test_accuracy_delta_pp}pp
                  </span>{" "}
                  — calibration reduces ECE without changing predictions.
                </p>
                {data.calibration.classifier && (
                  <p className="text-xs text-muted-foreground">
                    Classifier: {data.calibration.classifier}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">T_opt</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">ECE before (val)</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">ECE after (val)</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">ECE test</th>
                        <th className="py-2 text-left text-xs font-medium text-muted-foreground">ECE gold eval set</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["vscode", "microsoft_vscode", data.calibration.repos.microsoft_vscode],
                          ["k8s", "kubernetes_kubernetes", data.calibration.repos.kubernetes_kubernetes],
                        ] as const
                      ).map(([label, , repo]) => (
                        <tr key={label} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-4 text-xs font-mono">{label}</td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums">{repo.T_opt}</td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums text-muted-foreground">
                            {fmtOrNA(repo.ece_before_val)}
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums text-muted-foreground">
                            {fmtOrNA(repo.ece_after_val)}
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums font-medium text-foreground">
                            {repo.ece_test.toFixed(4)}
                          </td>
                          <td className="py-1.5 text-xs tabular-nums">{fmtOrNA(repo.ece_eval_set)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                  {data.calibration.ece_test_definition && (
                    <p>
                      <span className="font-medium text-foreground">ECE test:</span>{" "}
                      {data.calibration.ece_test_definition}
                    </p>
                  )}
                  {data.calibration.ece_eval_set_definition && (
                    <p>
                      <span className="font-medium text-foreground">ECE gold eval set:</span>{" "}
                      {data.calibration.ece_eval_set_definition}
                    </p>
                  )}
                  {data.calibration.val_ece_note && <p>{data.calibration.val_ece_note}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Judge Evaluation (current baseline only; retired-judge history removed) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>3 · LLM-as-Judge Evaluation</span>
                  <Badge className="border border-blue-300 bg-blue-50 text-blue-700 text-xs dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    ADR-0019
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!baseline || !baseline.overall ? (
                  <div className="rounded-md bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                    The current judge baseline is not available from the API right now. No score is
                    shown rather than a stale one.
                  </div>
                ) : (
                  <>
                    <div className="rounded-md bg-muted/50 px-4 py-3 text-xs space-y-1">
                      <p>
                        <span className="font-medium">Judge:</span>{" "}
                        <code className="font-mono">{baseline.judge_model ?? "unknown"}</code> (local
                        model, zero cost, reproducible without a live key).
                      </p>
                      <p>
                        <span className="font-medium">Current baseline:</span>{" "}
                        <span className="tabular-nums font-medium text-foreground">
                          {baseline.overall.mean.toFixed(2)}/{judgeMax}
                        </span>{" "}
                        mean over n={baseline.overall.n} gold-set issues (
                        {((baseline.overall.mean / judgeMax) * 100).toFixed(1)}%).
                      </p>
                      <p className="text-muted-foreground">
                        Scores from earlier judge models (Llama-70b, Cohere Command A) were measured on a
                        different gold set with a different judge and are not comparable, so they are not
                        shown here.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">n</th>
                            <th className="py-2 text-left text-xs font-medium text-muted-foreground">
                              Mean /{judgeMax}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(baseline.per_repo ?? {}).map(([repo, r]) => (
                            <tr key={repo} className="border-b border-border/50 last:border-0">
                              <td className="py-1.5 pr-4 text-xs font-mono">{repo}</td>
                              <td className="py-1.5 pr-4 text-xs tabular-nums">{r.n ?? "n/a"}</td>
                              <td className="py-1.5 text-xs tabular-nums font-medium">
                                {r.mean != null ? r.mean.toFixed(2) : "n/a"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {dimensionRepos.length > 0 ? (
                      <div className="space-y-4">
                        {dimensionRepos.map(([repo, dims]) => (
                          <div key={repo}>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                              Per-dimension mean — {repo}
                            </p>
                            <div className="space-y-1.5">
                              {Object.entries(dims).map(([dim, mean]) => {
                                const max = data.judge?.dimension_max?.[dim];
                                return (
                                  <div key={dim} className="flex items-center gap-2">
                                    <span className="w-48 shrink-0 text-xs text-muted-foreground truncate">
                                      {dim.replace(/_/g, " ")}
                                    </span>
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                      {max ? (
                                        <div
                                          className="h-full rounded-full bg-muted-foreground/50"
                                          style={{ width: `${Math.min(100, (mean / max) * 100)}%` }}
                                        />
                                      ) : null}
                                    </div>
                                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                                      {mean.toFixed(2)}
                                      {max ? `/${max}` : ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Per-dimension breakdown is not available from the API yet.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Section 4: Reranker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>4 · Cross-Encoder Reranker — Rejected</span>
                  <Badge className="border border-gray-300 bg-gray-50 text-gray-700 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    ADR-0006
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/50 px-4 py-3 text-xs space-y-1">
                  <p>
                    <span className="font-medium">Model tested:</span>{" "}
                    <code className="font-mono">{data.reranker.model_tested}</code>
                  </p>
                  <p>
                    <span className="font-medium">Robustness test:</span> n={data.reranker.phase2_robustness_n}
                    {data.reranker.phase2_n_bootstrap != null
                      ? `, ${data.reranker.phase2_n_bootstrap}-resample bootstrap`
                      : ", bootstrap CI"}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Metric</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                          Baseline (BGE FAISS)
                        </th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Reranker</th>
                        <th className="py-2 text-left text-xs font-medium text-muted-foreground">Delta / CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 pr-4 text-xs">Recall@5</td>
                        <td className="py-1.5 pr-4 text-xs tabular-nums font-mono">
                          {data.reranker.phase2_baseline_r5.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-4 text-xs tabular-nums font-mono">
                          {data.reranker.phase2_reranker_r5.toFixed(4)}
                        </td>
                        <td className="py-1.5 text-xs">
                          <span className="font-medium">{data.reranker.phase2_delta_pp}</span>
                          <span className="ml-2 text-muted-foreground font-mono">
                            {data.reranker.phase2_ci_95}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                  {data.reranker.phase2_verdict}
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Conformal Intervals */}
            {data.conformal && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>5 · Conformal Intervals (CQR)</span>
                    <Badge className="border border-purple-300 bg-purple-50 text-purple-700 text-xs dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      ADR-0010
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-muted/50 px-4 py-3 text-xs space-y-1">
                    <p>
                      <span className="font-medium">Method:</span> {data.conformal.method}
                    </p>
                    <p className="text-muted-foreground">{data.conformal.caveats}</p>
                  </div>

                  {/* Coverage table */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Empirical coverage (held-out test set, with 95% Wilson CI)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Target</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Empirical</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">95% Wilson CI</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">n (cal / test)</th>
                            <th className="py-2 text-left text-xs font-medium text-muted-foreground">Raw (no CQR), same subset</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              ["k8s", "kubernetes/kubernetes"],
                              ["vscode", "microsoft/vscode"],
                            ] as const
                          ).map(([label, key]) => {
                            const r = data.conformal!.by_repo[key];
                            return (
                              <tr key={key} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 pr-4 text-xs font-mono">{label}</td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums text-muted-foreground">
                                  {(data.conformal!.target_coverage * 100).toFixed(0)}%
                                </td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums font-medium text-foreground">
                                  {(r.empirical_coverage * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums font-mono text-muted-foreground">
                                  [{(r.coverage_ci95_lower * 100).toFixed(1)}%,{" "}
                                  {(r.coverage_ci95_upper * 100).toFixed(1)}%]
                                </td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums font-mono text-muted-foreground">
                                  {r.n_calibration != null && r.n_true_test != null
                                    ? `${r.n_calibration} / ${r.n_true_test}`
                                    : "n/a"}
                                </td>
                                <td className="py-1.5 text-xs tabular-nums text-muted-foreground">
                                  {(r.raw_interval_coverage * 100).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Width comparison */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Interval width — raw vs conformal
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Raw median</th>
                            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Conformal median</th>
                            <th className="py-2 text-left text-xs font-medium text-muted-foreground">Q (hours added)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              ["k8s", "kubernetes/kubernetes"],
                              ["vscode", "microsoft/vscode"],
                            ] as const
                          ).map(([label, key]) => {
                            const r = data.conformal!.by_repo[key];
                            return (
                              <tr key={key} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 pr-4 text-xs font-mono">{label}</td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums">
                                  {r.median_width_raw_days.toFixed(1)}d
                                </td>
                                <td className="py-1.5 pr-4 text-xs tabular-nums font-medium">
                                  {r.median_width_conformal_days.toFixed(1)}d
                                </td>
                                <td className="py-1.5 text-xs tabular-nums text-muted-foreground font-mono">
                                  +{r.q_adjustment_hours.toFixed(2)}h
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* vscode exchangeability note */}
                  {data.conformal.by_repo["microsoft/vscode"].exchangeability_note && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1">
                      <p>
                        <strong>vscode temporal drift:</strong>{" "}
                        {data.conformal.by_repo["microsoft/vscode"].exchangeability_note}
                      </p>
                      {data.conformal.by_repo["microsoft/vscode"].split_sensitivity && (
                        <p>
                          Split sensitivity: 30/70 split yields{" "}
                          {pct(data.conformal.by_repo["microsoft/vscode"].split_sensitivity!.split_30_70.empirical_coverage)}{" "}
                          empirical coverage; 40/60 yields{" "}
                          {pct(data.conformal.by_repo["microsoft/vscode"].split_sensitivity!.split_40_60.empirical_coverage)}{" "}
                          — a {data.conformal.by_repo["microsoft/vscode"].split_sensitivity!.divergence_pp}pp
                          divergence that reflects non-stationarity in the 2026 test window, not
                          calibration noise. See ADR-0010.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-4 px-4 mt-auto">
        <div className="mx-auto max-w-screen-lg text-center text-xs text-muted-foreground">
          <Link
            to="/"
            className="text-foreground underline decoration-1 underline-offset-4 decoration-muted-foreground hover:decoration-foreground transition-colors"
          >
            ← Back to TriageIQ
          </Link>
          {" · "}
          <a
            href="https://github.com/gaurav-gandhi-2411/triage-iq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground underline decoration-1 underline-offset-4 decoration-muted-foreground hover:decoration-foreground transition-colors"
          >
            API repo
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
