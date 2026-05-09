import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const REPOS = ["microsoft/vscode", "kubernetes/kubernetes"] as const;
type Repo = (typeof REPOS)[number];

const TITLE_MAX = 512;
const BODY_MAX = 32000;

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

interface Sample {
  repo: Repo;
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Sample issues
// ---------------------------------------------------------------------------

const SAMPLES: Sample[] = [
  {
    repo: "microsoft/vscode",
    title: "Terminal cursor disappears after switching tabs",
    body: "When I switch between terminal tabs, the cursor stops blinking. I have to click into the terminal panel to make it appear again. This started after the 1.85 update on macOS.",
  },
  {
    repo: "microsoft/vscode",
    title: "json parsing breaks on large files",
    body: "When I open a 50MB JSON file, VS Code freezes for ~30 seconds, then sometimes the file appears corrupted afterwards. Reproducible with any large valid JSON.",
  },
  {
    repo: "microsoft/vscode",
    title: "[Error] unhandledError-potential listener LEAK detected",
    body: "Stack trace from vs/base/common/event.ts:1062 with multiple listeners not being properly disposed. Affecting telemetry in production builds.",
  },
  {
    repo: "kubernetes/kubernetes",
    title: "kubectl exec hangs on large stdout streams",
    body: "Running kubectl exec on a pod that produces large output (>10MB) causes the command to hang indefinitely. Must Ctrl-C to recover. Reproducible across kubectl 1.28+.",
  },
  {
    repo: "kubernetes/kubernetes",
    title: "Pod stuck in Terminating state for 30+ minutes",
    body: "After kubectl delete pod, the pod stays in Terminating phase for 30+ minutes despite having no finalizers and grace period of 0. Forcing deletion with --force --grace-period=0 works but should not be required.",
  },
  {
    repo: "kubernetes/kubernetes",
    title: "HPA scale-up triggered by spurious CPU metrics",
    body: "HorizontalPodAutoscaler scaling pods up based on transient CPU spikes that resolve in seconds. metrics-server reports stale data. Need a smoothing window.",
  },
];

// ---------------------------------------------------------------------------
// Async helpers for fade transitions
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const doubleRAF = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtDays(d: number): string {
  return `${d % 1 === 0 ? d.toFixed(0) : d.toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Priority config — intentional neutral tones; dark variants keep contrast
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
  medium:
    "bg-gray-200 text-gray-800 border-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500",
  high: "bg-gray-800 text-gray-100 border-gray-900 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-100",
};

// ---------------------------------------------------------------------------
// Theme toggle — cycles light → dark → system
// ---------------------------------------------------------------------------

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-8 shrink-0 self-center" />;

  const next =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      className="shrink-0 self-center"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Character counter
// ---------------------------------------------------------------------------

function CharCounter({ current, max }: { current: number; max: number }) {
  const ratio = current / max;
  const colorClass =
    ratio >= 1
      ? "text-destructive font-medium"
      : ratio >= 0.9
      ? "text-amber-500 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <p className={`text-right text-xs tabular-nums ${colorClass}`}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Sample issues popover
// ---------------------------------------------------------------------------

function SamplesPopover({ onSelect }: { onSelect: (s: Sample) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(o) => setOpen(o)}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Sparkles className="h-3.5 w-3.5" />
        Try a sample
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 max-h-[480px] overflow-y-auto"
        align="start"
        side="bottom"
      >
        <div className="border-b px-3 py-2 sticky top-0 bg-popover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sample issues
          </p>
        </div>
        {SAMPLES.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              onSelect(s);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors border-b last:border-0 focus-visible:bg-accent/40 outline-none"
          >
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">
                {s.title}
              </p>
              <Badge
                variant="outline"
                className="shrink-0 text-xs py-0 font-normal"
              >
                {s.repo.split("/")[0]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
              {s.body}
            </p>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{pct}%</span>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-muted-foreground/50 transition-all"
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
  const markerPct = range > 0 ? 50 : 0;

  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-visible">
        <div className="absolute inset-0 rounded-full bg-muted-foreground/20" />
        <div className="absolute inset-0 rounded-full bg-muted-foreground/30" />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-muted-foreground/70 border-2 border-background shadow-sm"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
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
      className="block rounded-lg border border-border bg-card p-3 hover:bg-accent/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1 text-xs font-mono font-medium text-brand">
          #{issue.number}
          <ExternalLink className="h-3 w-3 text-brand/60" />
        </span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug mb-2 line-clamp-2">
        {issue.relevance_note}
      </p>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-muted-foreground/40"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">Triage Plan</CardTitle>
          <Badge
            className={`shrink-0 border text-xs font-medium ${PRIORITY_BADGE[plan.priority_guess] ?? ""}`}
          >
            {plan.priority_guess} priority
          </Badge>
        </div>
        <CardDescription className="mt-2 text-sm leading-relaxed">
          {plan.triage_summary}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Component
            </p>
            <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
              {plan.predicted_component}
            </span>
            <ConfidenceBar value={plan.component_confidence} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resolution
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.expected_resolution_summary}
            </p>
            <ResolutionBar
              lower={plan.expected_resolution_lower_days}
              upper={plan.expected_resolution_upper_days}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Suggested assignee
            </p>
            <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
              {plan.suggested_assignee_class || "—"}
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Priority rationale
            </p>
            <p className="text-sm text-muted-foreground">{plan.priority_rationale}</p>
          </div>

          {plan.suggested_next_steps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next steps
              </p>
              <ol className="space-y-1.5">
                {plan.suggested_next_steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground"
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {plan.similar_issues.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Similar issues
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {plan.similar_issues.map((iss) => (
                  <SimilarIssueCard key={iss.number} issue={iss} repo={repo} />
                ))}
              </div>
            </div>
          )}
        </div>

        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer select-none text-xs text-brand">
            Raw JSON · request {plan._request_id.slice(0, 8)}… · {plan._llm_status}
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
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
  const [paneVisible, setPaneVisible] = useState(true);

  function handleSampleSelect(s: Sample) {
    setRepo(s.repo);
    setTitle(s.title);
    setBody(s.body);
  }

  async function doTriage() {
    if (loading || !title.trim()) return;

    // Fade out current content
    setPaneVisible(false);
    await sleep(200);

    setLoading(true);
    setResult(null);
    setError(null);
    setPaneVisible(true); // skeleton fades in

    try {
      const res = await fetch(`${API_BASE}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, body }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        console.error("Triage API error", res.status, detail);

        let msg: string;
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          const retryMsg = retryAfter
            ? `Try again in ${Math.ceil(Number(retryAfter) / 60)} minutes`
            : "Try again in a few minutes";
          msg = `Rate limit reached. ${retryMsg} (10/hour, 30/day).`;
        } else if (res.status >= 500) {
          msg = "The service hit an internal error. Try again.";
        } else {
          msg = `Unexpected error: ${res.status}. Try again.`;
        }

        // Skeleton → error
        setPaneVisible(false);
        await sleep(150);
        setLoading(false);
        setError(msg);
        await doubleRAF();
        setPaneVisible(true);
        return;
      }

      const data = (await res.json()) as TriagePlan;

      // Skeleton → result
      setPaneVisible(false);
      await sleep(150);
      setLoading(false);
      setResult(data);
      setHasSucceeded(true);
      await doubleRAF();
      setPaneVisible(true);
    } catch (err) {
      console.error("Triage network error", err);

      setPaneVisible(false);
      await sleep(150);
      setLoading(false);
      setError("Could not reach the triage service. Check your connection or try again.");
      await doubleRAF();
      setPaneVisible(true);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doTriage();
  }

  const submitLabel = loading
    ? hasSucceeded
      ? "Triaging…"
      : "Waking up service… (~25s)"
    : "Triage";

  const isDisabledForTitle = !title.trim() && !loading;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <header className="border-b border-border bg-background px-4 py-3 sm:py-4">
        <div className="mx-auto max-w-screen-xl flex items-center gap-4">
          <div className="h-8 w-8 shrink-0" />
          <div className="flex-1 text-center">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              TriageIQ
            </h1>
            <p className="text-xs text-muted-foreground">
              ML-powered GitHub issue triage — component, priority, resolution time
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Two-column layout */}
      <main className="mx-auto max-w-screen-xl px-3 py-4 sm:px-4 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT: form */}
          <div className="w-full lg:w-96 lg:shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Triage an issue</CardTitle>
                <CardDescription>
                  Paste a GitHub issue title and body to get a structured triage plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SamplesPopover onSelect={handleSampleSelect} />
                <form onSubmit={handleSubmit} className="mt-3 space-y-4">
                  {/* Repo selector */}
                  <div className="space-y-1">
                    <Label htmlFor="repo">Repository</Label>
                    <Select
                      value={repo}
                      onValueChange={(v) => setRepo(v as Repo)}
                    >
                      <SelectTrigger id="repo" className="w-full">
                        <SelectValue>
                          {(v: string) => v || "Select repository"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {REPOS.map((r) => (
                          <SelectItem key={r} value={r} label={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <a
                      href={`https://github.com/${repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 text-xs text-brand hover:underline w-fit"
                    >
                      <ExternalLink className="h-3 w-3" />
                      github.com/{repo}
                    </a>
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <Label htmlFor="title">Issue title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Editor crashes when opening large JSON files"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={TITLE_MAX}
                      required
                    />
                    <CharCounter current={title.length} max={TITLE_MAX} />
                  </div>

                  {/* Body */}
                  <div className="space-y-1">
                    <Label htmlFor="body">Issue body</Label>
                    <Textarea
                      id="body"
                      placeholder="Describe the bug, steps to reproduce, environment…"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={BODY_MAX}
                      rows={6}
                    />
                    <CharCounter current={body.length} max={BODY_MAX} />
                  </div>

                  {/* Submit — wrapped in tooltip when title is empty */}
                  <Tooltip disabled={!isDisabledForTitle}>
                    <TooltipTrigger className="block w-full">
                      <Button
                        type="submit"
                        disabled={loading || !title.trim()}
                        className="w-full bg-brand text-white hover:bg-brand/90 focus-visible:ring-brand/50"
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
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Enter an issue title to triage
                    </TooltipContent>
                  </Tooltip>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: result / skeleton / empty state — fades on transition */}
          <div
            className={`min-w-0 flex-1 transition-opacity duration-200 ${
              paneVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {loading && <TriagePlanSkeleton />}
            {!loading && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
                <AlertAction>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void doTriage()}
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Try again
                  </Button>
                </AlertAction>
              </Alert>
            )}
            {!loading && result && <TriagePlanCard plan={result} repo={repo} />}
            {!loading && !result && !error && (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground lg:h-full lg:min-h-64">
                Triage plan will appear here
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
