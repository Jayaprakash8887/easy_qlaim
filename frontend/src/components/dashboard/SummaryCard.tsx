import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "pending" | "approved" | "rejected" | "total";
  delay?: number;
}

const variantStyles = {
  default: "bg-card",
  pending: "bg-card border-l-4 border-l-warning",
  approved: "bg-card border-l-4 border-l-success",
  rejected: "bg-card border-l-4 border-l-destructive",
  total: "gradient-primary text-primary-foreground",
};

const iconVariantStyles = {
  default: "bg-secondary text-secondary-foreground",
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  total: "bg-primary-foreground/20 text-primary-foreground",
};

export function SummaryCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  delay = 0,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-6 shadow-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1 opacity-0 animate-fade-in",
        variantStyles[variant]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p
            className={cn(
              "text-sm font-medium",
              variant === "total" ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight",
              variant === "total" ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last month
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg p-3",
            iconVariantStyles[variant]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
