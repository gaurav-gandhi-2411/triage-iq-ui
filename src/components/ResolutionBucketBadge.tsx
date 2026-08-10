import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  bucket?: string;
  confidencePct?: number;
  className?: string;
}

const LOW_CONFIDENCE_THRESHOLD = 40;

export function ResolutionBucketBadge({ bucket, confidencePct, className }: Props) {
  if (!bucket) return null;

  const isLowConfidence =
    confidencePct !== undefined && confidencePct < LOW_CONFIDENCE_THRESHOLD;

  const badge = (
    <Badge
      variant={isLowConfidence ? undefined : "outline"}
      className={cn(
        "cursor-default font-mono",
        isLowConfidence &&
          "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
        className,
      )}
    >
      ~{bucket}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-1">
      {confidencePct !== undefined ? (
        <Tooltip>
          <TooltipTrigger render={<span className="w-fit" />}>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed" side="bottom">
            Bucket classifier confidence: {confidencePct.toFixed(1)}%
            {isLowConfidence &&
              " — below the reliability threshold for this classifier. Treat the bucket as a rough estimate, not a committed timeframe."}
          </TooltipContent>
        </Tooltip>
      ) : (
        badge
      )}
      {isLowConfidence && (
        <span className="text-xs text-amber-700 dark:text-amber-400">
          low confidence — rough estimate only
        </span>
      )}
    </div>
  );
}
