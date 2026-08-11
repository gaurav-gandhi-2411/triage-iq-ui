import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LOW_CONFIDENCE_THRESHOLD_PCT = 40;

interface Props {
  bucket: string;
  confidencePct: number;
  className?: string;
}

export function ResolutionBucketBadge({ bucket, confidencePct, className }: Props) {
  const isLowConfidence = confidencePct < LOW_CONFIDENCE_THRESHOLD_PCT;

  return (
    <div className={cn("space-y-1", className)}>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-block cursor-default" />}>
          <Badge
            variant="outline"
            className={cn(
              "cursor-default font-mono text-xs font-medium",
              isLowConfidence &&
                "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
            )}
          >
            ~{bucket}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed" side="bottom">
          Coarse resolution-time bucket from the ordinal classifier ({confidencePct.toFixed(0)}%
          confidence). Supplemental to the day-range estimate above.
        </TooltipContent>
      </Tooltip>
      {isLowConfidence && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          low confidence — rough estimate only
        </p>
      )}
    </div>
  );
}
