-- Migration: Change employee_code from globally unique to unique per tenant
-- This allows different tenants to have the same employee codes

-- Drop the old global unique constraint on employee_code
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_code_key;

-- Add composite unique constraint for tenant_id + employee_code
-- This ensures employee_code is unique only within the same tenant
ALTER TABLE users ADD CONSTRAINT uq_users_tenant_employee_code UNIQUE (tenant_id, employee_code);
