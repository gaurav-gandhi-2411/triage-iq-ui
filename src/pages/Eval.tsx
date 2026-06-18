import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Monitor, ArrowLeft, ExternalLink } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

interface EvalSummary {
  leakage: {
    feature_removed: string;
    removal_reason: string;
    fixed_split: string;
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
      };
      vscode: {
        lgbm_mae_days: number;
        naive_mae_days: number;
        improvement_pct: string;
        ci_coverage: number;
        note: string;
      };
    };
  };
  calibration: {
    method: string;
    test_accuracy_delta_pp: number;
    repos: {
      microsoft_vscode: {
        T_opt: number;
        ece_before_val: number;
        ece_after_val: number;
        ece_test: number;
      };
      kubernetes_kubernetes: {
        T_opt: number;
        ece_before_val: number;
        ece_after_val: number;
        ece_test: number;
      };
    };
  };
  judge: {
    production_judge_model: string;
    cross_family_judge_model: string;
    n_issues_evaluated: number;
    w1_1_pre_calibration: { score: number; score_pct: number; max: number };
    w1_2_post_calibration: { score: number; score_pct: number; max: number; delta_vs_w1_1: string };
    production_llama_score: { score: number; score_pct: number; max: number };
    cross_family_validation: {
      cohere_score: number;
      llama_score: number;
      gap_pp: number;
      pearson_r: number;
      decision: string;
    };
    dimensions: Record<string, { max: number; production_mean: number }>;
  };
  reranker: {
    model_tested: string;
    phase2_robustness_n: number;
    phase2_baseline_r5: number;
    phase2_reranker_r5: number;
    phase2_delta_pp: string;
    phase2_ci_95: string;
    phase2_verdict: string;
  };
}

export default function Eval() {
  const [data, setData] = useState<EvalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    <span className="font-mono">{data.leakage.fixed_split}</span>{" "}
                    (was: <span className="font-mono">closed_at</span>)
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
                          <th className="py-2 text-left text-xs font-medium text-muted-foreground">CI coverage</th>
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
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>vscode:</strong> LightGBM underperforms a naive prior (−67.4%) because there is
                    no creation-time signal that predicts resolution time for this repo. The system detects
                    this (CI coverage 40.9%, confidence &lt; 40%) and falls back to the naive prior at
                    inference — which is why vscode results show the low-confidence badge. This is intentional
                    graceful degradation, not a bug.
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
                    ADR-0004
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Repo</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">T_opt</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">ECE before (val)</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">ECE after (val)</th>
                        <th className="py-2 text-left text-xs font-medium text-muted-foreground">ECE test</th>
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
                            {repo.ece_before_val.toFixed(4)}
                          </td>
                          <td className="py-1.5 pr-4 text-xs tabular-nums font-medium text-foreground">
                            {repo.ece_after_val.toFixed(4)}
                          </td>
                          <td className="py-1.5 text-xs tabular-nums">{repo.ece_test.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Judge Evaluation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>3 · LLM-as-Judge Evaluation</span>
                  <Badge className="border border-blue-300 bg-blue-50 text-blue-700 text-xs dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    ADR-0003 · ADR-0004
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/50 px-4 py-3 text-xs space-y-1">
                  <p>
                    <span className="font-medium">Cross-family judge:</span>{" "}
                    <code className="font-mono">{data.judge.cross_family_judge_model}</code> (Cohere) — not
                    one model grading its own homework.
                  </p>
                  <p>
                    <span className="font-medium">Production judge:</span>{" "}
                    <code className="font-mono">{data.judge.production_judge_model}</code> (Groq/Meta). Gap
                    to Cohere: {data.judge.cross_family_validation.gap_pp}pp, Pearson r ={" "}
                    {data.judge.cross_family_validation.pearson_r}.
                  </p>
                  <p className="text-muted-foreground">{data.judge.cross_family_validation.decision}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Phase</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Judge</th>
                        <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Score /15</th>
                        <th className="py-2 text-left text-xs font-medium text-muted-foreground">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground">W1.1 (pre-calibration)</td>
                        <td className="py-1.5 pr-4 text-xs font-mono">cohere</td>
                        <td className="py-1.5 pr-4 text-xs tabular-nums">
                          {data.judge.w1_1_pre_calibration.score.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-xs tabular-nums">
                          {data.judge.w1_1_pre_calibration.score_pct.toFixed(1)}%
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground">W1.2 (post-calibration)</td>
                        <td className="py-1.5 pr-4 text-xs font-mono">cohere</td>
                        <td className="py-1.5 pr-4 text-xs tabular-nums font-medium">
                          {data.judge.w1_2_post_calibration.score.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-xs tabular-nums font-medium">
                          {data.judge.w1_2_post_calibration.score_pct.toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground">Production (Llama-70b)</td>
                        <td className="py-1.5 pr-4 text-xs font-mono">llama</td>
                        <td className="py-1.5 pr-4 text-xs tabular-nums font-medium text-foreground">
                          {data.judge.production_llama_score.score.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-xs tabular-nums font-medium">
                          {data.judge.production_llama_score.score_pct.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Per-dimension breakdown (production)
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(data.judge.dimensions).map(([dim, d]) => (
                      <div key={dim} className="flex items-center gap-2">
                        <span className="w-48 shrink-0 text-xs text-muted-foreground truncate">
                          {dim.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-muted-foreground/50"
                            style={{ width: `${(d.production_mean / d.max) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                          {d.production_mean.toFixed(2)}/{d.max}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <span className="font-medium">Robustness test:</span> n={data.reranker.phase2_robustness_n},
                    1000-resample bootstrap
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
