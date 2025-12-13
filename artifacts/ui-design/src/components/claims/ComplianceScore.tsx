import { cn } from "@/lib/utils";

interface ComplianceScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ComplianceScore({ score, size = "md" }: ComplianceScoreProps) {
  const sizeConfig = {
    sm: { wrapper: "h-16 w-16", stroke: 4, text: "text-lg", label: "text-[8px]" },
    md: { wrapper: "h-24 w-24", stroke: 6, text: "text-2xl", label: "text-[10px]" },
    lg: { wrapper: "h-32 w-32", stroke: 8, text: "text-3xl", label: "text-xs" },
  };

  const config = sizeConfig[size];
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return "text-success stroke-success";
    if (score >= 50) return "text-warning stroke-warning";
    return "text-destructive stroke-destructive";
  };

  const getGradientId = () => {
    if (score >= 80) return "success-gradient";
    if (score >= 50) return "warning-gradient";
    return "destructive-gradient";
  };

  return (
    <div className={cn("relative", config.wrapper)}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="success-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--success))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
          <linearGradient id="warning-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--warning))" />
            <stop offset="100%" stopColor="hsl(38, 92%, 60%)" />
          </linearGradient>
          <linearGradient id="destructive-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--destructive))" />
            <stop offset="100%" stopColor="hsl(0, 84%, 70%)" />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={config.stroke}
          className="stroke-secondary"
        />
        
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          stroke={`url(#${getGradientId()})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold", config.text, getScoreColor().split(" ")[0])}>
          {score}%
        </span>
        <span className={cn("text-muted-foreground uppercase tracking-wider", config.label)}>
          Compliance
        </span>
      </div>
    </div>
  );
}
