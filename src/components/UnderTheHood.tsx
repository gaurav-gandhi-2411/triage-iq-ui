import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ClassifierPrediction {
  label: string;
  confidence: number;
}

interface SimilarIssue {
  number: number;
  similarity: number;
  relevance_note: string;
}

interface UnderTheHoodProps {
  classifierTop3?: ClassifierPrediction[] | null;
  similarIssues: SimilarIssue[];
  resolutionLower: number;
  resolutionUpper: number;
  resolutionConfidencePct?: number;
  resolutionBucket?: string;
  llmStatus: string;
  llmCacheHit?: boolean | null;
}

export function UnderTheHood({
  classifierTop3,
  similarIssues,
  resolutionLower,
  resolutionUpper,
  resolutionConfidencePct,
  resolutionBucket,
  llmStatus,
  llmCacheHit,
}: UnderTheHoodProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors select-none"
      >
        <span className="font-medium uppercase tracking-wide">Under the hood</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Stage 1: Component Classifier */}
          <Stage
            number={1}
            title="Component Classifier"
            subtitle="TF-IDF + logistic regression, temperature-calibrated"
          >
            {classifierTop3 && classifierTop3.length > 0 ? (
              <div className="space-y-1.5">
                {classifierTop3.map((pred, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-32 shrink-0 truncate font-mono text-xs",
                        i === 0 ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {pred.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          i === 0 ? "bg-muted-foreground/70" : "bg-muted-foreground/30",
                        )}
                        style={{ width: `${Math.round(pred.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(pred.confidence * 100)}%
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-xs text-muted-foreground/70 italic">
                  Calibrated via temperature scaling — probabilities reflect true frequencies, not raw logit scores.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Top-3 predictions not available.</p>
            )}
          </Stage>

          <Separator />

          {/* Stage 2: Similar-Issue Retrieval */}
          <Stage
            number={2}
            title="Similar-Issue Retrieval"
            subtitle="BGE-base-en-v1.5 embeddings + FAISS index"
          >
            {similarIssues.length > 0 ? (
              <div className="space-y-1">
                {similarIssues.map((iss) => (
                  <div key={iss.number} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                      #{iss.number}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-muted-foreground/40"
                        style={{ width: `${Math.round(iss.similarity * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(iss.similarity * 100)}%
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-xs text-muted-foreground/70 italic">
                  Cosine similarity scores from the FAISS k-NN index. Reranker evaluated but rejected (CI crosses zero at n=300 — see Eval).
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No similar issues found.</p>
            )}
          </Stage>

          <Separator />

          {/* Stage 3: Resolution Estimator */}
          <Stage
            number={3}
            title="Resolution Estimator"
            subtitle="LightGBM quantile regression, ~77% interval coverage on k8s"
          >
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <DataRow label="Lower bound" value={`${resolutionLower.toFixed(1)}d`} />
                <DataRow label="Upper bound" value={`${resolutionUpper.toFixed(1)}d`} />
                {resolutionBucket && (
                  <DataRow label="Bucket" value={resolutionBucket} mono />
                )}
                {resolutionConfidencePct !== undefined && (
                  <DataRow
                    label="Bucket confidence"
                    value={`${resolutionConfidencePct.toFixed(1)}%`}
                    highlight={resolutionConfidencePct < 40}
                  />
                )}
              </div>
              {resolutionConfidencePct !== undefined && resolutionConfidencePct < 40 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                  Low confidence — no creation-time signal for this repo. Falling back to naive prior.
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground/70 italic">
                Trained on a created_at temporal split after leakage retraction (ADR-0009).
              </p>
            </div>
          </Stage>

          <Separator />

          {/* Stage 4: LLM Synthesis */}
          <Stage
            number={4}
            title="LLM Synthesis"
            subtitle="Groq llama-3.1-8b-instant, response-cached"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <DataRow
                label="Status"
                value={llmStatus === "ok" ? "ok" : llmStatus.replace(/_/g, " ")}
                mono
              />
              <DataRow
                label="Cache hit"
                value={
                  llmCacheHit === true ? "yes" : llmCacheHit === false ? "no" : "—"
                }
                mono
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70 italic">
              Cross-family LLM-as-judge score: 10.93/15 (72.9%) — see Eval for methodology.
            </p>
          </Stage>
        </div>
      )}
    </div>
  );
}

function Stage({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{number}·</span>
        <div>
          <span className="text-xs font-medium text-foreground">{title}</span>
          <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>
      <div className="ml-4">{children}</div>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          mono && "font-mono",
          highlight ? "text-amber-700 dark:text-amber-400 font-medium" : "text-foreground",
        )}
      >
        {value}
      </span>
    </>
  );
}
