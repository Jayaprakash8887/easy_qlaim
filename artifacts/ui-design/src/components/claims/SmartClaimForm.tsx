import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SmartFormField } from "./SmartFormField";
import { ComplianceScore } from "./ComplianceScore";
import { DocumentUpload } from "./DocumentUpload";
import { PolicyChecks } from "./PolicyChecks";
import { Category } from "./CategoryGrid";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClaimFormData {
  title?: string;
  amount?: string;
  date?: Date;
  vendor?: string;
  description?: string;
  paymentMethod?: string;
  projectCode?: string;
  costCenter?: string;
}

interface SmartClaimFormProps {
  category: Category;
  form: UseFormReturn<ClaimFormData>;
  onFilesChange: (files: any[]) => void;
}

export function SmartClaimForm({ category, form, onFilesChange }: SmartClaimFormProps) {
  const [complianceScore, setComplianceScore] = useState(45);
  const { register, watch, setValue, formState: { errors } } = form;
  const watchedFields = watch();

  // Simulate AI compliance score calculation
  useEffect(() => {
    let score = 20;
    if (watchedFields.title) score += 15;
    if (watchedFields.amount && parseFloat(watchedFields.amount) > 0) score += 15;
    if (watchedFields.date) score += 15;
    if (watchedFields.vendor) score += 10;
    if (watchedFields.description && watchedFields.description.length > 10) score += 10;
    if (watchedFields.projectCode) score += 10;
    if (watchedFields.costCenter) score += 5;
    setComplianceScore(Math.min(score, 100));
  }, [watchedFields]);

  const policyChecks = [
    {
      id: "amount",
      label: "Amount within limit",
      status: watchedFields.amount && parseFloat(watchedFields.amount) <= parseFloat(category.maxAmount.replace(/[$,]/g, ""))
        ? "pass" as const
        : watchedFields.amount ? "fail" as const : "checking" as const,
      message: `Max allowed: ${category.maxAmount}`,
    },
    {
      id: "date",
      label: "Within submission window",
      status: watchedFields.date ? "pass" as const : "checking" as const,
      message: "Claims must be within 30 days",
    },
    {
      id: "docs",
      label: "Required documents",
      status: "warning" as const,
      message: `Upload: ${category.requiredDocs.join(", ")}`,
    },
    {
      id: "duplicate",
      label: "No duplicate claims",
      status: "pass" as const,
      message: "AI scanned for duplicates",
    },
    {
      id: "vendor",
      label: "Vendor verification",
      status: watchedFields.vendor ? "pass" as const : "checking" as const,
      message: "Vendor in approved list",
    },
  ];

  const getValidationStatus = (field: keyof ClaimFormData) => {
    if (errors[field]) return "invalid";
    if (watchedFields[field]) return "valid";
    return "none";
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {category.title} Claim
              </h3>
              <p className="text-sm text-muted-foreground">
                Fill in the details below
              </p>
            </div>
            <ComplianceScore score={complianceScore} size="sm" />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <SmartFormField
              label="Expense Title"
              placeholder="e.g., AWS Certification Exam"
              isAutoPopulated={false}
              validationStatus={getValidationStatus("title")}
              error={errors.title?.message}
              {...register("title")}
            />

            <SmartFormField
              label="Amount ($)"
              placeholder="0.00"
              type="number"
              step="0.01"
              isAutoPopulated={false}
              validationStatus={getValidationStatus("amount")}
              error={errors.amount?.message}
              hint={`Max: ${category.maxAmount}`}
              {...register("amount")}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Expense Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watchedFields.date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {watchedFields.date ? format(watchedFields.date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={watchedFields.date}
                    onSelect={(date) => setValue("date", date)}
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
              isAutoPopulated={true}
              validationStatus={getValidationStatus("vendor")}
              error={errors.vendor?.message}
              {...register("vendor")}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Project Code
                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  ⚡ Auto
                </span>
              </label>
              <Select
                value={watchedFields.projectCode}
                onValueChange={(value) => setValue("projectCode", value)}
              >
                <SelectTrigger className="bg-accent/5 border-accent/30">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRJ-001">PRJ-001 - Digital Transformation</SelectItem>
                  <SelectItem value="PRJ-002">PRJ-002 - Cloud Migration</SelectItem>
                  <SelectItem value="PRJ-003">PRJ-003 - Mobile App Dev</SelectItem>
                  <SelectItem value="PRJ-004">PRJ-004 - Data Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Cost Center
                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  ⚡ Auto
                </span>
              </label>
              <Select
                value={watchedFields.costCenter}
                onValueChange={(value) => setValue("costCenter", value)}
              >
                <SelectTrigger className="bg-accent/5 border-accent/30">
                  <SelectValue placeholder="Select cost center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC-ENG">CC-ENG - Engineering</SelectItem>
                  <SelectItem value="CC-MKT">CC-MKT - Marketing</SelectItem>
                  <SelectItem value="CC-OPS">CC-OPS - Operations</SelectItem>
                  <SelectItem value="CC-HR">CC-HR - Human Resources</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Payment Method
              </label>
              <Select
                value={watchedFields.paymentMethod}
                onValueChange={(value) => setValue("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate-card">Corporate Card</SelectItem>
                  <SelectItem value="personal-card">Personal Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <SmartFormField
                label="Description"
                placeholder="Provide details about this expense..."
                multiline
                isAutoPopulated={false}
                validationStatus={getValidationStatus("description")}
                error={errors.description?.message}
                {...register("description")}
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div className="rounded-xl border border-border bg-card p-6">
          <DocumentUpload
            requiredDocs={category.requiredDocs}
            onFilesChange={onFilesChange}
          />
        </div>
      </div>

      {/* Policy Checks Sidebar */}
      <div className="space-y-6">
        <div className="sticky top-24">
          {/* AI Compliance Card */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6">
            <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <span className="text-lg">🤖</span>
              AI Compliance Score
            </h4>
            <div className="flex justify-center">
              <ComplianceScore score={complianceScore} size="lg" />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              {complianceScore >= 80
                ? "Great! Your claim meets all policy requirements"
                : complianceScore >= 50
                ? "Almost there! Complete the missing fields"
                : "Fill in required fields to improve compliance"}
            </p>
          </div>

          <PolicyChecks checks={policyChecks} />
        </div>
      </div>
    </div>
  );
}
