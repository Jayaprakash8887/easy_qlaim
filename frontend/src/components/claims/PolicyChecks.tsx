import { CheckCircle2, XCircle, AlertCircle, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface PolicyCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning" | "checking";
  message?: string;
  details?: {
    frequency?: string;
    frequency_display?: string;
    period_start?: string;
    period_end?: string;
    cumulative_used?: number;
    claim_count?: number;
    new_total?: number;
    max_amount?: number;
    remaining_before?: number;
    remaining_after?: number;
    utilization_percent?: number;
    frequency_count?: number;
  };
}

interface PolicyChecksProps {
  checks: PolicyCheck[];
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    className: "text-success",
    bgClassName: "bg-success/10",
  },
  fail: {
    icon: XCircle,
    className: "text-destructive",
    bgClassName: "bg-destructive/10",
  },
  warning: {
    icon: AlertCircle,
    className: "text-warning",
    bgClassName: "bg-warning/10",
  },
  checking: {
    icon: Loader2,
    className: "text-muted-foreground",
    bgClassName: "bg-secondary",
  },
};

export function PolicyChecks({ checks }: PolicyChecksProps) {
  const passCount = checks.filter((c) => c.status === "pass").length;
  const totalCount = checks.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 relative isolate">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <span className="text-lg">📋</span>
          Policy Checks
        </h4>
        <span className={cn(
          "text-sm font-medium px-2.5 py-1 rounded-full",
          passCount === totalCount 
            ? "bg-success/10 text-success" 
            : "bg-warning/10 text-warning"
        )}>
          {passCount}/{totalCount}
        </span>
      </div>

      <div className="space-y-3">
        {checks.map((check) => {
          const config = statusConfig[check.status];
          const Icon = config.icon;
          // Handle both backend (cumulative_limit) and frontend (cumulative-limit) IDs
          const isCumulativeLimit = check.id === 'cumulative_limit' || check.id === 'cumulative-limit';
          const hasUtilization = isCumulativeLimit && check.details?.max_amount && check.details?.utilization_percent != null;

          return (
            <div
              key={check.id}
              className={cn(
                "rounded-lg p-3 transition-all overflow-hidden",
                config.bgClassName
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("shrink-0 mt-0.5", config.className)} style={{ transform: 'none' }}>
                  <Icon className="h-4 w-4" style={{ animation: check.status === 'checking' ? 'spin 1s linear infinite' : 'none' }} />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    check.status === "pass" ? "text-foreground" : config.className
                  )} style={{ transform: 'none' }}>
                    {check.label}
                  </p>
                  {check.message && (
                    <p className="text-xs text-muted-foreground mt-0.5" style={{ transform: 'none' }}>
                      {check.message}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Show utilization bar for cumulative limit check */}
              {hasUtilization && (
                <div className="mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {check.details?.frequency_display || 'Period'} utilization
                    </span>
                    <span className={cn(
                      "font-medium",
                      check.details!.utilization_percent! > 100 ? "text-destructive" :
                      check.details!.utilization_percent! > 80 ? "text-warning" :
                      "text-success"
                    )}>
                      {check.details!.utilization_percent!.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(check.details!.utilization_percent!, 100)} 
                    className={cn(
                      "h-2",
                      check.details!.utilization_percent! > 100 ? "[&>div]:bg-destructive" :
                      check.details!.utilization_percent! > 80 ? "[&>div]:bg-warning" :
                      "[&>div]:bg-success"
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>₹{(check.details?.cumulative_used || 0).toLocaleString('en-IN')}</span>
                    <span>₹{(check.details?.max_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {check.details?.remaining_after != null && check.details.remaining_after > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Remaining after this claim: ₹{check.details.remaining_after.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          🤖 AI continuously validates your claim against company policies
        </p>
      </div>
    </div>
  );
}
