import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ClaimStatus } from '@/types';
import {
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Wallet,
} from 'lucide-react';

interface ClaimStatusBadgeProps {
  status: ClaimStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  ClaimStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; className: string }
> = {
  pending_manager: {
    label: 'Pending Manager',
    variant: 'outline',
    icon: Clock,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  pending_hr: {
    label: 'Pending HR',
    variant: 'outline',
    icon: Clock,
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  pending_finance: {
    label: 'Pending Finance',
    variant: 'outline',
    icon: Clock,
    className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  approved: {
    label: 'Approved',
    variant: 'default',
    icon: CheckCircle,
    className: 'bg-success/10 text-success border-success/20',
  },
  finance_approved: {
    label: 'Finance Approved',
    variant: 'default',
    icon: CheckCircle,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  returned: {
    label: 'Returned',
    variant: 'outline',
    icon: RotateCcw,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  settled: {
    label: 'Settled',
    variant: 'default',
    icon: Wallet,
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
};

export function ClaimStatusBadge({ status, showIcon = true, size = 'md' }: ClaimStatusBadgeProps) {
  const config = statusConfig[status];
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
      {showIcon && <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </Badge>
  );
}
