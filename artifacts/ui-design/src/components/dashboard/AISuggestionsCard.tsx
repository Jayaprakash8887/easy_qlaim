import { Sparkles, Receipt, Coffee, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AISuggestion {
  id: string;
  title: string;
  amount: string;
  category: string;
  icon: React.ReactNode;
  confidence: number;
}

const suggestions: AISuggestion[] = [
  {
    id: "1",
    title: "Uber Ride - Client Meeting",
    amount: "$34.50",
    category: "Transportation",
    icon: <Car className="h-4 w-4" />,
    confidence: 95,
  },
  {
    id: "2",
    title: "Starbucks - Team Coffee",
    amount: "$28.75",
    category: "Meals & Entertainment",
    icon: <Coffee className="h-4 w-4" />,
    confidence: 88,
  },
  {
    id: "3",
    title: "Office Supplies Receipt",
    amount: "$156.00",
    category: "Office Expenses",
    icon: <Receipt className="h-4 w-4" />,
    confidence: 92,
  },
];

export function AISuggestionsCard() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-card opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-ai">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">AI-Detected Claims</h3>
          <p className="text-sm text-muted-foreground">
            Auto-detected from your receipts
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1">
          <Sparkles className="h-3 w-3 text-accent" />
          <span className="text-xs font-medium text-accent">AI Powered</span>
        </div>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            className={cn(
              "group flex items-center gap-4 rounded-lg border border-border bg-background/50 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-background opacity-0 animate-slide-in-right"
            )}
            style={{ animationDelay: `${500 + index * 100}ms` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              {suggestion.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{suggestion.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{suggestion.category}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-success font-medium">
                  {suggestion.confidence}% match
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground">{suggestion.amount}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                Review & Submit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
          View all AI suggestions
        </Button>
      </div>
    </div>
  );
}
