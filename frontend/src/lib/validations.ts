import { z } from 'zod';

// Employee validation schema
export const employeeSchema = z.object({
  employeeId: z.string()
    .trim()
    .min(1, 'Employee ID is required')
    .max(20, 'Employee ID must be less than 20 characters'),
  firstName: z.string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z.string()
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  phone: z.string()
    .trim()
    .optional(),
  mobile: z.string()
    .trim()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(15, 'Mobile number must be less than 15 digits'),
  address: z.string()
    .trim()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  department: z.string()
    .min(1, 'Department is required'),
  designation: z.string().optional(),
  region: z.array(z.string()).optional(),
  dateOfJoining: z.string().optional(),
  managerId: z.string().optional(),
  projectIds: z.string().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;

// Project validation schema
export const projectSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
  code: z.string()
    .trim()
    .min(1, 'Project code is required')
    .max(20, 'Project code must be less than 20 characters')
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, and hyphens only'),
  description: z.string()
    .trim()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  budget: z.number()
    .min(0, 'Budget must be a positive number')
    .max(10000000, 'Budget cannot exceed $10,000,000'),
  managerId: z.string()
    .min(1, 'Project manager is required'),
  memberIds: z.array(z.string()).optional(),
  ibuId: z.string().optional(),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date().optional(),
  status: z.string().optional(),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// Settlement validation schema
export const settlementSchema = z.object({
  claimIds: z.array(z.string())
    .min(1, 'At least one claim must be selected'),
  paymentMethod: z.enum(['neft', 'rtgs', 'check', 'upi'], {
    errorMap: () => ({ message: 'Please select a payment method' }),
  }),
  paymentReference: z.string()
    .trim()
    .min(1, 'Payment reference is required')
    .max(50, 'Payment reference must be less than 50 characters'),
  notes: z.string()
    .trim()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});

export type SettlementFormData = z.infer<typeof settlementSchema>;

// Claim comment validation
export const commentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment must be less than 1000 characters'),
});

export type CommentFormData = z.infer<typeof commentSchema>;

// Profile update validation
export const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string()
    .trim()
    .email('Invalid email address'),
  phone: z.string()
    .trim()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  bankName: z.string()
    .trim()
    .max(100, 'Bank name must be less than 100 characters')
    .optional(),
  accountNumber: z.string()
    .trim()
    .max(30, 'Account number must be less than 30 characters')
    .optional(),
  ifscCode: z.string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// Approval action validation
export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'return']),
  comment: z.string()
    .trim()
    .min(1, 'Comment is required for this action')
    .max(500, 'Comment must be less than 500 characters'),
  returnReason: z.string().optional(),
});

export type ApprovalActionFormData = z.infer<typeof approvalActionSchema>;
