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
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Clock, Loader2, Zap } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const REPOS = ["microsoft/vscode", "kubernetes/kubernetes"] as const;
type Repo = (typeof REPOS)[number];

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

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export default function App() {
  const [repo, setRepo] = useState<Repo>("microsoft/vscode");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [coldStart, setColdStart] = useState(false);
  const [result, setResult] = useState<TriagePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    const timer = setTimeout(() => setColdStart(true), 5000);

    try {
      const res = await fetch(`${API_BASE}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, body }),
      });

      clearTimeout(timer);
      setColdStart(false);

      if (res.status === 429) {
        setError("Rate limit reached (10 req/hour per IP). Try again later.");
        return;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(
          `Server error ${res.status}: ${(detail as { detail?: string }).detail ?? "unknown error"}`
        );
        return;
      }

      const data = (await res.json()) as TriagePlan;
      setResult(data);
    } catch {
      clearTimeout(timer);
      setColdStart(false);
      setError("Network error — is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            TriageIQ
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ML-powered GitHub issue triage — component, priority, resolution time
          </p>
        </div>

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
                  rows={5}
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
                    Triaging…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Triage
                  </>
                )}
              </Button>
            </form>

            {coldStart && loading && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Cold start detected — the API scales to zero. First request
                  may take ~25 seconds while models load.
                </span>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {result && <TriagePlanCard plan={result} />}
      </div>
    </div>
  );
}

function TriagePlanCard({ plan }: { plan: TriagePlan }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Triage Plan</CardTitle>
          <Badge className={PRIORITY_COLORS[plan.priority_guess] ?? ""}>
            {plan.priority_guess} priority
          </Badge>
        </div>
        <CardDescription className="mt-1">{plan.triage_summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Row label="Component">
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
            {plan.predicted_component}
          </span>
          <span className="ml-2 text-gray-500">
            ({(plan.component_confidence * 100).toFixed(0)}% confidence)
          </span>
        </Row>

        <Row label="Resolution estimate">
          {plan.expected_resolution_summary}{" "}
          <span className="text-gray-500">
            ({plan.expected_resolution_lower_days}–
            {plan.expected_resolution_upper_days} days)
          </span>
        </Row>

        <Row label="Priority rationale">{plan.priority_rationale}</Row>

        {plan.suggested_assignee_class && (
          <Row label="Suggested assignee">{plan.suggested_assignee_class}</Row>
        )}

        {plan.suggested_next_steps.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Next steps</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
              {plan.suggested_next_steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.similar_issues.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Similar issues</p>
            <ul className="space-y-1">
              {plan.similar_issues.map((iss) => (
                <li key={iss.number} className="flex items-start gap-2">
                  <span className="font-mono text-xs text-gray-500 mt-0.5">
                    #{iss.number}
                  </span>
                  <span className="text-gray-600">{iss.relevance_note}</span>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">
                    {(iss.similarity * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="border-t pt-3">
          <summary className="cursor-pointer text-xs text-gray-400 select-none">
            Raw JSON (_request_id: {plan._request_id.slice(0, 8)}…, llm_status:{" "}
            {plan._llm_status})
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-600">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-gray-600">{children}</p>
    </div>
  );
}
