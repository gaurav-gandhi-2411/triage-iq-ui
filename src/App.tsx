import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, Loader2, Zap } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const REPOS = ["microsoft/vscode", "kubernetes/kubernetes"] as const;
type Repo = (typeof REPOS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimilarIssue {
  number: number;
  similarity: number;
  relevance_note: string;
}

interface TriagePlan {
  predicted_component: string;
  component_confidence: number;
  similar_issues: SimilarIssue[];
  expected_resolution_summary: string;
  expected_resolution_lower_days: number;
  expected_resolution_upper_days: number;
  priority_guess: "low" | "medium" | "high";
  priority_rationale: string;
  suggested_assignee_class: string;
  suggested_next_steps: string[];
  triage_summary: string;
  _request_id: string;
  _llm_status: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtDays(d: number): string {
  return `${d % 1 === 0 ? d.toFixed(0) : d.toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-gray-200 text-gray-800 border-gray-400",
  high: "bg-gray-800 text-gray-100 border-gray-900",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-500">{pct}%</span>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gray-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ResolutionBar({
  lower,
  upper,
}: {
  lower: number;
  upper: number;
}) {
  const range = upper - lower;
  // midpoint marker position: centre of the range bar
  const markerPct = range > 0 ? 50 : 0;

  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full rounded-full bg-gray-100 overflow-visible">
        <div className="absolute inset-0 rounded-full bg-gray-200" />
        {/* filled portion: full bar since we show the whole range */}
        <div className="absolute inset-0 rounded-full bg-gray-300" />
        {/* median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gray-600 border-2 border-white shadow-sm"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{fmtDays(lower)}</span>
        <span>{fmtDays(upper)}</span>
      </div>
    </div>
  );
}

function SimilarIssueCard({
  issue,
  repo,
}: {
  issue: SimilarIssue;
  repo: Repo;
}) {
  const pct = Math.round(issue.similarity * 100);
  const url = `https://github.com/${repo}/issues/${issue.number}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1 text-xs font-mono font-medium text-gray-700">
          #{issue.number}
          <ExternalLink className="h-3 w-3 text-gray-400" />
        </span>
        <span className="text-xs text-gray-500">{pct}%</span>
      </div>
      <p className="text-xs text-gray-600 leading-snug mb-2 line-clamp-2">
        {issue.relevance_note}
      </p>
      <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gray-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </a>
  );
}

function TriagePlanSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-5">
        <Separator />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TriagePlanCard({ plan, repo }: { plan: TriagePlan; repo: Repo }) {
  return (
    <Card>
      {/* HEADER */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">Triage Plan</CardTitle>
          <Badge
            className={`shrink-0 border text-xs font-medium ${PRIORITY_BADGE[plan.priority_guess] ?? ""}`}
          >
            {plan.priority_guess} priority
          </Badge>
        </div>
        <CardDescription className="mt-2 text-sm leading-relaxed text-gray-700">
          {plan.triage_summary}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Separator />

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Component */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Component
            </p>
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
              {plan.predicted_component}
            </span>
            <ConfidenceBar value={plan.component_confidence} />
          </div>

          {/* Resolution */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Resolution
            </p>
            <p className="text-xs text-gray-600">
              {plan.expected_resolution_summary}
            </p>
            <ResolutionBar
              lower={plan.expected_resolution_lower_days}
              upper={plan.expected_resolution_upper_days}
            />
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Suggested assignee
            </p>
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
              {plan.suggested_assignee_class || "—"}
            </span>
          </div>
        </div>

        <Separator />

        {/* DETAILS */}
        <div className="space-y-5">
          {/* Priority rationale */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Priority rationale
            </p>
            <p className="text-sm text-gray-600">{plan.priority_rationale}</p>
          </div>

          {/* Next steps */}
          {plan.suggested_next_steps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Next steps
              </p>
              <ol className="space-y-1.5">
                {plan.suggested_next_steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    <span className="shrink-0 font-mono text-xs text-gray-400 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Similar issues */}
          {plan.similar_issues.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Similar issues
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {plan.similar_issues.map((iss) => (
                  <SimilarIssueCard key={iss.number} issue={iss} repo={repo} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Raw JSON */}
        <details className="border-t pt-3">
          <summary className="cursor-pointer select-none text-xs text-gray-400">
            Raw JSON · request {plan._request_id.slice(0, 8)}… · {plan._llm_status}
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-600">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [repo, setRepo] = useState<Repo>("microsoft/vscode");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [result, setResult] = useState<TriagePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, body }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        console.error("Triage API error", res.status, detail);
        if (res.status === 429) {
          setError("Rate limit reached. Try again in a few minutes (10/hour, 30/day).");
        } else if (res.status >= 500) {
          setError("The service hit an internal error. Try again.");
        } else {
          setError(`Unexpected error: ${res.status}. Try again.`);
        }
        return;
      }

      const data = (await res.json()) as TriagePlan;
      setResult(data);
      setHasSucceeded(true);
    } catch (err) {
      console.error("Triage network error", err);
      setError("Could not reach the triage service. Check your connection or try again.");
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = loading
    ? hasSucceeded
      ? "Triaging…"
      : "Waking up service… (~25s)"
    : "Triage";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-screen-xl text-center">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            TriageIQ
          </h1>
          <p className="text-xs text-gray-500">
            ML-powered GitHub issue triage — component, priority, resolution time
          </p>
        </div>
      </header>

      {/* Two-column layout */}
      <main className="mx-auto max-w-screen-xl px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT: form — fixed width on desktop */}
          <div className="w-full lg:w-96 lg:shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Triage an issue</CardTitle>
                <CardDescription>
                  Paste a GitHub issue title and body to get a structured triage plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <Label>Repository</Label>
                    <Select
                      value={repo}
                      onValueChange={(v) => setRepo(v as Repo)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPOS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="title">Issue title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Editor crashes when opening large JSON files"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="body">Issue body</Label>
                    <Textarea
                      id="body"
                      placeholder="Describe the bug, steps to reproduce, environment…"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !title.trim()}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {submitLabel}
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        {submitLabel}
                      </>
                    )}
                  </Button>
                </form>

              </CardContent>
            </Card>
          </div>

          {/* RIGHT: result / skeleton / empty state */}
          <div className="min-w-0 flex-1">
            {loading && <TriagePlanSkeleton />}
            {!loading && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!loading && result && <TriagePlanCard plan={result} repo={repo} />}
            {!loading && !result && !error && (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 lg:h-full lg:min-h-64">
                Triage plan will appear here
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
