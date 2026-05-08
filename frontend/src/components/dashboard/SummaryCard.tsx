import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  href?: string;
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
  href,
}: SummaryCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (href) {
      navigate(href);
    }
  };

  // Dynamic font size based on value length to prevent overflow
  const getValueFontSize = (val: string | number): string => {
    const strValue = String(val);
    const length = strValue.length;
    
    if (length <= 4) return "text-3xl";
    if (length <= 6) return "text-2xl";
    if (length <= 8) return "text-xl";
    if (length <= 10) return "text-lg";
    return "text-base";
  };

  return (
    <div
      className={cn(
        "rounded-xl p-6 shadow-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1 opacity-0 animate-fade-in overflow-hidden",
        variantStyles[variant],
        href && "cursor-pointer"
      )}
      style={{ animationDelay: `${delay}ms` }}
      onClick={handleClick}
      role={href ? "button" : undefined}
      tabIndex={href ? 0 : undefined}
      onKeyDown={href ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 min-w-0 flex-1 mr-2">
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
              "font-bold tracking-tight",
              getValueFontSize(value),
              variant === "total" ? "text-primary-foreground" : "text-foreground"
            )}
            title={String(value)}
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
