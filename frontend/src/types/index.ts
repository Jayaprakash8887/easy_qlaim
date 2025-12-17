// User roles
export type UserRole = 'employee' | 'manager' | 'hr' | 'finance' | 'admin';

// Claim status
export type ClaimStatus = 
  | 'pending_manager'
  | 'pending_hr'
  | 'pending_finance'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'settled';

// Claim type
export type ClaimType = 'reimbursement' | 'allowance';

// Data source tracking - 'auto'/'ocr' for auto-extracted, 'manual' for user-entered, 'edited' for user-modified
export type DataSource = 'ocr' | 'auto' | 'manual' | 'edited';

// User interface (extended with employee details for mock auth)
export interface User {
  id: string;
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
  region?: string;  // Region/location for policy applicability
  joinDate?: string;
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
  region?: string;  // Region/location for policy applicability
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
}
