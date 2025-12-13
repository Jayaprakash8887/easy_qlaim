import { forwardRef, ReactNode } from "react";
import { Zap, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SmartFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  isAutoPopulated?: boolean;
  validationStatus?: "valid" | "invalid" | "none";
  error?: string;
  hint?: string;
  multiline?: boolean;
}

export const SmartFormField = forwardRef<HTMLInputElement | HTMLTextAreaElement, SmartFormFieldProps>(
  ({ label, isAutoPopulated, validationStatus = "none", error, hint, multiline, className, ...props }, ref) => {
    const ValidationIcon = () => {
      if (validationStatus === "valid") {
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      }
      if (validationStatus === "invalid") {
        return <XCircle className="h-4 w-4 text-destructive" />;
      }
      return null;
    };

    const inputClasses = cn(
      "pr-10 transition-all",
      validationStatus === "valid" && "border-success focus-visible:ring-success",
      validationStatus === "invalid" && "border-destructive focus-visible:ring-destructive",
      isAutoPopulated && "bg-accent/5 border-accent/30",
      className
    );

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {label}
            {isAutoPopulated && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                <Zap className="h-2.5 w-2.5" />
                Auto
              </span>
            )}
          </label>
          <ValidationIcon />
        </div>

        <div className="relative">
          {multiline ? (
            <Textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className={inputClasses}
              {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <Input
              ref={ref as React.Ref<HTMLInputElement>}
              className={inputClasses}
              {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

SmartFormField.displayName = "SmartFormField";
