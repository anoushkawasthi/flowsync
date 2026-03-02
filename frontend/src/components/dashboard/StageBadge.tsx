import { Badge } from '@/components/ui/badge';
import { STAGE_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StageBadgeProps {
  stage: string;
}

export function StageBadge({ stage }: StageBadgeProps) {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS['Setup'];

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {stage}
    </Badge>
  );
}
