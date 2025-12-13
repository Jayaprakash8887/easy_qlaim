import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  icon: LucideIcon;
  title: string;
  maxAmount: string;
  requiredDocs: string[];
  isSelected: boolean;
  onClick: () => void;
}

export function CategoryCard({
  icon: Icon,
  title,
  maxAmount,
  requiredDocs,
  isSelected,
  onClick,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start p-5 rounded-xl border-2 transition-all duration-300 text-left",
        "hover:shadow-lg hover:-translate-y-1",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/30"
      )}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
          isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground group-hover:bg-primary/10"
        )}
      >
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Max:</span>
        <span className="text-sm font-medium text-primary">{maxAmount}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-border w-full">
        <p className="text-xs text-muted-foreground mb-1.5">Required docs:</p>
        <div className="flex flex-wrap gap-1">
          {requiredDocs.slice(0, 2).map((doc, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {doc}
            </span>
          ))}
          {requiredDocs.length > 2 && (
            <span className="text-xs text-muted-foreground">+{requiredDocs.length - 2}</span>
          )}
        </div>
      </div>
    </button>
  );
}
