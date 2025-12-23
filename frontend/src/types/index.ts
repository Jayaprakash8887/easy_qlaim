// User roles
export type UserRole = 'employee' | 'manager' | 'hr' | 'finance' | 'admin' | 'system_admin';

// Claim status
export type ClaimStatus =
  | 'pending_manager'
  | 'pending_hr'
  | 'pending_finance'
  | 'approved'
  | 'finance_approved'
  | 'rejected'
  | 'returned'
  | 'settled';

// Claim type
export type ClaimType = 'reimbursement' | 'allowance';

// Data source tracking - 'auto'/'ocr' for auto-extracted, 'manual' for user-entered, 'edited' for user-modified, 'hr' for HR-edited
export type DataSource = 'ocr' | 'auto' | 'manual' | 'edited' | 'hr';

// User interface (extended with employee details for mock auth)
export interface User {
  id: string;
  tenantId?: string;  // Tenant ID for multi-tenancy filtering
  email: string;
  name: string;
  role: UserRole;
  department: string;
  managerId?: string;
  avatar?: string;
  // Extended employee fields
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  designation?: string;
  region?: string[];
  joinDate?: string | Date;
  status?: 'active' | 'inactive' | 'on_leave';
  projectIds?: string[];
}

// Category interface
export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  maxAmount: number;
  requiresDocument: boolean;
  description: string;
}

// Claim interface
export interface Claim {
  id: string;
  claimNumber: string;
  type: ClaimType;
  category: ExpenseCategory | string;
  title: string;
  amount: number;
  date?: Date;
  vendor?: string;
  description?: string;
  projectCode?: string;
  projectName?: string;  // Human-readable project name
  costCenter?: string;
  transactionRef?: string;
  status: ClaimStatus;
  submittedBy?: User;
  submittedAt?: Date;
  submissionDate?: Date;
  claimDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;  // Latest modified time
  employeeId?: string;
  employeeName?: string;
  department?: string;
  currency?: string;
  documents: ClaimDocument[];
  comments?: ClaimComment[];
  approvalHistory?: ApprovalHistoryItem[];
  aiConfidenceScore?: number;
  aiConfidence?: number;
  aiProcessed?: boolean;
  aiRecommendation?: 'approve' | 'review' | 'reject';
  aiRecommendationText?: string;
  complianceScore?: number;
  policyChecks?: PolicyCheck[];
  policyViolations?: string[];
  dataSource?: Record<string, DataSource>;
  // Return workflow fields
  returnReason?: string;
  returnCount?: number;
  returnedAt?: Date;
  canEdit?: boolean;
  // Settlement fields
  settledDate?: Date;
  paymentReference?: string;
  paymentMethod?: string;
}

// Policy Check interface
export interface PolicyCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  message?: string;
}

// Document interface
export interface ClaimDocument {
  id: string;
  name: string;
  filename?: string;  // from backend
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  ocrData?: Record<string, any>;
  ocrConfidence?: number;
  // GCS storage fields
  gcsUri?: string;
  gcsBlobName?: string;
  storageType?: 'local' | 'gcs';
  contentType?: string;
  downloadUrl?: string;
}

// Comment interface
export interface ClaimComment {
  id: string;
  content: string;
  author: User;
  createdAt: Date;
  role: UserRole;
}

// Approval history
export interface ApprovalHistoryItem {
  id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'escalated';
  actor: User;
  timestamp: Date;
  comment?: string;
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
}

// Navigation item
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  roles?: UserRole[];
  children?: NavItem[];
}

// Employee interface
export interface Employee extends User {
  employeeId: string;
  phone?: string;
  mobile?: string;
  address?: string;
  firstName?: string;
  lastName?: string;
  designation?: string;
  region?: string[];  // Region/location for policy applicability
  joinDate: Date | string;
  status: 'active' | 'inactive' | 'on_leave';
  managerId?: string;
  projectIds: string[];
}

// Project interface
export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  budget: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'on_hold';
  managerId: string;
  memberIds: string[];
  ibuId?: string;
}

// IBU (Independent Business Unit) interface
export interface IBU {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  head_id?: string;
  annual_budget?: number;
  budget_spent?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Region interface
export interface Region {
  id: string;
  name: string;
  code?: string;
  currency?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Approval Skip Rule interface
export interface ApprovalSkipRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  description?: string;
  match_type: 'designation' | 'email';
  designations: string[];
  emails: string[];
  skip_manager_approval: boolean;
  skip_hr_approval: boolean;
  skip_finance_approval: boolean;
  max_amount_threshold?: number;
  category_codes: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Approval Skip Result (from check endpoint)
export interface ApprovalSkipResult {
  skip_manager: boolean;
  skip_hr: boolean;
  skip_finance: boolean;
  applied_rule_id?: string;
  applied_rule_name?: string;
  reason: string;
}
