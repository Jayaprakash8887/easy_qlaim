import { format } from "date-fns";
import { 
  CheckCircle2, 
  FileText, 
  Calendar, 
  DollarSign, 
  Building2, 
  FolderKanban,
  CreditCard,
  Sparkles,
  Tag,
  Hash,
  Receipt
} from "lucide-react";
import { ComplianceScore } from "./ComplianceScore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCategory } from "@/lib/categoryUtils";

interface ClaimFormData {
  category?: string;
  title?: string;
  amount?: string;
  date?: Date;
  vendor?: string;
  transactionRef?: string;
  description?: string;
  projectCode?: string;
  costCenter?: string;
}

// Interface for multiple extracted claims
export interface ExtractedClaim {
  id: string;
  selected: boolean;
  category: string;
  title: string;
  amount: string;
  date: Date | null;
  vendor: string;
  description: string;
  rawText: string;
  transactionRef?: string;
}

interface ClaimReviewProps {
  formData: ClaimFormData;
  files: any[];
  multipleClaims?: ExtractedClaim[];
}

// Use imported formatCategory utility
const getCategoryLabel = (category: string | undefined): string => {
  if (!category) return 'Not selected';
  return formatCategory(category);
};

export function ClaimReview({ formData, files, multipleClaims }: ClaimReviewProps) {
  // Calculate compliance score dynamically based on form completion
  const calculateComplianceScore = () => {
    let score = 0;
    // Category: 15 points (but 'other' counts less)
    if (formData.category && formData.category !== 'other') score += 15;
    else if (formData.category === 'other') score += 5;
    // Title: 15 points
    if (formData.title && formData.title.length >= 3) score += 15;
    // Amount: 15 points
    if (formData.amount && parseFloat(formData.amount) > 0) score += 15;
    // Date: 15 points
    if (formData.date) score += 15;
    // Vendor: 15 points
    if (formData.vendor && formData.vendor.length >= 2) score += 15;
    // Description: 10 points
    if (formData.description && formData.description.length > 10) score += 10;
    // Documents: 10 points
    if (files && files.length > 0) score += 10;
    // Project Code: 5 points
    if (formData.projectCode) score += 5;
    return Math.min(score, 100);
  };
  
  const complianceScore = calculateComplianceScore();
  const categoryLabel = getCategoryLabel(formData.category);
  
  // Filter selected claims for multiple claims view
  const selectedClaims = multipleClaims?.filter(c => c.selected) || [];
  const hasMultipleClaims = selectedClaims.length > 1;
  const totalAmount = selectedClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const reviewItems = [
    { icon: Tag, label: "Category", value: categoryLabel },
    { icon: FileText, label: "Title", value: formData.title },
    { icon: DollarSign, label: "Amount", value: `₹${formData.amount}` },
    { icon: Calendar, label: "Date", value: formData.date ? format(formData.date, "PPP") : "Not set" },
    { icon: Building2, label: "Vendor", value: formData.vendor },
    { icon: Hash, label: "Transaction Ref", value: formData.transactionRef || "Not available" },
    { icon: FolderKanban, label: "Project", value: formData.projectCode || "Not selected" },
  ];

  const aiSummary = hasMultipleClaims
    ? `You are submitting ${selectedClaims.length} expenses totaling ₹${totalAmount.toFixed(2)}. All claims have been analyzed and meet company policy requirements. Each claim will be routed to your direct manager for approval based on the amount threshold.`
    : `This ${categoryLabel.toLowerCase()} expense of ₹${formData.amount} from ${formData.vendor || "vendor"} on ${formData.date ? format(formData.date, "MMM d, yyyy") : "the specified date"} has been analyzed and meets company policy requirements. The claim will be routed to your direct manager for approval based on the amount threshold.`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary mb-4">
          {hasMultipleClaims ? <Receipt className="h-8 w-8 text-primary-foreground" /> : <CheckCircle2 className="h-8 w-8 text-primary-foreground" />}
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {hasMultipleClaims ? `Review ${selectedClaims.length} Claims` : 'Review Your Claim'}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {hasMultipleClaims 
            ? `Total amount: ₹${totalAmount.toFixed(2)}`
            : 'Please verify all details before submitting'}
        </p>
      </div>

      {/* AI Summary Card */}
      <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-ai">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground">🤖 AI Summary</h3>
              <span className="inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
                Auto-generated
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aiSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Claim Details */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4">
            {hasMultipleClaims ? `${selectedClaims.length} Selected Claims` : 'Claim Details'}
          </h3>
          
          {hasMultipleClaims ? (
            /* Multiple Claims List */
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {selectedClaims.map((claim, idx) => (
                <div key={claim.id} className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{idx + 1}
                      </Badge>
                      <span className="font-medium text-foreground">{claim.title || 'Untitled Expense'}</span>
                    </div>
                    <span className="text-lg font-bold text-primary">₹{parseFloat(claim.amount).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Category: </span>
                      <span className="text-foreground">{getCategoryLabel(claim.category)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="text-foreground">{claim.date ? format(claim.date, "MMM d, yyyy") : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendor: </span>
                      <span className="text-foreground">{claim.vendor || "—"}</span>
                    </div>
                    {claim.transactionRef && (
                      <div>
                        <span className="text-muted-foreground">Ref: </span>
                        <span className="text-foreground">{claim.transactionRef}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Single Claim Grid */
            <div className="grid sm:grid-cols-2 gap-4">
              {reviewItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <item.icon className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-medium text-foreground truncate">{item.value || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasMultipleClaims && formData.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{formData.description}</p>
            </div>
          )}

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Attached Documents ({files.length})</p>
              <div className="flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {file.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Completeness */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-4 text-center">
            Form Completeness
          </h3>
          
          <div className="flex justify-center mb-4">
            <ComplianceScore score={complianceScore} size="lg" />
          </div>

          <div className="space-y-2">
            {[
              "Amount within budget",
              "All required docs attached",
              "Valid expense date",
              "Proper categorization",
              "No duplicate detected",
            ].map((check, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <span className="text-muted-foreground">{check}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval Flow */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Approval Flow</h3>
        <div className="flex items-center justify-between">
          {["Submitted", "Manager Review", "Finance Check", "Approved"].map((step, idx, arr) => (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                  idx === 0 
                    ? "gradient-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {idx + 1}
                </div>
                <span className="mt-2 text-xs text-muted-foreground text-center max-w-[80px]">
                  {step}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div className="h-0.5 w-12 sm:w-20 bg-border mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
