import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Phone,
  Clock,
  TrendingUp,
  Utensils,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { allowancePolicies } from '@/data/mockAllowances';
import { AllowanceType } from '@/types/allowance';

const typeIcons: Record<AllowanceType, React.ElementType> = {
  on_call: Phone,
  shift: Clock,
  work_incentive: TrendingUp,
  food: Utensils,
};

const typeColors: Record<AllowanceType, string> = {
  on_call: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  shift: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  work_incentive: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  food: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
};

const steps = [
  { id: 'type', label: 'Select Type' },
  { id: 'details', label: 'Enter Details' },
  { id: 'review', label: 'Review & Submit' },
];

export default function NewAllowance() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<AllowanceType | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    periodStart: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    periodEnd: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    description: '',
    projectCode: '',
  });
  const [aiScore, setAiScore] = useState(0);

  const selectedPolicy = selectedType
    ? allowancePolicies.find((p) => p.type === selectedType)
    : null;

  const handleTypeSelect = (type: AllowanceType) => {
    setSelectedType(type);
    // Simulate AI calculation
    const scores: Record<AllowanceType, number> = {
      on_call: 92,
      shift: 88,
      work_incentive: 78,
      food: 100,
    };
    setAiScore(scores[type]);
  };

  const handleNext = () => {
    if (currentStep === 0 && !selectedType) {
      toast.error('Please select an allowance type');
      return;
    }
    if (currentStep === 1 && !formData.amount) {
      toast.error('Please enter the amount');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = () => {
    toast.success('Allowance claim submitted successfully!');
    navigate('/allowances');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Allowance Claim</h1>
          <p className="text-muted-foreground">Submit a new allowance claim</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/allowances')}>
          Cancel
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                index < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : index === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={cn(
                'ml-2 hidden text-sm font-medium sm:inline',
                index === currentStep ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className="mx-4 h-px w-12 bg-border" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Step 1: Select Type */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Allowance Type</CardTitle>
                <CardDescription>
                  Choose the type of allowance you want to claim
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {allowancePolicies
                    .filter((p) => p.enabled)
                    .map((policy) => {
                      const Icon = typeIcons[policy.type];
                      return (
                        <div
                          key={policy.id}
                          onClick={() => handleTypeSelect(policy.type)}
                          className={cn(
                            'cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md',
                            selectedType === policy.type
                              ? `${typeColors[policy.type]} border-2`
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{policy.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {policy.description}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <Badge variant="outline">
                                  Max ₹{policy.maxAmount.toLocaleString()}
                                </Badge>
                                {policy.taxable && (
                                  <Badge variant="secondary">Taxable</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Enter Details */}
          {currentStep === 1 && selectedPolicy && (
            <Card>
              <CardHeader>
                <CardTitle>Enter Details</CardTitle>
                <CardDescription>
                  Provide the details for your {selectedPolicy.name} claim
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: ₹{selectedPolicy.maxAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectCode">Project Code (Optional)</Label>
                    <Select
                      value={formData.projectCode}
                      onValueChange={(value) =>
                        setFormData({ ...formData, projectCode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRJ-001">PRJ-001: Website Redesign</SelectItem>
                        <SelectItem value="PRJ-002">PRJ-002: Mobile App</SelectItem>
                        <SelectItem value="PRJ-003">PRJ-003: CRM System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="periodStart">Period Start</Label>
                    <Input
                      id="periodStart"
                      type="date"
                      value={formData.periodStart}
                      onChange={(e) =>
                        setFormData({ ...formData, periodStart: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodEnd">Period End</Label>
                    <Input
                      id="periodEnd"
                      type="date"
                      value={formData.periodEnd}
                      onChange={(e) =>
                        setFormData({ ...formData, periodEnd: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Additional Notes (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add any additional notes or justification..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                {/* Auto-filled Source Data */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Auto-filled from System</span>
                  </div>
                  <div className="grid gap-2 text-sm">
                    {selectedType === 'on_call' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">On-Call Shifts</span>
                          <span className="font-medium">12 shifts (from Roster)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Hours</span>
                          <span className="font-medium">96 hours</span>
                        </div>
                      </>
                    )}
                    {selectedType === 'shift' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Night Shifts</span>
                          <span className="font-medium">8 shifts (from Timesheet)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekend Shifts</span>
                          <span className="font-medium">4 shifts</span>
                        </div>
                      </>
                    )}
                    {selectedType === 'food' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Office Days</span>
                          <span className="font-medium">22 days (from Attendance)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span className="font-medium">Mumbai HQ</span>
                        </div>
                      </>
                    )}
                    {selectedType === 'work_incentive' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Target Achievement</span>
                          <span className="font-medium">118% (from Performance)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Attendance</span>
                          <span className="font-medium">96%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && selectedPolicy && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
                <CardDescription>
                  Review your allowance claim before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Claim Summary</h3>
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedPolicy.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">₹{Number(formData.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span className="font-medium">
                        {format(new Date(formData.periodStart), 'MMM dd')} -{' '}
                        {format(new Date(formData.periodEnd), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxable</span>
                      <span className="font-medium">{selectedPolicy.taxable ? 'Yes' : 'No'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payroll Month</span>
                      <span className="font-medium">{format(new Date(), 'MMMM yyyy')}</span>
                    </div>
                  </div>
                </div>

                {/* Eligibility Rules */}
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Eligibility Rules</h3>
                  <div className="space-y-2">
                    {selectedPolicy.eligibilityRules.map((rule, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5" />
                        <span className="text-sm">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.description && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Additional Notes</h3>
                    <p className="text-sm text-muted-foreground">{formData.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {selectedPolicy && (
            <>
              {/* AI Eligibility Score */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">AI Eligibility Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="relative h-32 w-32">
                      <svg className="h-full w-full -rotate-90 transform">
                        <circle
                          className="text-muted"
                          strokeWidth="10"
                          stroke="currentColor"
                          fill="transparent"
                          r="55"
                          cx="64"
                          cy="64"
                        />
                        <circle
                          className={cn(
                            aiScore >= 80
                              ? 'text-green-500'
                              : aiScore >= 60
                              ? 'text-amber-500'
                              : 'text-red-500'
                          )}
                          strokeWidth="10"
                          strokeDasharray={`${aiScore * 3.45} 345`}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="55"
                          cx="64"
                          cy="64"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold">{aiScore}%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {aiScore >= 80
                      ? 'High eligibility - likely to be auto-approved'
                      : aiScore >= 60
                      ? 'Medium eligibility - requires manager review'
                      : 'Low eligibility - may be rejected'}
                  </p>
                </CardContent>
              </Card>

              {/* Policy Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Policy Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Maximum Amount</span>
                    <span className="font-medium">₹{selectedPolicy.maxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cut-off Date</span>
                    <span className="font-medium">{selectedPolicy.cutOffDate}th of month</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requires Approval</span>
                    <span className="font-medium">{selectedPolicy.requiresApproval ? 'Yes' : 'No'}</span>
                  </div>
                  {Number(formData.amount) > selectedPolicy.maxAmount && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <span className="text-sm">Amount exceeds policy maximum</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="gradient">
            Submit Allowance
            <Check className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
