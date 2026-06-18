import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  pct: number;
  className?: string;
}

export function ConfidenceBadge({ pct, className }: Props) {
  if (pct >= 40) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>
        <Badge
          className={cn(
            "cursor-default border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
            className,
          )}
        >
          Low signal — naive prior
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed" side="bottom">
        No creation-time signal predicts resolution time for this repo. The system detects
        this (interval coverage {Math.round(pct)}%, confidence &lt; 40%) and falls back to
        the naive prior rather than shipping a less accurate prediction. Resolution estimates
        for this issue are approximate.
      </TooltipContent>
    </Tooltip>
  );
}
