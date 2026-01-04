import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, X, Receipt, Wallet, Phone, Clock, TrendingUp, Utensils, Loader2, DollarSign, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryGrid, Category } from "./CategoryGrid";
import { SmartClaimForm, ExtractedClaim, FieldSources, PolicyCheckItem } from "./SmartClaimForm";
import { ClaimReview } from "./ClaimReview";
import { ComplianceScore } from "./ComplianceScore";
import { PolicyChecks } from "./PolicyChecks";
import { CustomFieldsForm } from "./CustomFieldRenderer";
import { LocationPicker, LocationValue } from "@/components/ui/location-picker";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateBatchClaimsWithDocument, BatchClaimItem } from "@/hooks/useClaims";
import { UploadedFile } from "./DocumentUpload";
import { useAllowancesByRegion, ExtractedClaimCategory } from "@/hooks/usePolicies";
import { useFormatting } from "@/hooks/useFormatting";
import { useEmployeeProjectHistory } from "@/hooks/useEmployees";
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
const getAllowanceIcon = (categoryCode: string, categoryName: string, calculationType?: string): React.ElementType => {
  const code = categoryCode?.toLowerCase() || '';
  const name = categoryName?.toLowerCase() || '';

  // Distance-based categories get car icon
  if (calculationType === 'per_km') return Car;
  if (code.includes('convey') || name.includes('convey') || code.includes('travel') || name.includes('travel')) return Car;
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
  // Track category utilization for cumulative limit display
  const [categoryUtilization, setCategoryUtilization] = useState<{
    max_amount?: number;
    cumulative_used?: number;
    remaining?: number;
    utilization_percent?: number;
    frequency?: string;
    frequency_display?: string;
    period_start?: string;
    period_end?: string;
  } | null>(null);
  const { user } = useAuth();
  const createBatchClaimsWithDocument = useCreateBatchClaimsWithDocument();

  // Fetch allowances filtered by user's region
  const { data: allowancePolicies = [], isLoading: isLoadingAllowances } = useAllowancesByRegion(user?.region);

  // Fetch employee's project history (assigned projects) - same as SmartClaimForm
  const { data: projectHistory = [] } = useEmployeeProjectHistory(user?.id);

  const { formatCurrency, getCurrencySymbol, formatDate } = useFormatting();

  const [allowanceData, setAllowanceData] = useState({
    // Per-day calculation fields
    perDayRate: '',
    periodStart: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    periodEnd: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    leaveDays: '0', // Number of leaves/holidays to exclude from working days
    // Per-km (distance) calculation fields
    numTrips: '1',
    fromLocation: null as { lat: number; lng: number; address: string } | null,
    toLocation: null as { lat: number; lng: number; address: string } | null,
    // Common fields
    description: '',
    projectCode: '',
  });

  // State for custom field values
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Map project history to dropdown format and get active projects
  const activeProjects = useMemo(() => {
    const mappedProjects = projectHistory.map(allocation => ({
      id: allocation.project_id,
      code: allocation.project_code,
      name: allocation.project_name,
      status: allocation.status, // ACTIVE, COMPLETED, or REMOVED
    }));
    // Filter to only show active project assignments
    const active = mappedProjects.filter(p => p.status === 'ACTIVE');
    console.log('Employee projects:', mappedProjects.length, 'Active:', active.length, active.map(p => p.code));
    return active;
  }, [projectHistory]);

  // Auto-select project if user has only one active project assigned
  useEffect(() => {
    // Only auto-select if:
    // 1. There's exactly one active project
    // 2. projectCode hasn't been set yet (empty string)
    // 3. activeProjects array has loaded (length > 0 check is implicit in === 1)
    if (activeProjects.length === 1 && allowanceData.projectCode === '') {
      console.log('Auto-selecting project:', activeProjects[0].code);
      setAllowanceData(prev => ({
        ...prev,
        projectCode: activeProjects[0].code
      }));
    }
  }, [activeProjects, allowanceData.projectCode]);

  // Helper function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (
    lat1: number, lng1: number, 
    lat2: number, lng2: number
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Calculate distance between from and to locations
  const calculatedDistance = useMemo(() => {
    if (!allowanceData.fromLocation || !allowanceData.toLocation) return 0;
    return calculateDistance(
      allowanceData.fromLocation.lat,
      allowanceData.fromLocation.lng,
      allowanceData.toLocation.lat,
      allowanceData.toLocation.lng
    );
  }, [allowanceData.fromLocation, allowanceData.toLocation]);

  // Helper function to calculate working days (excluding weekends - Saturday & Sunday)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) return 0;

    let workingDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  // Get selected policy first (needed for calculations below)
  const selectedPolicy = selectedAllowanceId
    ? allowancePolicies.find((p) => p.id === selectedAllowanceId)
    : null;

  // Fetch category utilization when allowance is selected
  useEffect(() => {
    const fetchUtilization = async () => {
      if (!selectedPolicy?.category_code || !user?.id) {
        setCategoryUtilization(null);
        return;
      }
      
      try {
        const response = await fetch(
          `/api/v1/claims/category-utilization/${user.id}/${selectedPolicy.category_code}`
        );
        if (response.ok) {
          const data = await response.json();
          setCategoryUtilization(data);
        }
      } catch (error) {
        console.error('Failed to fetch category utilization:', error);
      }
    };
    
    fetchUtilization();
  }, [selectedPolicy?.category_code, user?.id]);

  // Calculate working days (excluding weekends)
  const workingDaysCount = useMemo(() => {
    return calculateWorkingDays(allowanceData.periodStart, allowanceData.periodEnd);
  }, [allowanceData.periodStart, allowanceData.periodEnd]);

  // Calculate net working days (excluding leaves/holidays)
  const leaveDaysCount = parseInt(allowanceData.leaveDays) || 0;
  const netWorkingDays = Math.max(0, workingDaysCount - leaveDaysCount);

  // Get the calculation type from selected policy (default to per_day for backward compatibility)
  const calculationType = selectedPolicy?.calculation_type || 'per_day';
  const ratePerUnit = selectedPolicy?.rate_per_unit || selectedPolicy?.max_amount || 0;

  // Calculate total amount based on calculation type
  const calculatedTotalAmount = useMemo(() => {
    if (!selectedPolicy) return 0;
    
    const calcType = selectedPolicy.calculation_type || 'per_day';
    
    if (calcType === 'per_day') {
      // Per day: Net working days × rate per day
      const perDayRate = parseFloat(allowanceData.perDayRate) || 0;
      return netWorkingDays * perDayRate;
    } else if (calcType === 'per_km') {
      // Per km: Distance × rate per km × number of trips
      const numTrips = parseInt(allowanceData.numTrips) || 1;
      const ratePerKm = selectedPolicy.rate_per_unit || 0;
      // Distance is one-way, so for round trips we multiply by 2 per trip
      return calculatedDistance * ratePerKm * numTrips * 2; // Round trip
    } else {
      // Fixed: No calculation, user will enter amount directly
      return 0;
    }
  }, [selectedPolicy, netWorkingDays, allowanceData.perDayRate, allowanceData.numTrips, calculatedDistance]);

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

  // Calculate allowance form completeness score based on calculation type
  const allowanceFormCompleteness = useMemo(() => {
    if (!selectedPolicy) return 0;
    
    const calcType = selectedPolicy.calculation_type || 'per_day';
    let score = 0;
    let totalFields = 2; // projectCode is always required, plus type-specific fields

    // Common field
    if (allowanceData.projectCode) score += 1;

    if (calcType === 'per_day') {
      totalFields = 4; // perDayRate, periodStart, periodEnd, projectCode
      if (allowanceData.perDayRate && parseFloat(allowanceData.perDayRate) > 0) score += 1;
      if (allowanceData.periodStart) score += 1;
      if (allowanceData.periodEnd) score += 1;
    } else if (calcType === 'per_km') {
      totalFields = 4; // fromLocation, toLocation, numTrips, projectCode
      if (allowanceData.fromLocation) score += 1;
      if (allowanceData.toLocation) score += 1;
      if (allowanceData.numTrips && parseInt(allowanceData.numTrips) > 0) score += 1;
    } else {
      // fixed - just need projectCode
      totalFields = 1;
    }

    return Math.round((score / totalFields) * 100);
  }, [allowanceData, selectedPolicy]);

  // Generate policy checks for allowance form based on calculation type
  const allowancePolicyChecks = useMemo(() => {
    if (!selectedPolicy) return [];

    const checks: PolicyCheckItem[] = [];
    const calcType = selectedPolicy.calculation_type || 'per_day';
    const perDayRate = parseFloat(allowanceData.perDayRate) || 0;
    const numTrips = parseInt(allowanceData.numTrips) || 1;
    const ratePerKm = selectedPolicy.rate_per_unit || 0;

    if (calcType === 'per_day') {
      // Per day rate check
      if (selectedPolicy.max_amount) {
        checks.push({
          id: 'per-day-rate',
          label: 'Per Day Rate',
          status: perDayRate > 0 && perDayRate <= selectedPolicy.max_amount ? 'pass' : perDayRate > selectedPolicy.max_amount ? 'fail' : 'warning',
          message: perDayRate > selectedPolicy.max_amount
            ? `${formatCurrency(perDayRate)}/day exceeds maximum of ${formatCurrency(selectedPolicy.max_amount)}/day`
            : perDayRate > 0
              ? `${formatCurrency(perDayRate)}/day (max: ${formatCurrency(selectedPolicy.max_amount)}/day)`
              : `Enter per day rate (max: ${formatCurrency(selectedPolicy.max_amount)}/day)`
        });
      } else {
        checks.push({
          id: 'per-day-rate',
          label: 'Per Day Rate',
          status: perDayRate > 0 ? 'pass' : 'warning',
          message: perDayRate > 0 ? `${formatCurrency(perDayRate)} per day` : 'Enter per day rate'
        });
      }

      // Working days check
      checks.push({
        id: 'working-days',
        label: 'Working Days',
        status: workingDaysCount > 0 ? 'pass' : 'warning',
        message: workingDaysCount > 0 
          ? `${workingDaysCount} working days in period${leaveDaysCount > 0 ? ` (excluding weekends)` : ''}`
          : 'Select valid period'
      });

      // Leave/Holiday deduction check (only show if there are leave days)
      if (leaveDaysCount > 0 || workingDaysCount > 0) {
        checks.push({
          id: 'leave-days',
          label: 'Leaves/Holidays',
          status: leaveDaysCount <= workingDaysCount ? 'pass' : 'fail',
          message: leaveDaysCount > workingDaysCount
            ? `Leave days (${leaveDaysCount}) cannot exceed working days (${workingDaysCount})`
            : leaveDaysCount > 0
              ? `${leaveDaysCount} leave/holiday day(s) deducted`
              : 'No leaves/holidays entered'
        });
      }

      // Net working days
      checks.push({
        id: 'net-working-days',
        label: 'Net Working Days',
        status: netWorkingDays > 0 ? 'pass' : 'warning',
        message: netWorkingDays > 0 
          ? `${netWorkingDays} billable days (${workingDaysCount} - ${leaveDaysCount} leaves)`
          : 'No billable days'
      });

      // Calculated total display
      checks.push({
        id: 'calculated-total',
        label: 'Calculated Total',
        status: calculatedTotalAmount > 0 ? 'pass' : 'warning',
        message: calculatedTotalAmount > 0
          ? `Total: ${formatCurrency(calculatedTotalAmount)} (${netWorkingDays} days × ${formatCurrency(perDayRate)}/day)`
          : 'Enter rate and period to calculate total'
      });

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
    } else if (calcType === 'per_km') {
      // Distance check
      checks.push({
        id: 'distance',
        label: 'Distance',
        status: calculatedDistance > 0 ? 'pass' : 'warning',
        message: calculatedDistance > 0 
          ? `${calculatedDistance.toFixed(1)} km one-way`
          : 'Select from and to locations'
      });

      // Number of trips check
      checks.push({
        id: 'num-trips',
        label: 'Number of Trips',
        status: numTrips > 0 ? 'pass' : 'warning',
        message: numTrips > 0 ? `${numTrips} round trip(s)` : 'Enter number of trips'
      });

      // Rate per KM (from policy)
      checks.push({
        id: 'rate-per-km',
        label: 'Rate per KM',
        status: ratePerKm > 0 ? 'pass' : 'warning',
        message: ratePerKm > 0 
          ? `${formatCurrency(ratePerKm)}/km (policy rate)`
          : 'Rate not configured in policy'
      });

      // Calculated total
      const totalKm = calculatedDistance * numTrips * 2; // Round trip
      checks.push({
        id: 'calculated-total',
        label: 'Calculated Total',
        status: calculatedTotalAmount > 0 ? 'pass' : 'warning',
        message: calculatedTotalAmount > 0
          ? `Total: ${formatCurrency(calculatedTotalAmount)} (${totalKm.toFixed(1)} km × ${formatCurrency(ratePerKm)}/km)`
          : 'Select locations to calculate total'
      });
    }

    // Project code check (common for all types)
    checks.push({
      id: 'project-code',
      label: 'Project Code',
      status: allowanceData.projectCode ? 'pass' : 'warning',
      message: allowanceData.projectCode ? `Project: ${allowanceData.projectCode}` : 'Select a project code'
    });

    // Cumulative limit check (based on fetched utilization data)
    if (categoryUtilization && categoryUtilization.max_amount) {
      const newTotal = (categoryUtilization.cumulative_used || 0) + calculatedTotalAmount;
      const newUtilization = (newTotal / categoryUtilization.max_amount) * 100;
      const remaining = categoryUtilization.max_amount - newTotal;
      
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = '';
      
      if (newTotal > categoryUtilization.max_amount) {
        status = 'fail';
        const excess = newTotal - categoryUtilization.max_amount;
        message = `Exceeds ${categoryUtilization.frequency_display || 'period'} limit by ${formatCurrency(excess)}`;
      } else if (newUtilization > 80) {
        status = 'warning';
        message = `${newUtilization.toFixed(1)}% of ${categoryUtilization.frequency_display || 'period'} limit used after this claim`;
      } else {
        message = `${formatCurrency(remaining)} remaining of ${formatCurrency(categoryUtilization.max_amount)} ${categoryUtilization.frequency_display || 'period'} limit`;
      }
      
      checks.push({
        id: 'cumulative-limit',
        label: 'Within Period Limit',
        status,
        message,
        details: {
          frequency: categoryUtilization.frequency,
          frequency_display: categoryUtilization.frequency_display,
          period_start: categoryUtilization.period_start,
          period_end: categoryUtilization.period_end,
          cumulative_used: categoryUtilization.cumulative_used,
          new_total: newTotal,
          max_amount: categoryUtilization.max_amount,
          remaining_before: categoryUtilization.remaining,
          remaining_after: remaining,
          utilization_percent: newUtilization,
        }
      });
    }

    return checks;
  }, [allowanceData, selectedPolicy, formatCurrency, workingDaysCount, netWorkingDays, leaveDaysCount, calculatedTotalAmount, calculatedDistance, categoryUtilization]);

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
    // Reset custom field values when allowance changes
    setCustomFieldValues({});
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
      const calcType = selectedPolicy?.calculation_type || 'per_day';
      
      // Period dates are required for all allowance types (needed for approvals)
      if (!allowanceData.periodStart || !allowanceData.periodEnd) {
        toast({
          title: "Please enter the claim period",
          description: "Start and end dates are required for all allowance claims",
          variant: "destructive",
        });
        return;
      }
      
      // Validate based on calculation type
      if (calcType === 'per_day') {
        if (!allowanceData.perDayRate || parseFloat(allowanceData.perDayRate) <= 0) {
          toast({
            title: "Please enter the per day rate",
            description: "Per day rate is required to calculate the allowance",
            variant: "destructive",
          });
          return;
        }
      } else if (calcType === 'per_km') {
        if (!allowanceData.fromLocation || !allowanceData.toLocation) {
          toast({
            title: "Please select locations",
            description: "From and To locations are required for distance-based calculation",
            variant: "destructive",
          });
          return;
        }
        if (calculatedDistance <= 0) {
          toast({
            title: "Invalid distance",
            description: "Please select valid locations to calculate distance",
            variant: "destructive",
          });
          return;
        }
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
      } else if (claimType === 'allowance' && selectedPolicy) {
        // Allowance claim - calculate total based on calculation type
        const calcType = selectedPolicy.calculation_type || 'per_day';
        
        // Generate appropriate title and description based on calculation type
        let claimTitle: string;
        let claimDescription: string;
        
        if (calcType === 'per_km') {
          const numTrips = parseInt(allowanceData.numTrips) || 1;
          const totalKm = calculatedDistance * numTrips * 2;
          claimTitle = `${selectedPolicy.category_name} - ${totalKm.toFixed(1)} km (${numTrips} trip${numTrips > 1 ? 's' : ''})`;
          claimDescription = allowanceData.description || 
            `${selectedPolicy.category_name} conveyance claim. ` +
            `From: ${allowanceData.fromLocation?.address || 'N/A'}. ` +
            `To: ${allowanceData.toLocation?.address || 'N/A'}. ` +
            `Distance: ${calculatedDistance.toFixed(1)} km one-way, ${numTrips} round trip(s), ` +
            `Total: ${totalKm.toFixed(1)} km @ ${formatCurrency(selectedPolicy.rate_per_unit || 0)}/km`;
        } else if (calcType === 'per_day') {
          claimTitle = `${selectedPolicy.category_name} - ${allowanceData.periodStart} to ${allowanceData.periodEnd} (${netWorkingDays} days)`;
          claimDescription = allowanceData.description || 
            `${selectedPolicy.category_name} allowance claim for period ${allowanceData.periodStart} to ${allowanceData.periodEnd}. ` +
            `Working days: ${workingDaysCount}, Leaves/holidays: ${leaveDaysCount}, Net billable days: ${netWorkingDays}, ` +
            `Per day rate: ${formatCurrency(parseFloat(allowanceData.perDayRate) || 0)}`;
        } else {
          // Fixed amount
          claimTitle = `${selectedPolicy.category_name} - Fixed Allowance`;
          claimDescription = allowanceData.description || `${selectedPolicy.category_name} fixed allowance claim`;
        }
        
        // Build calculation details for audit/reporting
        let calculationDetails: Record<string, unknown> = {
          calculation_type: calcType,
          rate_per_unit: selectedPolicy.rate_per_unit,
        };
        
        if (calcType === 'per_km') {
          const numTrips = parseInt(allowanceData.numTrips) || 1;
          const totalKm = calculatedDistance * numTrips * 2;
          calculationDetails = {
            ...calculationDetails,
            from_location: allowanceData.fromLocation,
            to_location: allowanceData.toLocation,
            distance_one_way_km: calculatedDistance,
            num_trips: numTrips,
            total_distance_km: totalKm,
            rate_per_km: selectedPolicy.rate_per_unit || 0,
          };
        } else if (calcType === 'per_day') {
          calculationDetails = {
            ...calculationDetails,
            period_start: allowanceData.periodStart,
            period_end: allowanceData.periodEnd,
            working_days: workingDaysCount,
            leave_days: leaveDaysCount,
            net_working_days: netWorkingDays,
            per_day_rate: parseFloat(allowanceData.perDayRate) || 0,
          };
        }

        const allowanceClaimItems: BatchClaimItem[] = [{
          category: selectedPolicy.category_code || selectedPolicy.category_name || 'allowance',
          amount: calculatedTotalAmount,
          claim_date: calcType === 'per_day' 
            ? (allowanceData.periodEnd || format(new Date(), 'yyyy-MM-dd'))
            : format(new Date(), 'yyyy-MM-dd'),
          title: claimTitle,
          vendor: undefined,
          transaction_ref: undefined,
          description: claimDescription,
          // Include custom field values merged with calculation details
          custom_fields: {
            ...customFieldValues,
            calculation_details: calculationDetails,
          },
          // Allowance claims are manually entered
          category_source: 'manual',
          title_source: 'manual',
          amount_source: 'manual',
          date_source: 'manual',
          vendor_source: 'manual',
          description_source: 'manual',
          transaction_ref_source: 'manual',
        }];

        const batchPayload = {
          employee_id: user.id,
          claim_type: 'ALLOWANCE' as const,
          project_code: allowanceData.projectCode || undefined,
          claims: allowanceClaimItems,
        };

        const response = await createBatchClaimsWithDocument.mutateAsync({
          batchData: batchPayload,
          file: undefined, // Allowance claims typically don't require documents
        });

        toast({
          title: `Allowance Claim Submitted Successfully! 🎉`,
          description: `Your ${selectedPolicy.category_name} claim (${response.claim_numbers[0]}) has been sent for approval. Track it in your dashboard.`,
        });
      } else {
        // Single reimbursement claim from form data - use actual field sources from state
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
          claim_type: 'REIMBURSEMENT' as const,
          project_code: formData.projectCode || undefined,
          claims: singleClaimItems,
        };

        const response = await createBatchClaimsWithDocument.mutateAsync({
          batchData: batchPayload,
          file: documentFile,
        });

        toast({
          title: `Reimbursement Claim Submitted Successfully! 🎉`,
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
          <div>
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
          <div>
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
                  const Icon = getAllowanceIcon(policy.category_code, policy.category_name, policy.calculation_type);
                  const eligibilityRules = policy.eligibility_criteria?.requirements || [];
                  const calcType = policy.calculation_type || 'per_day';
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
                            <Badge variant="outline" className="text-xs mt-1">
                              {calcType === 'per_km' ? 'Distance Based' : calcType === 'fixed' ? 'Fixed Amount' : 'Per Day'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {policy.description || 'No description available'}
                        </p>
                        {calcType === 'per_km' && policy.rate_per_unit && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Rate: {formatCurrency(policy.rate_per_unit)}/km
                          </p>
                        )}
                        {calcType === 'per_day' && policy.max_amount && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Max Rate: {formatCurrency(policy.max_amount)}/day
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  {/* Period - Common for all allowance types (needed for approvals) */}
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

                  {/* Leave Days / Holidays - Common for all allowance types (needed for approvals) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Leaves & Holidays (days to exclude)</label>
                    <input
                      type="number"
                      min="0"
                      max={workingDaysCount}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="0"
                      value={allowanceData.leaveDays}
                      onChange={(e) => setAllowanceData({ ...allowanceData, leaveDays: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter number of leave days or public holidays within the selected period
                    </p>
                  </div>

                  {/* Working Days Summary - Show for all types */}
                  {workingDaysCount > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Working Days (excl. weekends):</span>
                        <span className="font-medium">{workingDaysCount} days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Leaves/Holidays:</span>
                        <span className="font-medium text-destructive">- {leaveDaysCount} days</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-medium">
                        <span>Net Working Days:</span>
                        <span className="text-primary">{netWorkingDays} days</span>
                      </div>
                    </div>
                  )}

                  {/* Per Day Calculation Fields */}
                  {(selectedPolicy.calculation_type || 'per_day') === 'per_day' && (
                    <>
                      {/* Per Day Rate */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Per Day Rate *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{getCurrencySymbol()}</span>
                          <input
                            type="number"
                            className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                            placeholder="0.00"
                            value={allowanceData.perDayRate}
                            onChange={(e) => setAllowanceData({ ...allowanceData, perDayRate: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedPolicy.max_amount
                            ? `Maximum allowed: ${formatCurrency(selectedPolicy.max_amount)} per day`
                            : 'Enter the allowance rate per working day'}
                        </p>
                      </div>

                      {/* Calculated Total Display for per_day */}
                      {calculatedTotalAmount > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-foreground">Calculated Total Amount</p>
                              <p className="text-xs text-muted-foreground">
                                {netWorkingDays} net working days × {formatCurrency(parseFloat(allowanceData.perDayRate) || 0)} per day
                              </p>
                            </div>
                            <span className="text-xl font-bold text-primary">{formatCurrency(calculatedTotalAmount)}</span>
                          </div>
                          {selectedPolicy.max_amount && parseFloat(allowanceData.perDayRate) > selectedPolicy.max_amount && (
                            <p className="text-xs text-destructive mt-2">
                              ⚠️ Per day rate exceeds maximum allowed: {formatCurrency(selectedPolicy.max_amount)}/day
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Per KM (Distance) Calculation Fields */}
                  {selectedPolicy.calculation_type === 'per_km' && (
                    <>
                      {/* From/To Locations */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <LocationPicker
                          label="From Location"
                          value={allowanceData.fromLocation}
                          onChange={(value) => setAllowanceData({ ...allowanceData, fromLocation: value })}
                          required
                        />
                        <LocationPicker
                          label="To Location"
                          value={allowanceData.toLocation}
                          onChange={(value) => setAllowanceData({ ...allowanceData, toLocation: value })}
                          required
                        />
                      </div>

                      {/* Number of Trips */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Number of Round Trips *</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                          placeholder="1"
                          value={allowanceData.numTrips}
                          onChange={(e) => setAllowanceData({ ...allowanceData, numTrips: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Each round trip counts as going to the destination and coming back
                        </p>
                      </div>

                      {/* Distance and Rate Info */}
                      {calculatedDistance > 0 && (
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">One-way Distance:</span>
                            <span className="font-medium">{calculatedDistance.toFixed(1)} km</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Rate per KM:</span>
                            <span className="font-medium">{formatCurrency(selectedPolicy.rate_per_unit || 0)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Number of Trips:</span>
                            <span className="font-medium">{parseInt(allowanceData.numTrips) || 1} round trip(s)</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Distance:</span>
                            <span className="font-medium">{(calculatedDistance * (parseInt(allowanceData.numTrips) || 1) * 2).toFixed(1)} km</span>
                          </div>
                        </div>
                      )}

                      {/* Calculated Total Display for per_km */}
                      {calculatedTotalAmount > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-foreground">Calculated Total Amount</p>
                              <p className="text-xs text-muted-foreground">
                                {(calculatedDistance * (parseInt(allowanceData.numTrips) || 1) * 2).toFixed(1)} km × {formatCurrency(selectedPolicy.rate_per_unit || 0)}/km
                              </p>
                            </div>
                            <span className="text-xl font-bold text-primary">{formatCurrency(calculatedTotalAmount)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Fixed Amount - just description and project */}
                  {selectedPolicy.calculation_type === 'fixed' && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        This is a fixed amount allowance. Enter the amount during review.
                      </p>
                    </div>
                  )}

                  {/* Description - Common for all types */}
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

                  {/* Project Code - Common for all types */}
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
                        {activeProjects.map((project) => (
                          <SelectItem key={project.id} value={project.code}>
                            {project.code} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeProjects.length === 1 && (
                      <p className="text-xs text-muted-foreground">
                        Auto-selected (only assigned project)
                      </p>
                    )}
                  </div>

                  {/* Custom Fields - Render if the policy has custom fields */}
                  {selectedPolicy.custom_fields && selectedPolicy.custom_fields.length > 0 && (
                    <CustomFieldsForm
                      fields={selectedPolicy.custom_fields}
                      values={customFieldValues}
                      onChange={setCustomFieldValues}
                    />
                  )}

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
          <div>
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
                  
                  {/* Period - Common for all types */}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Period:</span>
                    <span className="text-sm">
                      {formatDate(allowanceData.periodStart)} - {formatDate(allowanceData.periodEnd)}
                    </span>
                  </div>
                  
                  {/* Working Days Info - Common for all types */}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Working Days:</span>
                    <span className="text-sm">{workingDaysCount} days</span>
                  </div>
                  {leaveDaysCount > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium">Leaves/Holidays:</span>
                      <span className="text-sm text-destructive">-{leaveDaysCount} days</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Net Working Days:</span>
                    <span className="text-sm font-medium">{netWorkingDays} days</span>
                  </div>
                  
                  {/* Per Day specific fields */}
                  {(selectedPolicy.calculation_type || 'per_day') === 'per_day' && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium">Per Day Rate:</span>
                      <span className="text-sm">{formatCurrency(parseFloat(allowanceData.perDayRate) || 0)}</span>
                    </div>
                  )}
                  
                  {/* Per KM specific fields */}
                  {selectedPolicy.calculation_type === 'per_km' && (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">From:</span>
                        <span className="text-sm truncate max-w-[250px]">{allowanceData.fromLocation?.address || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">To:</span>
                        <span className="text-sm truncate max-w-[250px]">{allowanceData.toLocation?.address || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">One-way Distance:</span>
                        <span className="text-sm">{calculatedDistance.toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">Number of Trips:</span>
                        <span className="text-sm">{parseInt(allowanceData.numTrips) || 1} round trip(s)</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">Total Distance:</span>
                        <span className="text-sm">{(calculatedDistance * (parseInt(allowanceData.numTrips) || 1) * 2).toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium">Rate per KM:</span>
                        <span className="text-sm">{formatCurrency(selectedPolicy.rate_per_unit || 0)}</span>
                      </div>
                    </>
                  )}
                  
                  {/* Total Amount - Common */}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm font-medium">Total Amount:</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(calculatedTotalAmount)}</span>
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
