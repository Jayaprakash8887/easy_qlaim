import { CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface PolicyCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning" | "checking";
  message?: string;
}

interface ReceiptPolicyChecksProps {
  checks: PolicyCheck[];
  receiptIndex: number;
  isCompact?: boolean;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    className: "text-green-600",
    bgClassName: "bg-green-50 dark:bg-green-900/20",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  fail: {
    icon: XCircle,
    className: "text-red-600",
    bgClassName: "bg-red-50 dark:bg-red-900/20",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  warning: {
    icon: AlertCircle,
    className: "text-amber-600",
    bgClassName: "bg-amber-50 dark:bg-amber-900/20",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  checking: {
    icon: Loader2,
    className: "text-gray-500",
    bgClassName: "bg-gray-50 dark:bg-gray-800",
    badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function ReceiptPolicyChecks({ checks, receiptIndex, isCompact = false }: ReceiptPolicyChecksProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const totalCount = checks.length;
  
  const allPassed = passCount === totalCount;
  const hasFailures = failCount > 0;
  const hasWarnings = warningCount > 0;

  // Summary badge styling based on overall status
  const getSummaryStyle = () => {
    if (hasFailures) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    if (hasWarnings) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
    if (allPassed) return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
  };

  // Compact inline badge view
  if (isCompact) {
    return (
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded border", getSummaryStyle())}>
          {passCount}/{totalCount}
        </span>
        {hasFailures && <span className="text-xs text-red-600">{failCount} issue{failCount > 1 ? 's' : ''}</span>}
        {!hasFailures && hasWarnings && <span className="text-xs text-amber-600">{warningCount} warning{warningCount > 1 ? 's' : ''}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 ml-7">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left",
          isExpanded ? "rounded-b-none border-b-0" : "",
          getSummaryStyle()
        )}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">Policy Checks</span>
          <span className="text-xs opacity-75">
            {passCount}/{totalCount} passed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick status indicators */}
          <div className="flex items-center gap-1">
            {failCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs">
                <XCircle className="h-3 w-3" />
                {failCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                {warningCount}
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={cn(
          "border border-t-0 rounded-b-lg p-2 space-y-1.5",
          hasFailures ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" :
          hasWarnings ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10" :
          "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
        )}>
          {checks.map((check) => {
            const config = statusConfig[check.status];
            const Icon = config.icon;

            return (
              <div
                key={check.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs",
                  config.bgClassName
                )}
              >
                <div className={cn("shrink-0 mt-0.5", config.className)}>
                  <Icon 
                    className="h-3.5 w-3.5" 
                    style={{ animation: check.status === 'checking' ? 'spin 1s linear infinite' : 'none' }} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium", config.className)}>
                    {check.label}
                  </p>
                  {check.message && (
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
                      {check.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Summary component for the sidebar showing aggregate of all receipts
interface ReceiptsPolicySummaryProps {
  allReceiptChecks: { receiptIndex: number; checks: PolicyCheck[] }[];
}

export function ReceiptsPolicySummary({ allReceiptChecks }: ReceiptsPolicySummaryProps) {
  const totalReceipts = allReceiptChecks.length;
  const receiptsWithIssues = allReceiptChecks.filter(r => 
    r.checks.some(c => c.status === 'fail' || c.status === 'warning')
  ).length;
  const receiptsAllPassed = totalReceipts - receiptsWithIssues;

  // Aggregate all checks
  const allChecks = allReceiptChecks.flatMap(r => r.checks);
  const totalChecks = allChecks.length;
  const passedChecks = allChecks.filter(c => c.status === 'pass').length;
  const failedChecks = allChecks.filter(c => c.status === 'fail').length;
  const warningChecks = allChecks.filter(c => c.status === 'warning').length;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          Policy Summary
        </h4>
        <span className={cn(
          "text-sm font-medium px-2 py-0.5 rounded-full",
          failedChecks > 0 
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : warningChecks > 0
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        )}>
          {passedChecks}/{totalChecks}
        </span>
      </div>

      <div className="space-y-2">
        {/* Receipt Status Summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Receipts checked:</span>
          <span className="font-medium">{totalReceipts}</span>
        </div>
        
        {receiptsAllPassed > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All checks passed:
            </span>
            <span className="font-medium text-green-600">{receiptsAllPassed}</span>
          </div>
        )}
        
        {receiptsWithIssues > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              With issues:
            </span>
            <span className="font-medium text-amber-600">{receiptsWithIssues}</span>
          </div>
        )}

        {/* Breakdown */}
        <div className="pt-2 mt-2 border-t border-border">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-lg font-bold text-green-600">{passedChecks}</p>
              <p className="text-[10px] text-muted-foreground">Passed</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <p className="text-lg font-bold text-amber-600">{warningChecks}</p>
              <p className="text-[10px] text-muted-foreground">Warnings</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-lg font-bold text-red-600">{failedChecks}</p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          🤖 Each receipt validated against company policies
        </p>
      </div>
    </div>
  );
}
