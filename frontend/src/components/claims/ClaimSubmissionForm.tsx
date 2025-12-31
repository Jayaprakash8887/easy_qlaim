import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, X, Receipt, Wallet, Phone, Clock, TrendingUp, Utensils, Loader2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryGrid, Category } from "./CategoryGrid";
import { SmartClaimForm, ExtractedClaim, FieldSources, PolicyCheckItem } from "./SmartClaimForm";
import { ClaimReview } from "./ClaimReview";
import { ComplianceScore } from "./ComplianceScore";
import { PolicyChecks } from "./PolicyChecks";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateBatchClaimsWithDocument, BatchClaimItem } from "@/hooks/useClaims";
import { UploadedFile } from "./DocumentUpload";
import { useAllowancesByRegion, ExtractedClaimCategory } from "@/hooks/usePolicies";
import { useFormatting } from "@/hooks/useFormatting";
import { useProjects } from "@/hooks/useProjects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const claimSchema = z.object({
  category: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be greater than 0"
  ),
  date: z.date({ required_error: "Date is required" }),
  vendor: z.string().min(2, "Vendor name is required"),
  transactionRef: z.string().optional(),
  description: z.string().optional(),
  projectCode: z.string().optional(),
  costCenter: z.string().optional(),
});

type ClaimFormData = z.infer<typeof claimSchema>;

type ClaimTypeOption = 'reimbursement' | 'allowance';

const reimbursementSteps = [
  { id: 1, label: "Claim Type" },
  { id: 2, label: "Details" },
  { id: 3, label: "Review" },
];

const allowanceSteps = [
  { id: 1, label: "Claim Type" },
  { id: 2, label: "Category" },
  { id: 3, label: "Details" },
  { id: 4, label: "Review" },
];

// Helper to get an icon based on category code or name
const getAllowanceIcon = (categoryCode: string, categoryName: string): React.ElementType => {
  const code = categoryCode?.toLowerCase() || '';
  const name = categoryName?.toLowerCase() || '';
  
  if (code.includes('call') || name.includes('call')) return Phone;
  if (code.includes('shift') || name.includes('shift')) return Clock;
  if (code.includes('incentive') || name.includes('incentive')) return TrendingUp;
  if (code.includes('food') || name.includes('food') || name.includes('meal')) return Utensils;
  return DollarSign; // Default icon for other allowances
};

interface ClaimSubmissionFormProps {
  onClose: () => void;
}

export function ClaimSubmissionForm({ onClose }: ClaimSubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [claimType, setClaimType] = useState<ClaimTypeOption | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAllowanceId, setSelectedAllowanceId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extractedMultipleClaims, setExtractedMultipleClaims] = useState<ExtractedClaim[]>([]);
  const [singleFormFieldSources, setSingleFormFieldSources] = useState<FieldSources>({
    category: 'manual',
    title: 'manual',
    amount: 'manual',
    date: 'manual',
    vendor: 'manual',
    transactionRef: 'manual',
    description: 'manual',
    projectCode: 'manual',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track last processed file ID at parent level to prevent re-processing when navigating back
  const [lastProcessedFileId, setLastProcessedFileId] = useState<string | null>(null);
  // Track policy checks from SmartClaimForm to display in ClaimReview
  const [policyChecks, setPolicyChecks] = useState<PolicyCheckItem[]>([]);
  const { user } = useAuth();
  const createBatchClaimsWithDocument = useCreateBatchClaimsWithDocument();
  
  // Fetch allowances filtered by user's region
  const { data: allowancePolicies = [], isLoading: isLoadingAllowances } = useAllowancesByRegion(user?.region);
  
  // Fetch available projects for dropdown
  const { data: projects = [] } = useProjects();
  
  const { formatCurrency, getCurrencySymbol, formatDate } = useFormatting();
  
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
      category: "",
      title: "",
      amount: "",
      vendor: "",
      description: "",
      projectCode: "",
      costCenter: "",
    },
  });
  
  // Watch all form values for reactive updates
  const watchedFormValues = form.watch();

  const selectedPolicy = selectedAllowanceId
    ? allowancePolicies.find((p) => p.id === selectedAllowanceId)
    : null;

  // Calculate allowance form completeness score
  const allowanceFormCompleteness = useMemo(() => {
    if (!selectedPolicy) return 0;
    let score = 0;
    const totalFields = 4; // amount, periodStart, periodEnd, projectCode are required
    
    if (allowanceData.amount && parseFloat(allowanceData.amount) > 0) score += 1;
    if (allowanceData.periodStart) score += 1;
    if (allowanceData.periodEnd) score += 1;
    if (allowanceData.projectCode) score += 1;
    
    return Math.round((score / totalFields) * 100);
  }, [allowanceData, selectedPolicy]);
  
  // Generate policy checks for allowance form
  const allowancePolicyChecks = useMemo(() => {
    if (!selectedPolicy) return [];
    
    const checks: PolicyCheckItem[] = [];
    const amount = parseFloat(allowanceData.amount) || 0;
    
    // Amount limit check
    if (selectedPolicy.max_amount) {
      checks.push({
        id: 'amount-limit',
        label: 'Amount Limit',
        status: amount > 0 && amount <= selectedPolicy.max_amount ? 'pass' : amount > selectedPolicy.max_amount ? 'fail' : 'warning',
        message: amount > selectedPolicy.max_amount 
          ? `Amount exceeds maximum of ${formatCurrency(selectedPolicy.max_amount)}`
          : amount > 0 
            ? `Within limit of ${formatCurrency(selectedPolicy.max_amount)}`
            : 'Enter an amount'
      });
    }
    
    // Period validity check
    const startDate = allowanceData.periodStart ? new Date(allowanceData.periodStart) : null;
    const endDate = allowanceData.periodEnd ? new Date(allowanceData.periodEnd) : null;
    const today = new Date();
    
    if (startDate && endDate) {
      const isValidPeriod = startDate <= endDate;
      const isFuturePeriod = endDate > today;
      checks.push({
        id: 'period-validity',
        label: 'Period Validity',
        status: isValidPeriod && !isFuturePeriod ? 'pass' : 'fail',
        message: !isValidPeriod 
          ? 'End date must be after start date'
          : isFuturePeriod
            ? 'Period end date cannot be in the future'
            : 'Valid claim period'
      });
    } else {
      checks.push({
        id: 'period-validity',
        label: 'Period Validity',
        status: 'warning',
        message: 'Select claim period dates'
      });
    }
    
    // Required amount check
    checks.push({
      id: 'amount-required',
      label: 'Amount Required',
      status: amount > 0 ? 'pass' : 'warning',
      message: amount > 0 ? 'Amount provided' : 'Enter claim amount'
    });
    
    // Project code check
    checks.push({
      id: 'project-code',
      label: 'Project Code',
      status: allowanceData.projectCode ? 'pass' : 'warning',
      message: allowanceData.projectCode ? `Project: ${allowanceData.projectCode}` : 'Select a project code'
    });
    
    return checks;
  }, [allowanceData, selectedPolicy, formatCurrency]);

  const handleClaimTypeSelect = (type: ClaimTypeOption) => {
    setClaimType(type);
    setSelectedCategory(null);
    setSelectedAllowanceId(null);
    // For reimbursements, skip category selection and go directly to details
    if (type === 'reimbursement') {
      setCurrentStep(2);
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleAllowanceSelect = (id: string) => {
    setSelectedAllowanceId(id);
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

    // For reimbursements: Step 2 is Details (validation)
    if (claimType === 'reimbursement' && currentStep === 2) {
      // First check if file is uploaded - mandatory
      if (uploadedFiles.length === 0) {
        toast({
          title: "Document Required",
          description: "Please upload a receipt or invoice to continue. File upload is mandatory.",
          variant: "destructive",
        });
        return;
      }
      
      const isValid = await form.trigger(["title", "amount", "date", "vendor"]);
      if (!isValid) {
        toast({
          title: "Please fill required fields",
          description: "Complete all required fields to continue",
          variant: "destructive",
        });
        return;
      }
    }

    // For allowances: Step 2 is Category Selection
    if (claimType === 'allowance' && currentStep === 2) {
      if (!selectedAllowanceId) {
        toast({
          title: "Please select an allowance type",
          description: "Choose an allowance type to continue",
          variant: "destructive",
        });
        return;
      }
    }

    // For allowances: Step 3 is Form Validation
    if (claimType === 'allowance' && currentStep === 3) {
      if (!allowanceData.amount) {
        toast({
          title: "Please enter the amount",
          description: "Amount is required to continue",
          variant: "destructive",
        });
        return;
      }
      if (!allowanceData.projectCode) {
        toast({
          title: "Please select a project",
          description: "Project code is required to continue",
          variant: "destructive",
        });
        return;
      }
    }

    const maxStep = claimType === 'reimbursement' ? 3 : 4;
    setCurrentStep((prev) => Math.min(prev + 1, maxStep));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    const claimTypeLabel = claimType === 'reimbursement' ? 'Reimbursement' : 'Allowance';
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found. Please select an employee first.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Check if we have multiple claims to submit
      const selectedClaims = extractedMultipleClaims.filter(c => c.selected);
      
      // Get the uploaded file if available
      const documentFile = uploadedFiles.length > 0 ? uploadedFiles[0].file : undefined;
      
      if (selectedClaims.length > 0) {
        // Prepare batch claims data
        const batchClaimItems: BatchClaimItem[] = selectedClaims.map(claim => ({
          category: claim.category || selectedCategory || 'miscellaneous',
          amount: parseFloat(claim.amount) || 0,
          claim_date: claim.date
            ? (typeof claim.date === 'string' ? claim.date.split('T')[0] : format(new Date(claim.date), 'yyyy-MM-dd'))
            : format(new Date(), 'yyyy-MM-dd'),
          title: claim.description?.slice(0, 50) || `${claim.category || 'Expense'} Claim`,
          vendor: claim.vendor || undefined,
          description: claim.description || undefined,
          transaction_ref: claim.transactionRef || undefined,
          // Field source tracking (ocr = auto-extracted, manual = user-entered)
          category_source: claim.fieldSources?.category || 'manual',
          title_source: claim.fieldSources?.title || 'manual',
          amount_source: claim.fieldSources?.amount || 'manual',
          date_source: claim.fieldSources?.date || 'manual',
          vendor_source: claim.fieldSources?.vendor || 'manual',
          description_source: claim.fieldSources?.description || 'manual',
          transaction_ref_source: claim.fieldSources?.transactionRef || 'manual',
        }));

        const batchPayload = {
          employee_id: user.id,
          claim_type: claimType === 'reimbursement' ? 'REIMBURSEMENT' as const : 'ALLOWANCE' as const,
          project_code: selectedClaims[0]?.projectCode || undefined,
          claims: batchClaimItems,
        };

        // Call the batch API with document
        const response = await createBatchClaimsWithDocument.mutateAsync({
          batchData: batchPayload,
          file: documentFile,
        });
        
        toast({
          title: `${response.total_claims} Claims Submitted Successfully! 🎉`,
          description: `Your ${response.total_claims} reimbursement claims totaling ${formatCurrency(response.total_amount)} have been sent for approval.${documentFile ? ' Document attached.' : ''} Claim IDs: ${response.claim_numbers.join(', ')}`,
        });
      } else {
        // Single claim from form data - use actual field sources from state
        const formData = form.getValues();
        const singleClaimItems: BatchClaimItem[] = [{
          category: formData.category || selectedCategory || 'miscellaneous',
          amount: parseFloat(formData.amount) || 0,
          claim_date: formData.date
            ? format(new Date(formData.date), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
          title: formData.title || `${formData.category || 'Expense'} Claim`,
          vendor: formData.vendor || undefined,
          transaction_ref: formData.transactionRef || undefined,
          description: formData.description || undefined,
          // Use actual field sources from single form tracking
          category_source: singleFormFieldSources.category === 'none' ? 'manual' : singleFormFieldSources.category,
          title_source: singleFormFieldSources.title === 'none' ? 'manual' : singleFormFieldSources.title,
          amount_source: singleFormFieldSources.amount === 'none' ? 'manual' : singleFormFieldSources.amount,
          date_source: singleFormFieldSources.date === 'none' ? 'manual' : singleFormFieldSources.date,
          vendor_source: singleFormFieldSources.vendor === 'none' ? 'manual' : singleFormFieldSources.vendor,
          description_source: singleFormFieldSources.description === 'none' ? 'manual' : singleFormFieldSources.description,
          transaction_ref_source: singleFormFieldSources.transactionRef === 'none' ? 'manual' : singleFormFieldSources.transactionRef,
        }];

        const batchPayload = {
          employee_id: user.id,
          claim_type: claimType === 'reimbursement' ? 'REIMBURSEMENT' as const : 'ALLOWANCE' as const,
          project_code: formData.projectCode || undefined,
          claims: singleClaimItems,
        };

        const response = await createBatchClaimsWithDocument.mutateAsync({
          batchData: batchPayload,
          file: documentFile,
        });
        
        toast({
          title: `${claimTypeLabel} Claim Submitted Successfully! 🎉`,
          description: `Your claim (${response.claim_numbers[0]}) has been sent for approval.${documentFile ? ' Document attached.' : ''} Track it in your dashboard.`,
        });
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to submit claims:', error);
      toast({
        title: "Submission Failed",
        description: error?.message || "Failed to submit claims. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">New Claim</h1>
          </div>

          {/* Step Indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {(claimType === 'reimbursement' ? reimbursementSteps : allowanceSteps).map((step, idx) => (
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
                {idx < (claimType === 'reimbursement' ? reimbursementSteps : allowanceSteps).length - 1 && (
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
            Step {currentStep} of {claimType === 'reimbursement' ? reimbursementSteps.length : allowanceSteps.length}
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

        {/* Step 2: Details Form for Reimbursement */}
        {currentStep === 2 && claimType === 'reimbursement' && (
          <SmartClaimForm
            form={form}
            onFilesChange={setUploadedFiles}
            uploadedFiles={uploadedFiles}
            onMultipleClaimsExtracted={(claims) => {
              setExtractedMultipleClaims(claims);
            }}
            onClaimsUpdated={(claims) => {
              setExtractedMultipleClaims(claims);
            }}
            onSingleFormFieldSourcesChange={(sources) => {
              setSingleFormFieldSources(sources);
            }}
            onPolicyChecksChange={setPolicyChecks}
            lastProcessedFileId={lastProcessedFileId}
            onLastProcessedFileIdChange={setLastProcessedFileId}
          />
        )}

        {/* Step 2: Category Selection for Allowance */}
        {currentStep === 2 && claimType === 'allowance' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Allowance Type</h2>
              <p className="text-muted-foreground">
                {user?.region 
                  ? `Showing allowances available for ${Array.isArray(user.region) ? user.region.join(', ') : user.region} region`
                  : 'Choose the allowance category that applies'}
              </p>
            </div>

            {isLoadingAllowances ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading allowances...</span>
              </div>
            ) : allowancePolicies.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No allowances available for your region ({Array.isArray(user?.region) ? user.region.join(', ') : (user?.region || 'Not specified')}).
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please contact HR if you believe this is an error.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {allowancePolicies.map((policy) => {
                  const Icon = getAllowanceIcon(policy.category_code, policy.category_name);
                  const eligibilityRules = policy.eligibility_criteria?.requirements || [];
                  return (
                    <Card
                      key={policy.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-lg",
                        selectedAllowanceId === policy.id && "ring-2 ring-primary shadow-lg"
                      )}
                      onClick={() => handleAllowanceSelect(policy.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{policy.category_name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {policy.description || 'No description available'}
                        </p>
                        {policy.max_amount && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Max Amount: {formatCurrency(policy.max_amount)}
                          </p>
                        )}
                        {eligibilityRules.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">Eligibility:</p>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              {eligibilityRules.slice(0, 2).map((rule, idx) => (
                                <li key={idx}>• {rule}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Allowance Details Form */}
        {currentStep === 3 && claimType === 'allowance' && selectedAllowanceId && selectedPolicy && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Main Form - Left side */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Enter Allowance Details</CardTitle>
                  <CardDescription>
                    Complete the form below to submit your {selectedPolicy.category_name.toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{getCurrencySymbol()}</span>
                      <input
                        type="number"
                        className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                        placeholder="0.00"
                        value={allowanceData.amount}
                        onChange={(e) => setAllowanceData({ ...allowanceData, amount: e.target.value })}
                        max={selectedPolicy.max_amount || undefined}
                      />
                    </div>
                    {selectedPolicy.max_amount && (
                      <p className="text-xs text-muted-foreground">
                        Maximum allowed: {formatCurrency(selectedPolicy.max_amount)}
                      </p>
                    )}
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
                    <label className="text-sm font-medium">Project Code *</label>
                    <Select
                      value={allowanceData.projectCode}
                      onValueChange={(value) => setAllowanceData({ ...allowanceData, projectCode: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.filter(p => p.status === 'active').map((project) => (
                          <SelectItem key={project.id} value={project.code}>
                            {project.code} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Policy Info - Only show if there are eligibility requirements */}
                  {(selectedPolicy.eligibility_criteria?.requirements || []).length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Eligibility Requirements:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {(selectedPolicy.eligibility_criteria?.requirements || []).map((rule, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Right side */}
            <div className="space-y-6">
              <div className="sticky top-24">
                {/* Form Completeness Card */}
                <div className="rounded-xl border border-border bg-card p-5 mb-6 overflow-hidden">
                  <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                    <span className="text-lg">📋</span>
                    Form Completeness
                  </h4>
                  <div className="flex justify-center overflow-hidden">
                    <ComplianceScore score={allowanceFormCompleteness} size="lg" />
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    {allowanceFormCompleteness >= 100
                      ? "Great! Your form is complete and ready to submit"
                      : allowanceFormCompleteness >= 50
                        ? "Almost there! Complete the missing fields"
                        : "Fill in required fields to complete your claim"}
                  </p>
                </div>

                {/* Policy Checks */}
                <PolicyChecks checks={allowancePolicyChecks} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review for Reimbursement */}
        {currentStep === 3 && claimType === 'reimbursement' && (
          <ClaimReview
            formData={watchedFormValues}
            files={uploadedFiles}
            multipleClaims={extractedMultipleClaims.length > 1 ? extractedMultipleClaims : undefined}
            policyChecks={policyChecks}
          />
        )}

        {currentStep === 4 && claimType === 'allowance' && selectedAllowanceId && selectedPolicy && (
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
                    <span className="text-sm">{selectedPolicy.category_name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Amount:</span>
                    <span className="text-sm font-semibold">{formatCurrency(parseFloat(allowanceData.amount || '0'))}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Period:</span>
                    <span className="text-sm">
                      {formatDate(allowanceData.periodStart)} - {formatDate(allowanceData.periodEnd)}
                    </span>
                  </div>
                  {allowanceData.description && (
                    <div className="py-2 border-b">
                      <span className="text-sm font-medium block mb-1">Description:</span>
                      <span className="text-sm text-muted-foreground">{allowanceData.description}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Project Code:</span>
                    <span className="text-sm">{allowanceData.projectCode}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Region:</span>
                    <Badge variant="secondary">{selectedPolicy.policy_region}</Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-medium">Policy:</span>
                    <span className="text-sm text-muted-foreground">{selectedPolicy.policy_name}</span>
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
            {(claimType === 'reimbursement' ? reimbursementSteps : allowanceSteps).map((step) => (
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

          {currentStep < (claimType === 'reimbursement' ? 3 : 4) ? (
            <Button variant="gradient" onClick={handleNext} className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              variant="gradient" 
              onClick={handleSubmit} 
              className="gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Submit Claim
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
