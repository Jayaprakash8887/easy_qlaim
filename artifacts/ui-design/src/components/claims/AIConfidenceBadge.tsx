import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bot, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface AIConfidenceBadgeProps {
  score: number;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function AIConfidenceBadge({ score, showIcon = true, size = 'md' }: AIConfidenceBadgeProps) {
  const getConfig = (score: number) => {
    if (score >= 90) {
      return {
        label: 'High',
        className: 'bg-success/10 text-success border-success/20',
        icon: CheckCircle,
      };
    }
    if (score >= 70) {
      return {
        label: 'Medium',
        className: 'bg-warning/10 text-warning border-warning/20',
        icon: AlertTriangle,
      };
    }
    return {
      label: 'Low',
      className: 'bg-destructive/10 text-destructive border-destructive/20',
      icon: XCircle,
    };
  };

  const config = getConfig(score);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-medium',
        config.className,
        size === 'sm' && 'text-xs px-2 py-0.5'
      )}
    >
      {showIcon && <Bot className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {score}% {config.label}
    </Badge>
  );
}
