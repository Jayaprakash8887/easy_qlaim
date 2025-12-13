// Allowance Types
export type AllowanceType = 'on_call' | 'shift' | 'work_incentive' | 'food';

export type AllowanceStatus = 
  | 'draft'
  | 'submitted'
  | 'pending_manager'
  | 'approved'
  | 'rejected'
  | 'payroll_ready';

export interface AllowancePolicy {
  id: string;
  type: AllowanceType;
  name: string;
  description: string;
  maxAmount: number;
  taxable: boolean;
  requiresApproval: boolean;
  eligibilityRules: string[];
  cutOffDate: number; // Day of month
  enabled: boolean;
}

export interface Allowance {
  id: string;
  allowanceNumber: string;
  type: AllowanceType;
  amount: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  status: AllowanceStatus;
  submittedBy: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  submittedAt: Date;
  payrollMonth: string;
  payrollCycle: string;
  taxable: boolean;
  aiEligibilityScore?: number;
  aiDecisionReason?: string;
  approvalHistory: AllowanceApprovalItem[];
  comments: AllowanceComment[];
  sourceData?: {
    timesheetHours?: number;
    shiftCount?: number;
    attendancePercentage?: number;
    location?: string;
  };
}

export interface AllowanceApprovalItem {
  id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'escalated';
  actor: {
    id: string;
    name: string;
    role: string;
  };
  timestamp: Date;
  comment?: string;
  fromStatus: AllowanceStatus;
  toStatus: AllowanceStatus;
}

export interface AllowanceComment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: Date;
}

export interface AllowanceSummary {
  type: AllowanceType;
  label: string;
  pending: number;
  approved: number;
  totalValue: number;
  icon: string;
}
