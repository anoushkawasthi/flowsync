import { Badge } from '@/components/ui/badge';
import { stageColor, STAGE_INK } from '@/lib/theme-colors';
import { cn } from '@/lib/utils';

interface StageBadgeProps {
  stage: string;
  className?: string;
}

/**
 * The fill comes from the shared stage palette rather than a Tailwind class
 * map, so the badge and the analytics donut can never show a stage in two
 * different colours.
 */
export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <Badge
      className={cn('border-line', className)}
      style={{ backgroundColor: stageColor(stage), color: STAGE_INK }}
    >
      {stage}
    </Badge>
  );
}
