/**
 * Company-wide configuration settings
 * Centralized configuration for roles, designations, and other company-specific data
 * Note: Departments are now tenant-specific and managed via the API
 */

// Employee roles
export const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
] as const;


// Employment types
export const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full Time' },
  { value: 'part-time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'consultant', label: 'Consultant' },
] as const;

export type Role = typeof ROLES[number]['value'];
export type Designation = typeof DESIGNATIONS[number];

