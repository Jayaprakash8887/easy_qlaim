import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolicyCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning" | "checking";
  message?: string;
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
    className: "text-muted-foreground animate-spin",
    bgClassName: "bg-secondary",
  },
};

export function PolicyChecks({ checks }: PolicyChecksProps) {
  const passCount = checks.filter((c) => c.status === "pass").length;
  const totalCount = checks.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
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

          return (
            <div
              key={check.id}
              className={cn(
                "flex items-start gap-3 rounded-lg p-3 transition-all",
                config.bgClassName
              )}
            >
              <div className={cn("shrink-0 mt-0.5", config.className)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  check.status === "pass" ? "text-foreground" : config.className
                )}>
                  {check.label}
                </p>
                {check.message && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {check.message}
                  </p>
                )}
              </div>
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
