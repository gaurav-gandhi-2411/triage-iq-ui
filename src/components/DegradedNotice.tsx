import { Info } from "lucide-react";
import { degradedCause } from "../lib/degraded";

// Shown in place of the LLM-written summary when the plan came from the ML signals only. It states what
// is still real and what is absent, so a degraded plan is never read as a full one.
export function DegradedNotice({ reason }: { reason?: string | null }) {
  return (
    <div
      role="status"
      data-testid="degraded-notice"
      className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm"
    >
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        The language model is busy, so this is an ML-only plan
      </p>
      <p className="mt-1 text-muted-foreground">{degradedCause(reason)}</p>
      <p className="mt-1.5 text-muted-foreground">
        <span className="font-medium text-foreground">Still real:</span> component and confidence,
        similar issues, and the expected resolution interval; they come from the trained models, not
        the language model.{" "}
        <span className="font-medium text-foreground">Not generated:</span> summary, priority,
        assignee and next steps. Try again in a minute for the full plan.
      </p>
    </div>
  );
}
