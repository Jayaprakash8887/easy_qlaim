// User roles
export type UserRole = 'employee' | 'manager' | 'hr' | 'finance' | 'admin';

// Claim status
export type ClaimStatus = 
  | 'draft'
  | 'submitted'
  | 'pending_manager'
  | 'pending_hr'
  | 'pending_finance'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'settled';

// Claim type
export type ClaimType = 'reimbursement' | 'allowance';

// Data source tracking
export type DataSource = 'ocr' | 'manual' | 'edited';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  managerId?: string;
  avatar?: string;
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
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: Date;
  vendor: string;
  description?: string;
  projectCode?: string;
  costCenter?: string;
  status: ClaimStatus;
  submittedBy: User;
  submittedAt: Date;
  documents: ClaimDocument[];
  comments: ClaimComment[];
  approvalHistory: ApprovalHistoryItem[];
  aiConfidenceScore?: number;
  policyViolations: string[];
  dataSource: Record<string, DataSource>;
}

// Document interface
export interface ClaimDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  ocrData?: Record<string, any>;
  ocrConfidence?: number;
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
