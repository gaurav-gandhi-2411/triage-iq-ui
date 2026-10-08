import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  beatsNaive: boolean;
  // Absent (old servers) is treated as "model": existing behaviour is unchanged.
  pointSource?: "model" | "train_median";
  pointDays?: number | null;
  className?: string;
}

export const MEDIAN_BADGE_TOOLTIP =
  "The trained model for this repository did not beat a simple historical median in evaluation, so this estimate is the median resolution time of past closed issues, not a prediction for this issue. Use the range, not the single number.";

export function ConfidenceBadge({ beatsNaive, pointSource, pointDays, className }: Props) {
  if (pointSource === "train_median") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {typeof pointDays === "number" && Number.isFinite(pointDays) && (
          <span className="text-sm font-medium tabular-nums" data-testid="median-point">
            {pointDays.toFixed(1)} days
          </span>
        )}
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-default" />}>
            <Badge
              className={cn(
                "cursor-default border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
                className,
              )}
            >
              Historical median estimate
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed" side="bottom">
            {MEDIAN_BADGE_TOOLTIP}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
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
