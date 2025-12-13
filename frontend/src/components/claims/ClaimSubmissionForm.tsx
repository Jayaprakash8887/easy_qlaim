import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, X, Receipt, Wallet, Phone, Clock, TrendingUp, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryGrid, Category } from "./CategoryGrid";
import { SmartClaimForm } from "./SmartClaimForm";
import { ClaimReview } from "./ClaimReview";
import { toast } from "@/hooks/use-toast";
import { allowancePolicies } from "@/data/mockAllowances";
import { AllowanceType } from "@/types/allowance";

const claimSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be greater than 0"
  ),
  date: z.date({ required_error: "Date is required" }),
  vendor: z.string().min(2, "Vendor name is required"),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  projectCode: z.string().optional(),
  costCenter: z.string().optional(),
});

type ClaimFormData = z.infer<typeof claimSchema>;

type ClaimTypeOption = 'reimbursement' | 'allowance';

const steps = [
  { id: 1, label: "Claim Type" },
  { id: 2, label: "Category" },
  { id: 3, label: "Details" },
  { id: 4, label: "Review" },
];

const typeIcons: Record<AllowanceType, React.ElementType> = {
  on_call: Phone,
  shift: Clock,
  work_incentive: TrendingUp,
  food: Utensils,
};

interface ClaimSubmissionFormProps {
  onClose: () => void;
}

export function ClaimSubmissionForm({ onClose }: ClaimSubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [claimType, setClaimType] = useState<ClaimTypeOption | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAllowance, setSelectedAllowance] = useState<AllowanceType | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [allowanceData, setAllowanceData] = useState({
    amount: '',
    periodStart: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    periodEnd: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    description: '',
    projectCode: '',
  });

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      title: "",
      amount: "",
      vendor: "",
      description: "",
      paymentMethod: "",
      projectCode: "",
      costCenter: "",
    },
  });

  const selectedPolicy = selectedAllowance
    ? allowancePolicies.find((p) => p.type === selectedAllowance)
    : null;

  const handleClaimTypeSelect = (type: ClaimTypeOption) => {
    setClaimType(type);
    setSelectedCategory(null);
    setSelectedAllowance(null);
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleAllowanceSelect = (type: AllowanceType) => {
    setSelectedAllowance(type);
  };

  const handleNext = async () => {
    // Step 1: Claim Type Selection
    if (currentStep === 1 && !claimType) {
      toast({
        title: "Please select a claim type",
        description: "Choose between Reimbursement or Allowance to continue",
        variant: "destructive",
      });
      return;
    }

    // Step 2: Category Selection
    if (currentStep === 2) {
      if (claimType === 'reimbursement' && !selectedCategory) {
        toast({
          title: "Please select a category",
          description: "Choose an expense category to continue",
          variant: "destructive",
        });
        return;
      }
      if (claimType === 'allowance' && !selectedAllowance) {
        toast({
          title: "Please select an allowance type",
          description: "Choose an allowance type to continue",
          variant: "destructive",
        });
        return;
      }
    }

    // Step 3: Form Validation
    if (currentStep === 3) {
      if (claimType === 'reimbursement') {
        const isValid = await form.trigger(["title", "amount", "date", "vendor"]);
        if (!isValid) {
          toast({
            title: "Please fill required fields",
            description: "Complete all required fields to continue",
            variant: "destructive",
          });
          return;
        }
      } else if (claimType === 'allowance' && !allowanceData.amount) {
        toast({
          title: "Please enter the amount",
          description: "Amount is required to continue",
          variant: "destructive",
        });
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    const claimTypeLabel = claimType === 'reimbursement' ? 'Reimbursement' : 'Allowance';
    toast({
      title: `${claimTypeLabel} Claim Submitted Successfully! 🎉`,
      description: "Your claim has been sent for approval. Track it in your dashboard.",
    });
    onClose();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">New Claim</h1>
          </div>

          {/* Step Indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all",
                    currentStep >= step.id
                      ? "gradient-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={cn(
                    "ml-2 text-sm font-medium",
                    currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-4 h-0.5 w-12",
                      currentStep > step.id ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Mobile Step Indicator */}
          <div className="sm:hidden text-sm text-muted-foreground">
            Step {currentStep} of {steps.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Step 1: Claim Type Selection */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Claim Type</h2>
              <p className="text-muted-foreground">Choose the type of claim you want to submit</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Reimbursement Option */}
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg",
                  claimType === 'reimbursement' && "ring-2 ring-primary shadow-lg"
                )}
                onClick={() => handleClaimTypeSelect('reimbursement')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Receipt className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Reimbursement</CardTitle>
                      <CardDescription>Expense claims with receipts</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Submit claims for business expenses such as travel, meals, equipment, and other out-of-pocket costs that require documentation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Travel</Badge>
                    <Badge variant="secondary">Meals</Badge>
                    <Badge variant="secondary">Equipment</Badge>
                    <Badge variant="secondary">+6 more</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Allowance Option */}
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg",
                  claimType === 'allowance' && "ring-2 ring-primary shadow-lg"
                )}
                onClick={() => handleClaimTypeSelect('allowance')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Allowance</CardTitle>
                      <CardDescription>Fixed or policy-based allowances</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Claim fixed allowances based on company policies such as on-call duty, shift work, incentives, and food allowances.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">On-Call</Badge>
                    <Badge variant="secondary">Shift</Badge>
                    <Badge variant="secondary">Incentive</Badge>
                    <Badge variant="secondary">Food</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Category Selection */}
        {currentStep === 2 && claimType === 'reimbursement' && (
          <CategoryGrid
            selectedCategory={selectedCategory?.id || null}
            onSelectCategory={handleCategorySelect}
          />
        )}

        {currentStep === 2 && claimType === 'allowance' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Allowance Type</h2>
              <p className="text-muted-foreground">Choose the allowance category that applies</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {allowancePolicies.map((policy) => {
                const Icon = typeIcons[policy.type];
                return (
                  <Card
                    key={policy.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg",
                      selectedAllowance === policy.type && "ring-2 ring-primary shadow-lg"
                    )}
                    onClick={() => handleAllowanceSelect(policy.type)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{policy.name}</CardTitle>
                            {policy.taxable && (
                              <Badge variant="secondary" className="text-xs mt-1">Taxable</Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="font-semibold">
                          ₹{policy.maxAmount.toLocaleString()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {policy.description}
                      </p>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Eligibility:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {policy.eligibilityRules.slice(0, 2).map((rule, idx) => (
                            <li key={idx}>• {rule}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Details Form */}
        {currentStep === 3 && claimType === 'reimbursement' && selectedCategory && (
          <SmartClaimForm
            category={selectedCategory}
            form={form}
            onFilesChange={setUploadedFiles}
          />
        )}

        {currentStep === 3 && claimType === 'allowance' && selectedAllowance && selectedPolicy && (
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Enter Allowance Details</CardTitle>
                <CardDescription>
                  Complete the form below to submit your {selectedPolicy.name.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <input
                      type="number"
                      className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                      value={allowanceData.amount}
                      onChange={(e) => setAllowanceData({ ...allowanceData, amount: e.target.value })}
                      max={selectedPolicy.maxAmount}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed: ₹{selectedPolicy.maxAmount.toLocaleString()}
                  </p>
                </div>

                {/* Period */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Period Start *</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                      value={allowanceData.periodStart}
                      onChange={(e) => setAllowanceData({ ...allowanceData, periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Period End *</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                      value={allowanceData.periodEnd}
                      onChange={(e) => setAllowanceData({ ...allowanceData, periodEnd: e.target.value })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                    rows={3}
                    placeholder="Add any additional details..."
                    value={allowanceData.description}
                    onChange={(e) => setAllowanceData({ ...allowanceData, description: e.target.value })}
                  />
                </div>

                {/* Project Code */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Code (Optional)</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="PRJ-2024-XXX"
                    value={allowanceData.projectCode}
                    onChange={(e) => setAllowanceData({ ...allowanceData, projectCode: e.target.value })}
                  />
                </div>

                {/* Policy Info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Policy Requirements:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedPolicy.eligibilityRules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && claimType === 'reimbursement' && selectedCategory && (
          <ClaimReview
            category={selectedCategory}
            formData={form.getValues()}
            files={uploadedFiles}
          />
        )}

        {currentStep === 4 && claimType === 'allowance' && selectedAllowance && selectedPolicy && (
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Allowance Claim</CardTitle>
                <CardDescription>Please verify all details before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Allowance Type:</span>
                    <span className="text-sm">{selectedPolicy.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Amount:</span>
                    <span className="text-sm font-semibold">₹{parseFloat(allowanceData.amount || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Period:</span>
                    <span className="text-sm">
                      {format(new Date(allowanceData.periodStart), 'MMM dd, yyyy')} - {format(new Date(allowanceData.periodEnd), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  {allowanceData.description && (
                    <div className="py-2 border-b">
                      <span className="text-sm font-medium block mb-1">Description:</span>
                      <span className="text-sm text-muted-foreground">{allowanceData.description}</span>
                    </div>
                  )}
                  {allowanceData.projectCode && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium">Project Code:</span>
                      <span className="text-sm">{allowanceData.projectCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-medium">Tax Status:</span>
                    <Badge variant={selectedPolicy.taxable ? "destructive" : "success"}>
                      {selectedPolicy.taxable ? "Taxable" : "Non-Taxable"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  currentStep === step.id
                    ? "w-6 bg-primary"
                    : currentStep > step.id
                    ? "bg-primary"
                    : "bg-border"
                )}
              />
            ))}
          </div>

          {currentStep < 4 ? (
            <Button variant="gradient" onClick={handleNext} className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="gradient" onClick={handleSubmit} className="gap-2">
              <Check className="h-4 w-4" />
              Submit Claim
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
