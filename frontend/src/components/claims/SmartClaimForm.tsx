import { useEffect, useState, useMemo, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { Calendar, CheckCircle2, Circle, FileText, Sparkles, Trash2, Loader2, Zap, Pencil } from "lucide-react";
import { parse } from "date-fns";
import { cn } from "@/lib/utils";
import { SmartFormField } from "./SmartFormField";
import { ComplianceScore } from "./ComplianceScore";
import { DocumentUpload, UploadedFile } from "./DocumentUpload";
import { PolicyChecks } from "./PolicyChecks";
import { ReceiptPolicyChecks, ReceiptsPolicySummary, PolicyCheck } from "./ReceiptPolicyChecks";
import { Category } from "./CategoryGrid";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useFormatting } from "@/hooks/useFormatting";
import { useEmployeeProjectHistory } from "@/hooks/useEmployees";
import { useReimbursementsByRegion, ExtractedClaimCategory } from "@/hooks/usePolicies";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface ClaimFormData {
  title?: string;
  amount?: string;
  date?: Date;
  vendor?: string;
  transactionRef?: string;
  description?: string;
  projectCode?: string;
  category?: string;
}

// Field source type - 'auto' for auto-extracted, 'manual' for user-entered
export type FieldSource = 'auto' | 'manual' | 'none';

// Interface for tracking which fields were auto vs manual
export interface FieldSources {
  category: FieldSource;
  title: FieldSource;
  amount: FieldSource;
  date: FieldSource;
  vendor: FieldSource;
  description: FieldSource;
  transactionRef: FieldSource;
  projectCode?: FieldSource; // Optional field
}

// Interface for extracted claim data - exported for use in parent components
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
  projectCode?: string;
  // Track which fields were auto-extracted vs manually entered
  fieldSources: FieldSources;
}

interface SmartClaimFormProps {
  category?: Category;
  form: UseFormReturn<ClaimFormData>;
  onFilesChange: (files: UploadedFile[]) => void;
  uploadedFiles?: UploadedFile[];
  onMultipleClaimsExtracted?: (claims: ExtractedClaim[]) => void;
  onClaimsUpdated?: (claims: ExtractedClaim[]) => void; // Called when user edits any claim field
  onSingleFormFieldSourcesChange?: (sources: FieldSources) => void; // Called when single form field sources change
  // For preserving OCR processing state across step navigation
  lastProcessedFileId?: string | null;
  onLastProcessedFileIdChange?: (id: string | null) => void;
}

export function SmartClaimForm({
  form,
  onFilesChange,
  uploadedFiles = [],
  onMultipleClaimsExtracted,
  onClaimsUpdated,
  onSingleFormFieldSourcesChange,
  lastProcessedFileId: parentLastProcessedFileId,
  onLastProcessedFileIdChange,
}: SmartClaimFormProps) {
  const [complianceScore, setComplianceScore] = useState(0);
  const { register, watch, setValue, formState: { errors } } = form;

  // Get current user and their employee data for project filtering
  const { user } = useAuth();

  // Get formatting functions based on tenant settings
  const { formatCurrency, formatDate, getCurrencySymbol, getDateFnsFormat } = useFormatting();

  // Fetch reimbursement categories filtered by user's region
  const { data: reimbursementCategories = [], isLoading: isLoadingCategories } = useReimbursementsByRegion(user?.region);

  // Create category options with 'Other' at the end
  const categoryOptions = useMemo(() => {
    const apiCategories = reimbursementCategories.map(cat => ({
      value: cat.category_code.toLowerCase(),
      label: cat.category_name,
      maxAmount: cat.max_amount,
      categoryCode: cat.category_code,
      description: cat.description,
    }));
    // Add 'Other' category at the end
    return [...apiCategories, { value: 'other', label: 'Other', maxAmount: null, categoryCode: 'OTHER', description: 'For expenses that don\'t match other categories' }];
  }, [reimbursementCategories]);

  // Helper function to validate if a category exists in available options
  // If not found, returns 'other'
  const validateAndNormalizeCategory = (category: string): string => {
    if (!category) return 'other';
    const normalizedCategory = category.toLowerCase().replace(/[\s_-]+/g, '_');

    // Check if category exists in API options
    const found = categoryOptions.find(opt =>
      opt.value === normalizedCategory ||
      opt.categoryCode.toLowerCase() === normalizedCategory ||
      opt.label.toLowerCase().replace(/[\s_-]+/g, '_') === normalizedCategory
    );

    if (found) {
      return found.value;
    }

    // Try partial matching for common categories
    const categoryKeywordMap: Record<string, string[]> = {
      'cert_reimb': ['cert', 'certification', 'exam'],
      'training_reimb': ['training', 'course', 'workshop'],
      'conf_reimb': ['conference', 'seminar', 'summit'],
      'membership_reimb': ['membership', 'member', 'association'],
      'local_travel_reimb': ['travel', 'conveyance', 'local'],
      'toll_parking_reimb': ['toll', 'parking'],
      'fuel_reimb': ['fuel', 'petrol', 'diesel'],
    };

    for (const [catValue, keywords] of Object.entries(categoryKeywordMap)) {
      if (keywords.some(kw => normalizedCategory.includes(kw))) {
        const matchedOpt = categoryOptions.find(opt => opt.value === catValue);
        if (matchedOpt) return matchedOpt.value;
      }
    }

    // No match found - return 'other'
    return 'other';
  };

  // Get the selected category's policy details
  const selectedCategoryPolicy = useMemo(() => {
    const selectedValue = watch('category');
    if (!selectedValue || selectedValue === 'other') return null;
    return reimbursementCategories.find(cat =>
      cat.category_code.toLowerCase() === selectedValue
    ) || null;
  }, [watch('category'), reimbursementCategories]);

  // Fetch employee's project history (current and past projects) using user.id (which is the employee UUID)
  const { data: projectHistory, isLoading: isLoadingProjects } = useEmployeeProjectHistory(user?.id);

  // State for multiple extracted claims
  const [extractedClaims, setExtractedClaims] = useState<ExtractedClaim[]>([]);
  const [showMultipleClaims, setShowMultipleClaims] = useState(false);

  // Map project history to a format suitable for the dropdown
  // Shows both current (ACTIVE) and past (COMPLETED) projects
  const employeeProjects = projectHistory?.map(allocation => ({
    id: allocation.project_id,
    projectCode: allocation.project_code,
    projectName: allocation.project_name,
    status: allocation.status, // ACTIVE, COMPLETED, or REMOVED
    projectStatus: allocation.project_status,
    role: allocation.role,
    allocatedDate: allocation.allocated_date,
    deallocatedDate: allocation.deallocated_date,
  })) || [];

  // Get employee's current active project for defaulting
  const currentActiveProject = employeeProjects.find(p => p.status === 'ACTIVE');

  // Track which fields were auto-populated
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<Set<string>>(new Set());

  // Track field sources for single form: 'auto' | 'manual' | 'none'
  // When a field is auto-populated, it starts as 'auto'
  // When user edits it, it becomes 'manual'
  const [singleFormFieldSources, setSingleFormFieldSources] = useState<Record<string, 'auto' | 'manual' | 'none'>>({
    category: 'none',
    title: 'none',
    amount: 'none',
    date: 'none',
    vendor: 'none',
    transactionRef: 'none',
    description: 'none',
    projectCode: 'none',
  });

  // Helper function to mark a field as manually edited
  const markFieldAsManual = (fieldName: string) => {
    setSingleFormFieldSources(prev => {
      // Only mark as manual if it was previously 'auto'
      if (prev[fieldName] === 'auto') {
        return { ...prev, [fieldName]: 'manual' };
      }
      return prev;
    });
  };

  // Helper function to set fields as auto-populated after OCR
  const setFieldsAsAuto = (fieldNames: string[]) => {
    setAutoPopulatedFields(new Set(fieldNames));
    setSingleFormFieldSources(prev => {
      const newSources = { ...prev };
      fieldNames.forEach(field => {
        newSources[field] = 'auto';
      });
      return newSources;
    });
  };

  // Sync single form field sources to parent whenever they change
  useEffect(() => {
    if (onSingleFormFieldSourcesChange && !showMultipleClaims) {
      onSingleFormFieldSourcesChange(singleFormFieldSources as unknown as FieldSources);
    }
  }, [singleFormFieldSources, showMultipleClaims, onSingleFormFieldSourcesChange]);

  const watchedFields = watch();

  // Default project code to employee's current active project on initial load
  useEffect(() => {
    if (currentActiveProject && !watchedFields.projectCode) {
      setValue('projectCode', currentActiveProject.projectCode);
    }
  }, [currentActiveProject, watchedFields.projectCode, setValue]);

  const [isExtractingOCR, setIsExtractingOCR] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');

  // State for real-time duplicate check
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{
    isChecking: boolean;
    isDuplicate: boolean;
    matchType: string | null;
    duplicateClaims: Array<{ claim_number: string; amount: number; claim_date: string }>;
  }>({
    isChecking: false,
    isDuplicate: false,
    matchType: null,
    duplicateClaims: [],
  });

  // State for per-receipt duplicate checks (for multi-receipt mode)
  const [receiptDuplicateChecks, setReceiptDuplicateChecks] = useState<Record<string, {
    isChecking: boolean;
    isDuplicate: boolean;
    matchType: string | null;
    duplicateClaims: Array<{ claim_number: string; amount: number; claim_date: string }>;
  }>>({});

  // Function to check duplicate for a single receipt
  const checkDuplicateForReceipt = async (receiptId: string, amount: string, date: Date | null, transactionRef?: string) => {
    if (!amount || !date || !user?.id) {
      setReceiptDuplicateChecks(prev => ({
        ...prev,
        [receiptId]: {
          isChecking: false,
          isDuplicate: false,
          matchType: null,
          duplicateClaims: [],
        }
      }));
      return;
    }

    setReceiptDuplicateChecks(prev => ({
      ...prev,
      [receiptId]: { ...prev[receiptId], isChecking: true }
    }));

    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const params = new URLSearchParams({
        employee_id: user.id,
        amount: String(parseFloat(amount.replace(/,/g, ''))),
        claim_date: dateStr,
        tenant_id: user.tenantId || '',
      });

      if (transactionRef) {
        params.append('transaction_ref', transactionRef);
      }

      const response = await fetch(
        `${API_BASE_URL}/claims/check-duplicate?${params}`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        setReceiptDuplicateChecks(prev => ({
          ...prev,
          [receiptId]: {
            isChecking: false,
            isDuplicate: data.is_duplicate,
            matchType: data.match_type,
            duplicateClaims: data.duplicate_claims || [],
          }
        }));
      }
    } catch (error) {
      console.error('Error checking duplicate for receipt:', receiptId, error);
      setReceiptDuplicateChecks(prev => ({
        ...prev,
        [receiptId]: { ...prev[receiptId], isChecking: false }
      }));
    }
  };

  // Check duplicates for all receipts when they change
  useEffect(() => {
    if (extractedClaims.length > 1 && user?.id) {
      // Debounce: check all receipts
      const timeoutId = setTimeout(() => {
        extractedClaims.forEach(claim => {
          if (claim.selected) {
            checkDuplicateForReceipt(claim.id, claim.amount, claim.date, claim.transactionRef);
          }
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [extractedClaims, user?.id]);

  // Real-time duplicate check when amount, date, or transactionRef changes
  useEffect(() => {
    const checkForDuplicates = async () => {
      const amount = watchedFields.amount;
      const date = watchedFields.date;
      const transactionRef = watchedFields.transactionRef;

      // Only check if we have amount and date
      if (!amount || !date || !user?.id) {
        setDuplicateCheckResult(prev => ({
          ...prev,
          isChecking: false,
          isDuplicate: false,
          matchType: null,
          duplicateClaims: [],
        }));
        return;
      }

      setDuplicateCheckResult(prev => ({ ...prev, isChecking: true }));

      try {
        // Format date without timezone conversion (use local date)
        let dateStr: string;
        if (date instanceof Date) {
          // Use local date parts to avoid timezone issues
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          dateStr = String(date).split('T')[0];
        }

        const params = new URLSearchParams({
          employee_id: user.id,
          amount: String(parseFloat(amount.toString().replace(/,/g, ''))),
          claim_date: dateStr,
          tenant_id: user.tenantId || '',
        });

        if (transactionRef) {
          params.append('transaction_ref', transactionRef);
        }

        const response = await fetch(
          `${API_BASE_URL}/claims/check-duplicate?${params}`,
          { method: 'POST' }
        );

        if (response.ok) {
          const data = await response.json();
          setDuplicateCheckResult({
            isChecking: false,
            isDuplicate: data.is_duplicate,
            matchType: data.match_type,
            duplicateClaims: data.duplicate_claims || [],
          });
        } else {
          setDuplicateCheckResult(prev => ({ ...prev, isChecking: false }));
        }
      } catch (error) {
        console.error('Error checking for duplicates:', error);
        setDuplicateCheckResult(prev => ({ ...prev, isChecking: false }));
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkForDuplicates, 500);
    return () => clearTimeout(timeoutId);
  }, [watchedFields.amount, watchedFields.date, watchedFields.transactionRef, user?.id]);

  // Helper function to detect category from extracted text using API categories
  // Returns 'other' if no match is found, which sets AI confidence to 0
  const detectCategoryFromText = (text: string): string => {
    const lowerText = text.toLowerCase();

    // Define keyword patterns for each category type
    // These map to the API category codes/names
    const categoryKeywords: Record<string, RegExp> = {
      // Travel related
      'travel': /\b(travel|transport|flight|airline|train|railway|cab|taxi|uber|ola|airport|boarding pass|ticket|journey|fare|mileage|petrol|diesel|fuel|bus|metro)\b/i,
      'trv': /\b(travel|transport|flight|airline|train|railway|cab|taxi|uber|ola|airport|boarding pass|ticket|journey|fare)\b/i,

      // Certification/Training
      'certification': /\b(certification|certificate|exam|examination|course|training|workshop|seminar|conference|learning|education|udemy|coursera|aws|azure|google cloud)\b/i,
      'cert': /\b(certification|certificate|exam|course|training|workshop)\b/i,

      // Food/Meals
      'food': /\b(food|meal|lunch|dinner|breakfast|restaurant|cafe|canteen|snacks|beverages|catering|swiggy|zomato)\b/i,
      'team_lunch': /\b(team\s*(lunch|dinner|meeting)|client\s*(lunch|dinner|meeting)|business\s*meal)\b/i,
      'fd': /\b(food|meal|lunch|dinner|breakfast|restaurant|cafe)\b/i,

      // Accommodation
      'accommodation': /\b(hotel|stay|accommodation|lodging|room|booking|oyo|airbnb|resort|guest\s*house|check-in|check-out)\b/i,
      'accom': /\b(hotel|stay|accommodation|lodging|room)\b/i,

      // Equipment
      'equipment': /\b(equipment|laptop|computer|hardware|device|monitor|keyboard|mouse|headphone|webcam|charger)\b/i,
      'eqp': /\b(equipment|laptop|computer|hardware|device|monitor)\b/i,

      // Software
      'software': /\b(software|subscription|license|saas|cloud|microsoft|adobe|slack|notion|jira|github)\b/i,
      'subs': /\b(software|subscription|license|saas|cloud)\b/i,

      // Office supplies
      'office_supplies': /\b(office|stationery|supplies|paper|pen|notebook|printer|ink|toner)\b/i,
      'office': /\b(office|stationery|supplies|paper|pen|notebook)\b/i,

      // Medical
      'medical': /\b(medical|health|hospital|doctor|pharmacy|medicine|clinic|consultation|diagnosis|treatment)\b/i,
      'med': /\b(medical|health|hospital|doctor|pharmacy|medicine)\b/i,

      // Passport/Visa
      'passport_visa': /\b(passport|visa|vfs|embassy|consulate|courier|immigration|travel\s*document)\b/i,
      'visa': /\b(passport|visa|vfs|embassy|consulate)\b/i,

      // Conveyance
      'conveyance': /\b(conveyance|local\s*travel|auto|rickshaw|metro|bus\s*fare|parking)\b/i,
      'conv': /\b(conveyance|local\s*travel|auto|rickshaw)\b/i,

      // Phone/Internet
      'phone_internet': /\b(phone|internet|mobile|broadband|wifi|data\s*plan|recharge|telecom)\b/i,
      'telecom': /\b(phone|internet|mobile|broadband|wifi)\b/i,

      // Client meeting
      'client_meeting': /\b(client|customer|business\s*meeting|corporate\s*meeting)\b/i,
    };

    // Check if any API category matches using keywords
    for (const option of categoryOptions) {
      const catValue = option.value.toLowerCase();
      const catLabel = option.label.toLowerCase();

      // Skip 'other' category - it's the fallback
      if (catValue === 'other') continue;

      // Check if keywords match this category
      const keywordPattern = categoryKeywords[catValue] || categoryKeywords[option.categoryCode.toLowerCase()];
      if (keywordPattern && keywordPattern.test(lowerText)) {
        return catValue;
      }

      // Also check if category name appears in text
      if (lowerText.includes(catLabel) || lowerText.includes(catValue.replace(/_/g, ' '))) {
        return catValue;
      }
    }

    // No match found - return 'other' (AI confidence will be 0)
    return 'other';
  };

  // Helper function to extract structured fields from text
  const extractFieldsFromText = (text: string): { amount?: string; date?: Date; vendor?: string; title?: string } => {
    const result: { amount?: string; date?: Date; vendor?: string; title?: string } = {};

    // Extract amount - look for currency patterns (₹, Rs, INR, $, %, etc.) or plain numbers with decimals
    // Note: OCR may interpret ₹ as % or other symbols
    const amountPatterns = [
      // OCR may interpret ₹ as % - look for %727 or similar patterns
      /[%₹]\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\b/i,
      /(?:₹|rs\.?|inr|total|amount|fare|price|cost|bill)[:\s]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /([0-9,]+(?:\.[0-9]{2})?)\s*(?:₹|rs\.?|inr)/i,
      /(?:total|amount|fare|grand total|total bill)[:\s]*(?:₹|rs\.?|inr|%)?[:\s]*\(?(?:rounded)?\)?\s*[=]?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
      /paid\s+by\s+(?:cash|card|upi)[:\s]*(?:₹|rs\.?|r|%)?([0-9,]+(?:\.[0-9]{2})?)/i,
      /\b(\d{2,6}\.\d{2})\b/, // Match amounts like 450.00, 1234.56
      /\br?(\d{3,6})\b/, // Match 3-6 digit numbers as potential amounts (like R727)
    ];

    for (const pattern of amountPatterns) {
      const amountMatch = text.match(pattern);
      if (amountMatch) {
        const amount = amountMatch[1].replace(/,/g, '');
        // Only use if it's a reasonable amount (between 50 and 100000)
        const numAmount = parseFloat(amount);
        if (numAmount >= 50 && numAmount <= 100000) {
          result.amount = amount;
          break;
        }
      }
    }

    // Extract date - look for common date formats
    const datePatterns = [
      // "Invoice Date 11/09/2025" format (from OCR invoices)
      /invoice\s+date\s*[:=]?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
      // "11 Sep, 2005" or "Sep 11, 2025" format (from OCR)
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s]+(\d{4})\b/i,
      // "Nov 17th 2025" or "Nov 17 2025" format
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/i,
      // "17 Nov 2025" format
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2})/,
      /(?:date|dated|on)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    ];

    const monthMap: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    for (const pattern of datePatterns) {
      const dateMatch = text.match(pattern);
      if (dateMatch) {
        try {
          let parsedDate: Date | null = null;

          // Check if it's "Invoice Date DD/MM/YYYY" format (captured as 3 separate groups)
          if (pattern.source.includes('invoice') && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1;  // Month is 0-indexed
            const year = parseInt(dateMatch[3]);
            parsedDate = new Date(year, month, day);
          }
          // Check if it's "DD Mon YYYY" format (e.g., "11 Sep, 2005")
          else if (dateMatch[1] && dateMatch[2] && dateMatch[3] && !isNaN(parseInt(dateMatch[1])) && isNaN(parseInt(dateMatch[2]))) {
            const day = parseInt(dateMatch[1]);
            const month = monthMap[dateMatch[2].toLowerCase().substring(0, 3)];
            const year = parseInt(dateMatch[3]);
            if (month !== undefined) {
              parsedDate = new Date(year, month, day);
            }
          }
          // Check if it's "Mon DD YYYY" format (e.g., "Sep 11, 2025")
          else if (dateMatch[1] && dateMatch[2] && dateMatch[3] && isNaN(parseInt(dateMatch[1]))) {
            const month = monthMap[dateMatch[1].toLowerCase().substring(0, 3)];
            const day = parseInt(dateMatch[2]);
            const year = parseInt(dateMatch[3]);
            if (month !== undefined) {
              parsedDate = new Date(year, month, day);
            }
          }
          // Try DD/MM/YYYY or DD-MM-YYYY
          else if (dateMatch[1] && dateMatch[1].match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/)) {
            const parts = dateMatch[1].split(/[-\/]/);
            parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
          // Try DD/MM/YY or DD-MM-YY
          else if (dateMatch[1] && dateMatch[1].match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2}$/)) {
            const parts = dateMatch[1].split(/[-\/]/);
            const year = parseInt(parts[2]) + 2000;
            parsedDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            result.date = parsedDate;
            break;
          }
        } catch (e) {
          // Date parsing failed, try next pattern
        }
      }
    }

    // Extract vendor/merchant - look for common patterns
    // First, check for known vendors (common ride-sharing, food, travel services)
    const knownVendors = [
      { pattern: /\b(Ola|OoLA|O[0o]LA)\b/i, name: 'Ola' },
      { pattern: /\b(Uber)\b/i, name: 'Uber' },
      { pattern: /\b(Rapido)\b/i, name: 'Rapido' },
      { pattern: /\b(Zomato)\b/i, name: 'Zomato' },
      { pattern: /\b(Swiggy)\b/i, name: 'Swiggy' },
      { pattern: /\b(MakeMyTrip|MMT)\b/i, name: 'MakeMyTrip' },
      { pattern: /\b(IRCTC)\b/i, name: 'IRCTC' },
      { pattern: /\b(IndiGo|Indigo)\b/i, name: 'IndiGo' },
      { pattern: /\b(Air India)\b/i, name: 'Air India' },
      { pattern: /\b(SpiceJet)\b/i, name: 'SpiceJet' },
      { pattern: /\b(Vistara)\b/i, name: 'Vistara' },
      { pattern: /\b(GoAir|Go First)\b/i, name: 'Go First' },
      { pattern: /\b(Cleartrip)\b/i, name: 'Cleartrip' },
      { pattern: /\b(EaseMyTrip)\b/i, name: 'EaseMyTrip' },
      { pattern: /\b(Yatra)\b/i, name: 'Yatra' },
    ];

    for (const vendor of knownVendors) {
      if (vendor.pattern.test(text)) {
        result.vendor = vendor.name;
        break;
      }
    }

    // If no known vendor found, try generic patterns
    if (!result.vendor) {
      const vendorPatterns = [
        /(?:from|vendor|merchant|paid to|payee|company|driver)[:\s]*([A-Za-z][A-Za-z0-9\s&.,-]+?)(?:\n|$|,)/i,
        /^([A-Z][A-Za-z0-9\s&.]+(?:pvt\.?|private|ltd\.?|limited|inc\.?|llp|llc)?)/im,
        // Extract driver/person names (for cab receipts)
        /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/,
      ];

      for (const pattern of vendorPatterns) {
        const vendorMatch = text.match(pattern);
        if (vendorMatch && vendorMatch[1].trim().length > 2) {
          result.vendor = vendorMatch[1].trim().substring(0, 50);
          break;
        }
      }
    }

    // Generate title from category and extracted info
    const category = detectCategoryFromText(text);
    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');

    if (result.vendor) {
      result.title = `${categoryTitle} - ${result.vendor}`;
    } else if (result.amount) {
      result.title = `${categoryTitle} Expense - ${result.amount}`;
    } else {
      // Use category as title
      result.title = `${categoryTitle} Expense`;
    }

    return result;
  };

  // Backend OCR response type
  interface OcrResponse {
    text: string;
    lines: string[];
    confidence: number;
    method: string;
    pages_processed: number;
    receipts?: Array<{
      amount: string;
      date: string;
      vendor: string;
      category: string;
      description: string;
      currency: string;
      transaction_ref?: string;
      category_validated?: boolean;  // Whether category was validated against policy
    }>;
    receipt_count?: number;
  }

  // Extract text from document (PDF or Image) using backend OCR API
  // The backend handles PDF-to-image conversion, OCR extraction, and LLM-based receipt parsing
  // Employee's region is passed to filter applicable expense categories (cached server-side for 24h)
  const extractTextFromDocument = async (file: File): Promise<OcrResponse | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Get employee's region for category filtering
      const employeeRegion = user?.region || 'INDIA';

      // Use absolute URL to backend API with region and tenant_id parameters
      const tenantId = user?.tenantId || '';
      const response = await fetch(`${API_BASE_URL}/documents/ocr?employee_region=${encodeURIComponent(employeeRegion)}&tenant_id=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data: OcrResponse = await response.json();
        return data;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Backend OCR failed:', response.status, errorData);
        return null;
      }
    } catch (error) {
      console.error('Backend OCR API error:', error);
      return null;
    }
  };

  // Convert backend receipt format to ExtractedClaim format
  const convertBackendReceiptsToExtractedClaims = (receipts: OcrResponse['receipts']): ExtractedClaim[] => {
    if (!receipts || receipts.length === 0) return [];

    // Get the default project code from the employee's current active project
    const defaultProjectCode = currentActiveProject?.projectCode || '';

    return receipts.map((receipt, index) => {
      let parsedDate: Date | null = null;
      if (receipt.date) {
        try {
          // Try to parse YYYY-MM-DD format from LLM
          const dateParts = receipt.date.split('-');
          if (dateParts.length === 3) {
            parsedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
          }
          if (!parsedDate || isNaN(parsedDate.getTime())) {
            parsedDate = new Date(receipt.date);
          }
        } catch (e) {
          console.warn('Failed to parse date:', receipt.date);
        }
      }

      // Trust the backend's validated category - it's already been validated against policy_categories
      // Only normalize case for consistency with frontend options
      const backendCategory = receipt.category?.toLowerCase() || 'other';

      // Check if the backend category exists in our loaded options
      const categoryOption = categoryOptions.find(opt =>
        opt.value === backendCategory ||
        opt.categoryCode.toLowerCase() === backendCategory
      );

      // If category not found in policy options, fallback to 'other'
      // This ensures the dropdown shows a valid selection
      const validatedCategory = categoryOption?.value || 'other';
      const isOtherCategory = validatedCategory === 'other';

      // Get display title based on validated category
      const categoryTitle = categoryOption?.label || (receipt.category?.charAt(0).toUpperCase() + receipt.category?.slice(1).replace(/_/g, ' ') || 'Expense');

      // Initialize field sources - mark fields as 'auto' if they have values from extraction
      // For 'other' category, mark as manual since it wasn't matched to policy
      const fieldSources: FieldSources = {
        category: isOtherCategory ? 'manual' : (receipt.category ? 'auto' : 'manual'),
        title: receipt.vendor ? 'auto' : 'manual',  // Title is derived from category/vendor
        amount: receipt.amount ? 'auto' : 'manual',
        date: receipt.date ? 'auto' : 'manual',
        vendor: receipt.vendor ? 'auto' : 'manual',
        description: receipt.description ? 'auto' : 'manual',
        transactionRef: receipt.transaction_ref ? 'auto' : 'manual',
      };

      return {
        id: `claim-${Date.now()}-${index}`,
        selected: true,
        category: validatedCategory,
        title: receipt.vendor ? `${categoryTitle} - ${receipt.vendor}` : `${categoryTitle} Expense`,
        amount: receipt.amount?.replace(/,/g, '') || '',
        date: parsedDate,
        vendor: receipt.vendor || '',
        description: receipt.description || '',
        rawText: '',
        transactionRef: receipt.transaction_ref || '',
        projectCode: defaultProjectCode,
        fieldSources,
      };
    });
  };

  // Fallback: Extract multiple receipts from OCR text (used if LLM extraction fails)
  // This function is designed to detect ACTUAL multiple receipts (e.g., multiple separate invoices in one PDF)
  // NOT multiple line items within a single invoice
  const extractMultipleReceipts = (text: string): ExtractedClaim[] => {
    const claims: ExtractedClaim[] = [];

    // Get the default project code from the employee's current active project
    const defaultProjectCode = currentActiveProject?.projectCode || '';

    // Patterns that indicate SEPARATE receipts/invoices (not line items)
    const receiptSeparatorPatterns = [
      /(?:^|\n)(?:receipt|invoice|bill)\s*(?:#|no\.?|number)?\s*[:=]?\s*\d+/gim,
      /(?:^|\n)(?:order\s*(?:#|no\.?|id))[:=]?\s*\w+/gim,
      /(?:^|\n)(?:transaction\s*(?:#|id|ref))[:=]?\s*\w+/gim,
      /(?:^|\n)---+/gm,  // Dashed separators
      /(?:^|\n)===+/gm,  // Equals separators
    ];

    // Check if document contains clear receipt separators
    let hasMultipleReceipts = false;
    let separatorCount = 0;

    for (const pattern of receiptSeparatorPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 1) {
        separatorCount += matches.length;
      }
    }

    // Only treat as multiple receipts if we find 2+ clear receipt/invoice identifiers
    hasMultipleReceipts = separatorCount >= 2;

    console.log('Receipt separator count:', separatorCount, 'hasMultipleReceipts:', hasMultipleReceipts);

    // If no clear multiple receipts detected, treat the entire document as a single receipt
    if (!hasMultipleReceipts) {
      // Extract fields from the entire text as a single receipt
      const extractedData = extractFieldsFromText(text);
      const category = detectCategoryFromText(text);
      const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');

      // Only return a claim if we found meaningful data
      if (extractedData.amount || extractedData.vendor || extractedData.date) {
        // Initialize field sources based on what was extracted
        const fieldSources: FieldSources = {
          category: category !== 'other' ? 'auto' : 'manual',
          title: extractedData.title ? 'auto' : 'manual',
          amount: extractedData.amount ? 'auto' : 'manual',
          date: extractedData.date ? 'auto' : 'manual',
          vendor: extractedData.vendor ? 'auto' : 'manual',
          description: 'manual',
          transactionRef: 'manual',
        };

        claims.push({
          id: `claim-${Date.now()}-0`,
          selected: true,
          category,
          title: extractedData.title || (extractedData.vendor ? `${categoryTitle} - ${extractedData.vendor}` : `${categoryTitle} Expense`),
          amount: extractedData.amount || '',
          date: extractedData.date || null,
          vendor: extractedData.vendor || '',
          description: '',
          rawText: text.substring(0, 500),
          projectCode: defaultProjectCode,
          fieldSources,
        });
      }

      console.log('Single receipt extracted:', claims);
      return claims;
    }

    // If multiple receipts detected, try to split them
    // (This is a simplified implementation - can be enhanced later)
    // For now, split by invoice/receipt patterns
    const receiptBlocks = text.split(/(?=(?:receipt|invoice|bill)\s*(?:#|no\.?|number)?[:=]?\s*\d)/i)
      .filter(block => block.trim().length > 50);

    console.log('Found', receiptBlocks.length, 'receipt blocks');

    receiptBlocks.forEach((block, index) => {
      const extractedData = extractFieldsFromText(block);
      const category = detectCategoryFromText(block);
      const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');

      if (extractedData.amount) {
        // Initialize field sources based on what was extracted
        const fieldSources: FieldSources = {
          category: category !== 'other' ? 'auto' : 'manual',
          title: extractedData.title ? 'auto' : 'manual',
          amount: extractedData.amount ? 'auto' : 'manual',
          date: extractedData.date ? 'auto' : 'manual',
          vendor: extractedData.vendor ? 'auto' : 'manual',
          description: 'manual',
          transactionRef: 'manual',
        };

        claims.push({
          id: `claim-${Date.now()}-${index}`,
          selected: true,
          category,
          title: extractedData.title || (extractedData.vendor ? `${categoryTitle} - ${extractedData.vendor}` : `${categoryTitle} Expense #${index + 1}`),
          amount: extractedData.amount,
          date: extractedData.date || null,
          vendor: extractedData.vendor || '',
          description: '',
          rawText: block.substring(0, 300),
          projectCode: defaultProjectCode,
          fieldSources,
        });
      }
    });

    console.log('Multiple receipts extracted:', claims);
    return claims;
  };

  // Handle claim selection toggle
  const handleClaimToggle = (claimId: string) => {
    setExtractedClaims(prev =>
      prev.map(claim =>
        claim.id === claimId ? { ...claim, selected: !claim.selected } : claim
      )
    );
  };

  // Handle select all claims
  const handleSelectAll = (selected: boolean) => {
    setExtractedClaims(prev => prev.map(claim => ({ ...claim, selected })));
  };

  // Update a specific claim field and mark it as 'manual' since user edited it
  const updateClaimField = (claimId: string, field: keyof ExtractedClaim, value: any) => {
    setExtractedClaims(prev => {
      const updatedClaims = prev.map(claim => {
        if (claim.id !== claimId) return claim;

        // Map ExtractedClaim field names to FieldSources field names
        const fieldSourceKey = field as keyof FieldSources;

        // If this is a trackable field, mark it as 'manual' since user edited it
        if (claim.fieldSources && fieldSourceKey in claim.fieldSources) {
          return {
            ...claim,
            [field]: value,
            fieldSources: {
              ...claim.fieldSources,
              [fieldSourceKey]: 'manual' as FieldSource,
            },
          };
        }

        return { ...claim, [field]: value };
      });

      // Notify parent about updated claims so edited values can be submitted
      if (onClaimsUpdated) {
        onClaimsUpdated(updatedClaims);
      }

      return updatedClaims;
    });
  };

  // Track the last processed file to avoid re-processing the same file
  // Use parent state if provided, otherwise use local state
  const [localLastProcessedFileId, setLocalLastProcessedFileId] = useState<string | null>(parentLastProcessedFileId || null);

  // Sync with parent state
  const lastProcessedFileId = parentLastProcessedFileId !== undefined ? parentLastProcessedFileId : localLastProcessedFileId;

  const setLastProcessedFileId = (id: string | null) => {
    setLocalLastProcessedFileId(id);
    if (onLastProcessedFileIdChange) {
      onLastProcessedFileIdChange(id);
    }
  };

  // Reset form when all documents are removed
  useEffect(() => {
    if (uploadedFiles.length === 0 && lastProcessedFileId !== null) {
      console.log('All files removed - resetting form');

      // Reset form fields
      setValue('category', '');
      setValue('title', '');
      setValue('amount', '');
      setValue('date', undefined);
      setValue('vendor', '');
      setValue('transactionRef', '');
      setValue('description', '');
      setValue('projectCode', '');

      // Reset state
      setAutoPopulatedFields(new Set());
      // Reset single form field sources
      setSingleFormFieldSources({
        category: 'none',
        title: 'none',
        amount: 'none',
        date: 'none',
        vendor: 'none',
        transactionRef: 'none',
        description: 'none',
        projectCode: 'none',
      });
      setExtractedText('');
      setExtractedClaims([]);
      setShowMultipleClaims(false);
      setLastProcessedFileId(null);

      // Notify parent that multiple claims are cleared
      if (onMultipleClaimsExtracted) {
        onMultipleClaimsExtracted([]);
      }
    }
  }, [uploadedFiles, lastProcessedFileId, setValue, onMultipleClaimsExtracted]);

  // OCR extraction when files are uploaded
  useEffect(() => {
    const processOCR = async () => {
      console.log('processOCR called, uploadedFiles:', uploadedFiles.length, 'isExtractingOCR:', isExtractingOCR);

      // Check if we have a file to process
      if (uploadedFiles.length === 0 || isExtractingOCR) {
        console.log('Skipping: no files or already extracting');
        return;
      }

      const uploadedFile = uploadedFiles[0];
      console.log('Processing file:', uploadedFile.name, 'id:', uploadedFile.id, 'lastProcessedId:', lastProcessedFileId);

      // Skip if we've already processed this file
      if (uploadedFile.id === lastProcessedFileId) {
        console.log('Skipping: already processed this file');
        return;
      }

      setIsExtractingOCR(true);
      setLastProcessedFileId(uploadedFile.id);

      try {
        const file = uploadedFile.file; // Get actual File object

        if (!file) {
          console.error('No file object found in uploadedFile');
          setIsExtractingOCR(false);
          return;
        }

        // Call backend OCR API (handles both PDF and images)
        console.log('Sending file to backend OCR API...');
        const ocrResponse = await extractTextFromDocument(file);

        if (!ocrResponse) {
          console.error('No response from OCR API');
          setIsExtractingOCR(false);
          return;
        }

        const text = ocrResponse.text || '';
        setExtractedText(text);
        console.log('Extracted text length:', text.length);
        console.log('Extracted text preview:', text.substring(0, 500));
        console.log('Backend receipts:', ocrResponse.receipts);
        console.log('Backend receipt count:', ocrResponse.receipt_count);

        if (ocrResponse.receipts && ocrResponse.receipts.length > 0) {
          // Use LLM-extracted receipts from backend
          console.log('Using LLM-extracted receipts from backend');
          const extractedClaims = convertBackendReceiptsToExtractedClaims(ocrResponse.receipts);

          if (extractedClaims.length > 1) {
            // Multiple receipts found - show multi-claim view
            console.log('Showing multiple claims view with', extractedClaims.length, 'receipts');
            setExtractedClaims(extractedClaims);
            setShowMultipleClaims(true);

            // Notify parent about multiple claims
            if (onMultipleClaimsExtracted) {
              onMultipleClaimsExtracted(extractedClaims);
            }

            // Pre-populate form with first claim for reference
            const firstClaim = extractedClaims[0];
            setValue('category', firstClaim.category);
            setValue('title', firstClaim.title);
            setValue('amount', firstClaim.amount);
            if (firstClaim.date) setValue('date', firstClaim.date);
            if (firstClaim.vendor) setValue('vendor', firstClaim.vendor);
            setFieldsAsAuto(['category', 'title', 'amount', 'date', 'vendor']);
          } else if (extractedClaims.length === 1) {
            // Single receipt from LLM
            console.log('Single receipt from LLM');
            setShowMultipleClaims(false);
            setExtractedClaims([]);

            const claim = extractedClaims[0];
            const newAutoPopulated = new Set<string>();

            setValue('category', claim.category);
            newAutoPopulated.add('category');

            if (claim.amount) {
              setValue('amount', claim.amount);
              newAutoPopulated.add('amount');
            }
            if (claim.date) {
              setValue('date', claim.date);
              newAutoPopulated.add('date');
            }
            if (claim.vendor) {
              setValue('vendor', claim.vendor);
              newAutoPopulated.add('vendor');
            }
            if (claim.title) {
              setValue('title', claim.title);
              newAutoPopulated.add('title');
            }
            if (claim.description) {
              setValue('description', claim.description);
              newAutoPopulated.add('description');
            }
            if (claim.transactionRef) {
              setValue('transactionRef', claim.transactionRef);
              newAutoPopulated.add('transactionRef');
            }

            console.log('Auto-populated fields from LLM:', Array.from(newAutoPopulated));
            setFieldsAsAuto(Array.from(newAutoPopulated));
          }
        } else if (text) {
          // Fallback to client-side extraction if LLM extraction failed
          console.log('Falling back to client-side extraction');
          const multipleReceipts = extractMultipleReceipts(text);
          console.log('Multiple receipts extracted (fallback):', multipleReceipts.length);

          if (multipleReceipts.length > 1) {
            // Multiple receipts found - show multi-claim view
            console.log('Showing multiple claims view');
            setExtractedClaims(multipleReceipts);
            setShowMultipleClaims(true);

            // Notify parent about multiple claims
            if (onMultipleClaimsExtracted) {
              onMultipleClaimsExtracted(multipleReceipts);
            }

            // Pre-populate form with first claim for reference
            const firstClaim = multipleReceipts[0];
            setValue('category', firstClaim.category);
            setValue('title', firstClaim.title);
            setValue('amount', firstClaim.amount);
            if (firstClaim.date) setValue('date', firstClaim.date);
            if (firstClaim.vendor) setValue('vendor', firstClaim.vendor);
            if (firstClaim.transactionRef) setValue('transactionRef', firstClaim.transactionRef);
            setFieldsAsAuto(['category', 'title', 'amount', 'date', 'vendor', 'transactionRef']);
          } else {
            // Single receipt - use standard flow
            setShowMultipleClaims(false);
            setExtractedClaims([]);

            const detectedCategory = detectCategoryFromText(text);
            console.log('Detected category:', detectedCategory);

            // Extract additional fields from text
            const extractedData = extractFieldsFromText(text);
            console.log('Extracted data:', extractedData);
            const newAutoPopulated = new Set<string>();

            // Always set category from OCR
            setValue('category', detectedCategory);
            newAutoPopulated.add('category');

            // Populate other fields if they're empty or different from extracted
            if (extractedData.amount) {
              console.log('Setting amount:', extractedData.amount);
              setValue('amount', extractedData.amount);
              newAutoPopulated.add('amount');
            }
            if (extractedData.date) {
              console.log('Setting date:', extractedData.date);
              setValue('date', extractedData.date);
              newAutoPopulated.add('date');
            }
            if (extractedData.vendor) {
              console.log('Setting vendor:', extractedData.vendor);
              setValue('vendor', extractedData.vendor);
              newAutoPopulated.add('vendor');
            }
            if (extractedData.title) {
              console.log('Setting title:', extractedData.title);
              setValue('title', extractedData.title);
              newAutoPopulated.add('title');
            }

            console.log('Auto-populated fields:', Array.from(newAutoPopulated));
            setFieldsAsAuto(Array.from(newAutoPopulated));
          }
        } else {
          console.log('No text extracted, falling back to filename detection');
          // Fallback to filename-based detection if OCR returns no text
          const fileName = uploadedFile.name?.toLowerCase() || '';
          let detectedCategory = 'other';
          if (fileName.match(/travel|transport|flight|train|cab|airport/)) detectedCategory = 'travel';
          else if (fileName.match(/cert|exam|course|training/)) detectedCategory = 'certification';
          else if (fileName.match(/food|meal|lunch|dinner/)) detectedCategory = 'food';
          else if (fileName.match(/hotel|stay|accommodation/)) detectedCategory = 'accommodation';
          // Validate and normalize the detected category
          const validatedCategory = validateAndNormalizeCategory(detectedCategory);
          setValue('category', validatedCategory);
          setFieldsAsAuto(['category']);
        }
      } catch (error) {
        console.error('OCR processing error:', error);
        // Set a default category on error
        setValue('category', 'other');
      } finally {
        setIsExtractingOCR(false);
      }
    };

    processOCR();
  }, [uploadedFiles, setValue]);

  // Calculate form completeness score based on filled fields
  // This should work for ALL categories including 'Other'
  // Note: AI confidence and policy compliance are handled separately in field sources
  useEffect(() => {
    let score = 0;
    // Form completeness is based on filled fields - works for all categories
    if (watchedFields.category) score += 15;
    if (watchedFields.title) score += 15;
    if (watchedFields.amount && parseFloat(watchedFields.amount) > 0) score += 15;
    if (watchedFields.date) score += 15;
    if (watchedFields.vendor) score += 15;
    if (watchedFields.description && watchedFields.description.length > 10) score += 10;
    if (uploadedFiles.length > 0) score += 10;
    if (watchedFields.projectCode) score += 5;
    setComplianceScore(Math.min(score, 100));
  }, [watchedFields, uploadedFiles]);

  // Perform actual policy validations against the selected category's policy
  const amountValidation = useMemo(() => {
    if (watchedFields.category === 'other' || !selectedCategoryPolicy) {
      return {
        status: 'warning' as const,
        message: "No policy limits for 'Other' category"
      };
    }

    const claimAmount = parseFloat(watchedFields.amount || '0');
    const maxAmount = selectedCategoryPolicy.max_amount;

    if (!claimAmount) {
      return {
        status: 'checking' as const,
        message: "Enter amount to validate against policy"
      };
    }

    if (maxAmount && claimAmount > maxAmount) {
      return {
        status: 'fail' as const,
        message: `Amount ${formatCurrency(claimAmount)} exceeds policy limit of ${formatCurrency(maxAmount)}`
      };
    }

    return {
      status: 'pass' as const,
      message: maxAmount
        ? `Amount ${formatCurrency(claimAmount)} within policy limit of ${formatCurrency(maxAmount)}`
        : "Amount verified - no policy limit defined"
    };
  }, [watchedFields.amount, watchedFields.category, selectedCategoryPolicy, formatCurrency]);

  const dateValidation = useMemo(() => {
    if (watchedFields.category === 'other' || !selectedCategoryPolicy) {
      return {
        status: 'warning' as const,
        message: "No date restrictions for 'Other' category"
      };
    }

    const claimDate = watchedFields.date;
    const submissionWindowDays = selectedCategoryPolicy.submission_window_days;

    if (!claimDate) {
      return {
        status: 'checking' as const,
        message: "Enter date to validate against policy"
      };
    }

    if (submissionWindowDays) {
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - new Date(claimDate).getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > submissionWindowDays) {
        return {
          status: 'fail' as const,
          message: `Receipt date is ${daysDiff} days old, exceeds ${submissionWindowDays}-day submission window`
        };
      }

      return {
        status: 'pass' as const,
        message: `Within ${submissionWindowDays}-day submission window (${daysDiff} days old)`
      };
    }

    return {
      status: 'pass' as const,
      message: "Date verified - no submission window restriction"
    };
  }, [watchedFields.date, watchedFields.category, selectedCategoryPolicy]);

  const policyChecks = [
    {
      id: "category",
      label: "Category selected",
      status: isExtractingOCR
        ? "checking" as const
        : watchedFields.category === 'other'
          ? "warning" as const
          : (watchedFields.category ? "pass" as const : "checking" as const),
      message: isExtractingOCR
        ? "Analyzing document content..."
        : watchedFields.category === 'other'
          ? "Category 'Other' selected - no policy matching (AI confidence: 0%)"
          : (watchedFields.category ? "Category detected from document content" : "Upload document to auto-detect"),
    },
    {
      id: "amount",
      label: "Amount within limit",
      status: amountValidation.status,
      message: amountValidation.message,
    },
    {
      id: "date",
      label: "Within submission window",
      status: dateValidation.status,
      message: dateValidation.message,
    },
    {
      id: "docs",
      label: "Required documents",
      status: uploadedFiles.length > 0 ? "pass" as const : "warning" as const,
      message: uploadedFiles.length > 0 ? `${uploadedFiles.length} document(s) uploaded` : "Upload supporting documents",
    },
    {
      id: "duplicate",
      label: "No duplicate claims",
      status: duplicateCheckResult.isChecking
        ? "checking" as const
        : duplicateCheckResult.isDuplicate
          ? (duplicateCheckResult.matchType === 'exact' ? "fail" as const : "warning" as const)
          : (watchedFields.amount && watchedFields.date ? "pass" as const : "checking" as const),
      message: duplicateCheckResult.isChecking
        ? "Checking for duplicates..."
        : duplicateCheckResult.isDuplicate
          ? `${duplicateCheckResult.matchType === 'exact' ? 'Exact' : 'Potential'} duplicate found: ${duplicateCheckResult.duplicateClaims[0]?.claim_number || 'existing claim'}`
          : (watchedFields.amount && watchedFields.date
            ? `No duplicates found for ${formatCurrency(parseFloat(watchedFields.amount))} on ${formatDate(watchedFields.date)}`
            : "Enter amount and date to check"),
    },
  ];

  // Function to compute policy checks for a single receipt (multi-receipt mode)
  const getReceiptPolicyChecks = useCallback((claim: ExtractedClaim): PolicyCheck[] => {
    // Find the policy for this receipt's category
    const receiptCategoryPolicy = reimbursementCategories.find(cat =>
      cat.category_code.toLowerCase() === claim.category?.toLowerCase()
    );

    const duplicateCheck = receiptDuplicateChecks[claim.id] || {
      isChecking: false,
      isDuplicate: false,
      matchType: null,
      duplicateClaims: [],
    };

    // Amount validation for this receipt
    const amount = parseFloat(claim.amount || '0');
    let amountStatus: 'pass' | 'fail' | 'warning' | 'checking' = 'checking';
    let amountMessage = 'Enter amount to validate';

    if (amount > 0) {
      if (receiptCategoryPolicy?.max_amount && amount > receiptCategoryPolicy.max_amount) {
        amountStatus = 'fail';
        amountMessage = `Amount ${formatCurrency(amount)} exceeds limit of ${formatCurrency(receiptCategoryPolicy.max_amount)}`;
      } else if (receiptCategoryPolicy?.max_amount) {
        amountStatus = 'pass';
        amountMessage = `Amount ${formatCurrency(amount)} within policy limit of ${formatCurrency(receiptCategoryPolicy.max_amount)}`;
      } else {
        amountStatus = 'pass';
        amountMessage = `Amount ${formatCurrency(amount)} (no specific limit)`;
      }
    }

    // Date validation for this receipt
    let dateStatus: 'pass' | 'fail' | 'warning' | 'checking' = 'checking';
    let dateMessage = 'Enter date to validate';

    if (claim.date) {
      const submissionWindowDays = receiptCategoryPolicy?.submission_window_days || 15;
      const today = new Date();
      const claimDate = new Date(claim.date);
      const daysDiff = Math.floor((today.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > submissionWindowDays) {
        dateStatus = 'fail';
        dateMessage = `Receipt is ${daysDiff} days old, exceeds ${submissionWindowDays}-day window`;
      } else {
        dateStatus = 'pass';
        dateMessage = `Within ${submissionWindowDays}-day window (${daysDiff} days old)`;
      }
    }

    return [
      {
        id: 'category',
        label: 'Category selected',
        status: !claim.category || claim.category === 'other' ? 'warning' : 'pass',
        message: !claim.category
          ? 'Select a category'
          : claim.category === 'other'
            ? 'Category "Other" - no policy matching'
            : `Category: ${receiptCategoryPolicy?.category_name || claim.category}`,
      },
      {
        id: 'amount',
        label: 'Amount within limit',
        status: amountStatus,
        message: amountMessage,
      },
      {
        id: 'date',
        label: 'Within submission window',
        status: dateStatus,
        message: dateMessage,
      },
      {
        id: 'duplicate',
        label: 'No duplicate claims',
        status: duplicateCheck.isChecking
          ? 'checking'
          : duplicateCheck.isDuplicate
            ? (duplicateCheck.matchType === 'exact' ? 'fail' : 'warning')
            : (claim.amount && claim.date ? 'pass' : 'checking'),
        message: duplicateCheck.isChecking
          ? 'Checking for duplicates...'
          : duplicateCheck.isDuplicate
            ? `${duplicateCheck.matchType === 'exact' ? 'Exact' : 'Potential'} duplicate found`
            : (claim.amount && claim.date
              ? `No duplicates found for ${formatCurrency(parseFloat(claim.amount || '0'))}`
              : 'Enter amount and date to check'),
      },
    ];
  }, [reimbursementCategories, receiptDuplicateChecks]);

  // Compute all receipt policy checks for the summary
  const allReceiptPolicyChecks = useMemo(() => {
    if (!showMultipleClaims || extractedClaims.length <= 1) return [];

    return extractedClaims
      .filter(claim => claim.selected)
      .map((claim, index) => ({
        receiptIndex: index,
        checks: getReceiptPolicyChecks(claim),
      }));
  }, [extractedClaims, showMultipleClaims, getReceiptPolicyChecks]);

  const getValidationStatus = (field: keyof ClaimFormData) => {
    if (errors[field]) return "invalid";
    if (watchedFields[field]) return "valid";
    return "none";
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Document Upload */}
        <div className="rounded-xl border border-border bg-card p-6">
          <DocumentUpload
            requiredDocs={['Receipt', 'Invoice', 'Supporting Documents']}
            onFilesChange={onFilesChange}
            initialFiles={uploadedFiles}
          />
        </div>

        {/* Multiple Claims Section */}
        {showMultipleClaims && extractedClaims.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Multiple Receipts Detected
                </h3>
                <p className="text-sm text-muted-foreground">
                  We found {extractedClaims.length} receipts in your document. Select which ones to submit.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Summary Block */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{extractedClaims.length}</p>
                <p className="text-xs text-muted-foreground">Total Receipts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{extractedClaims.filter(c => c.selected).length}</p>
                <p className="text-xs text-muted-foreground">Selected</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(extractedClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(extractedClaims.filter(c => c.selected).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Selected Amount</p>
              </div>
            </div>

            {/* Common Project Code for All Receipts */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Project Code for all receipts</span>
                {currentActiveProject && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Sparkles className="h-2.5 w-2.5" /> Auto
                  </span>
                )}
              </div>
              <Select
                value={watchedFields.projectCode}
                onValueChange={(value) => {
                  setValue("projectCode", value);
                  // Also update all extracted claims with this project code
                  setExtractedClaims(prev => prev.map(claim => ({ ...claim, projectCode: value })));
                }}
              >
                <SelectTrigger className="bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {employeeProjects
                    .filter(project => project.status === 'ACTIVE')
                    .map((project) => (
                      <SelectItem key={project.id} value={project.projectCode}>
                        <div className="flex items-center gap-2">
                          <span>{project.projectCode} - {project.projectName}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-300">
                            Active
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  {employeeProjects
                    .filter(project => project.status !== 'ACTIVE')
                    .map((project) => (
                      <SelectItem key={project.id} value={project.projectCode}>
                        <div className="flex items-center gap-2">
                          <span>{project.projectCode} - {project.projectName}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                            {project.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {extractedClaims.map((claim, index) => {
                const receiptChecks = getReceiptPolicyChecks(claim);
                const passCount = receiptChecks.filter(c => c.status === 'pass').length;
                const failCount = receiptChecks.filter(c => c.status === 'fail').length;
                const warningCount = receiptChecks.filter(c => c.status === 'warning').length;

                return (
                  <Card key={claim.id} className={cn(
                    "transition-all",
                    claim.selected ? "border-accent bg-accent/5" : "opacity-60"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={claim.selected}
                          onCheckedChange={() => handleClaimToggle(claim.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Receipt #{index + 1}
                            </CardTitle>
                            {/* Compact Policy Status Badge */}
                            {claim.selected && (
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "text-xs font-medium px-2 py-0.5 rounded-full",
                                  failCount > 0
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : warningCount > 0
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                )}>
                                  {passCount}/{receiptChecks.length} ✓
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid sm:grid-cols-2 gap-4 ml-7">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Category
                            {claim.fieldSources?.category === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.category === 'manual' && claim.category && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Select
                            value={claim.category}
                            onValueChange={(value) => updateClaimField(claim.id, 'category', value)}
                            disabled={!claim.selected}
                          >
                            <SelectTrigger className={cn("h-9", claim.fieldSources?.category === 'auto' && "bg-accent/5 border-accent/30")}>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoryOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Title
                            {claim.fieldSources?.title === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.title === 'manual' && claim.title && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Input
                            value={claim.title}
                            onChange={(e) => updateClaimField(claim.id, 'title', e.target.value)}
                            disabled={!claim.selected}
                            className={cn("h-9", claim.fieldSources?.title === 'auto' && "bg-accent/5 border-accent/30")}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Amount ({getCurrencySymbol()})
                            {claim.fieldSources?.amount === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.amount === 'manual' && claim.amount && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Input
                            value={claim.amount}
                            onChange={(e) => updateClaimField(claim.id, 'amount', e.target.value)}
                            disabled={!claim.selected}
                            type="number"
                            step="0.01"
                            className={cn("h-9", claim.fieldSources?.amount === 'auto' && "bg-accent/5 border-accent/30")}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Date
                            {claim.fieldSources?.date === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.date === 'manual' && claim.date && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={!claim.selected}
                                className={cn(
                                  "w-full h-9 justify-start text-left font-normal",
                                  !claim.date && "text-muted-foreground",
                                  claim.fieldSources?.date === 'auto' && "bg-accent/5 border-accent/30"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {claim.date ? formatDate(claim.date) : 'Select date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={claim.date || undefined}
                                onSelect={(date) => updateClaimField(claim.id, 'date', date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Vendor
                            {claim.fieldSources?.vendor === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.vendor === 'manual' && claim.vendor && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Input
                            value={claim.vendor}
                            onChange={(e) => updateClaimField(claim.id, 'vendor', e.target.value)}
                            disabled={!claim.selected}
                            placeholder="e.g., Uber, Swiggy"
                            className={cn("h-9", claim.fieldSources?.vendor === 'auto' && "bg-accent/5 border-accent/30")}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Transaction Ref ID
                            {claim.fieldSources?.transactionRef === 'auto' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Sparkles className="h-2.5 w-2.5" /> Auto
                              </span>
                            )}
                            {claim.fieldSources?.transactionRef === 'manual' && claim.transactionRef && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Manual
                              </span>
                            )}
                          </Label>
                          <Input
                            value={claim.transactionRef || ''}
                            onChange={(e) => updateClaimField(claim.id, 'transactionRef', e.target.value)}
                            disabled={!claim.selected}
                            placeholder="e.g., CRN9814090954"
                            className={cn("h-9", claim.fieldSources?.transactionRef === 'auto' && "bg-accent/5 border-accent/30")}
                          />
                        </div>
                      </div>

                      {/* Per-Receipt Policy Checks */}
                      {claim.selected && (
                        <ReceiptPolicyChecks
                          checks={getReceiptPolicyChecks(claim)}
                          receiptIndex={index}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {extractedClaims.filter(c => c.selected).length} of {extractedClaims.length} receipts selected
              </p>
              <Badge variant="outline" className="text-accent">
                Total: {formatCurrency(extractedClaims
                  .filter(c => c.selected)
                  .reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0))}
              </Badge>
            </div>
          </div>
        )}

        {/* Single Claim Form - Hidden when multiple receipts are detected */}
        {!(showMultipleClaims && extractedClaims.length > 1) && (
          <div className="rounded-xl border border-border bg-card p-6 relative">
            {/* Loading Overlay during OCR processing */}
            {isExtractingOCR && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-accent" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Extracting data from document...</p>
                    <p className="text-xs text-muted-foreground mt-1">AI is analyzing your receipt</p>
                  </div>
                </div>
              </div>
            )}

            {/* Overlay when no file uploaded - fields are disabled */}
            {uploadedFiles.length === 0 && !isExtractingOCR && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-xl">
                <div className="text-center p-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Upload a document first</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please upload a receipt or invoice above to enable form fields
                  </p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">
                Reimbursement Claim
              </h3>
              <p className="text-sm text-muted-foreground">
                Fill in the details below
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Category Dropdown with OCR Auto-population */}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  Category
                  {singleFormFieldSources.category === 'auto' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Zap className="h-2.5 w-2.5" /> Auto
                    </span>
                  )}
                  {singleFormFieldSources.category === 'manual' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      <Pencil className="h-2.5 w-2.5" /> Manual
                    </span>
                  )}
                  {isExtractingOCR && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                      Analyzing document...
                    </span>
                  )}
                </label>
                <Select
                  value={watchedFields.category}
                  onValueChange={(value) => {
                    setValue('category', value);
                    markFieldAsManual('category');
                  }}
                  disabled={isExtractingOCR || uploadedFiles.length === 0}
                >
                  <SelectTrigger className={cn(
                    singleFormFieldSources.category === 'auto' && "bg-accent/5 border-accent/30",
                    (isExtractingOCR || uploadedFiles.length === 0) && "opacity-70"
                  )}>
                    <SelectValue placeholder={isExtractingOCR ? "Extracting from document..." : uploadedFiles.length === 0 ? "Upload document first" : "Select category or upload document to auto-detect"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCategories ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading categories...</span>
                      </div>
                    ) : (
                      categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isExtractingOCR
                    ? "🔍 AI is analyzing document content to detect category..."
                    : uploadedFiles.length > 0
                      ? "✅ Category auto-detected from document content"
                      : user?.region
                        ? `Showing categories for ${user.region} region`
                        : "Upload document for AI-powered auto-detection"}
                </p>
              </div>
              <SmartFormField
                label="Expense Title"
                placeholder="e.g., AWS Certification Exam"
                fieldSource={singleFormFieldSources.title}
                validationStatus={getValidationStatus("title")}
                error={errors.title?.message}
                onFieldEdit={() => markFieldAsManual('title')}
                disabled={uploadedFiles.length === 0 || isExtractingOCR}
                {...register("title")}
              />

              <SmartFormField
                label={`Amount (${getCurrencySymbol()})`}
                placeholder="0.00"
                type="number"
                step="0.01"
                fieldSource={singleFormFieldSources.amount}
                validationStatus={getValidationStatus("amount")}
                error={errors.amount?.message}
                onFieldEdit={() => markFieldAsManual('amount')}
                disabled={uploadedFiles.length === 0 || isExtractingOCR}
                {...register("amount")}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  Expense Date
                  {singleFormFieldSources.date === 'auto' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Zap className="h-2.5 w-2.5" /> Auto
                    </span>
                  )}
                  {singleFormFieldSources.date === 'manual' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      <Pencil className="h-2.5 w-2.5" /> Manual
                    </span>
                  )}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={uploadedFiles.length === 0 || isExtractingOCR}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !watchedFields.date && "text-muted-foreground",
                        singleFormFieldSources.date === 'auto' && "bg-accent/5 border-accent/30",
                        (uploadedFiles.length === 0 || isExtractingOCR) && "opacity-70"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {watchedFields.date ? formatDate(watchedFields.date) : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={watchedFields.date}
                      onSelect={(date) => {
                        setValue("date", date);
                        markFieldAsManual('date');
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <SmartFormField
                label="Vendor / Merchant"
                placeholder="e.g., Amazon Web Services"
                fieldSource={singleFormFieldSources.vendor}
                validationStatus={getValidationStatus("vendor")}
                error={errors.vendor?.message}
                onFieldEdit={() => markFieldAsManual('vendor')}
                disabled={uploadedFiles.length === 0 || isExtractingOCR}
                {...register("vendor")}
              />

              <SmartFormField
                label="Transaction Ref ID"
                placeholder="e.g., CRN9814090954, INV-2025-001"
                fieldSource={singleFormFieldSources.transactionRef}
                validationStatus={getValidationStatus("transactionRef")}
                error={errors.transactionRef?.message}
                onFieldEdit={() => markFieldAsManual('transactionRef')}
                disabled={uploadedFiles.length === 0 || isExtractingOCR}
                {...register("transactionRef")}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  Project Code
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Zap className="h-2.5 w-2.5" /> Auto
                  </span>
                </label>
                <Select
                  value={watchedFields.projectCode}
                  onValueChange={(value) => setValue("projectCode", value)}
                  disabled={uploadedFiles.length === 0 || isExtractingOCR}
                >
                  <SelectTrigger className={cn(
                    "bg-accent/5 border-accent/30",
                    (uploadedFiles.length === 0 || isExtractingOCR) && "opacity-70"
                  )}>
                    <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : (employeeProjects.length === 0 ? "No projects assigned" : "Select project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeProjects.length > 0 ? (
                      employeeProjects.map((project) => (
                        <SelectItem key={project.id} value={project.projectCode}>
                          <div className="flex items-center gap-2">
                            <span>{project.projectCode} - {project.projectName}</span>
                            {project.status !== 'ACTIVE' && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {project.status}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects assigned</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <SmartFormField
                  label="Description"
                  placeholder="Provide details about this expense..."
                  multiline
                  fieldSource={singleFormFieldSources.description}
                  validationStatus={getValidationStatus("description")}
                  error={errors.description?.message}
                  onFieldEdit={() => markFieldAsManual('description')}
                  disabled={uploadedFiles.length === 0 || isExtractingOCR}
                  {...register("description")}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Policy Checks Sidebar */}
      <div className="space-y-6">
        <div className="sticky top-24">
          {/* Form Completeness Card */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6 overflow-hidden">
            <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              Form Completeness
            </h4>
            <div className="flex justify-center overflow-hidden">
              <ComplianceScore score={complianceScore} size="lg" />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              {complianceScore >= 80
                ? "Great! Your form is complete and ready to submit"
                : complianceScore >= 50
                  ? "Almost there! Complete the missing fields"
                  : "Fill in required fields to complete your claim"}
            </p>
          </div>

          {/* Policy Checks - Show summary for multi-receipt, details for single */}
          {uploadedFiles.length > 0 && (
            showMultipleClaims && extractedClaims.length > 1
              ? <ReceiptsPolicySummary allReceiptChecks={allReceiptPolicyChecks} />
              : <PolicyChecks checks={policyChecks} />
          )}
        </div>
      </div>
    </div>
  );
}
