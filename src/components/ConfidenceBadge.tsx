import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  beatsNaive: boolean;
  className?: string;
}

export function ConfidenceBadge({ beatsNaive, className }: Props) {
  if (beatsNaive) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>
        <Badge
          className={cn(
            "cursor-default border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
            className,
          )}
        >
          Model below naive baseline
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed" side="bottom">
        This repository's resolution model underperforms a naive median predictor in evaluation.
        This is a repo-level finding — the system surfaces it here rather than silently presenting
        a less accurate prediction. Per-issue bucket confidence is shown in "Under the Hood".
        See /eval for methodology and numbers.
      </TooltipContent>
    </Tooltip>
  );
}
