-- Migration: Change project_code unique constraint to be tenant-specific
-- Created: 2024-12-29
-- 
-- This allows different tenants to have projects with the same code.
-- Run this script in your PostgreSQL database.

-- Step 1: Drop the existing unique constraint on project_code alone
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_code_key;

-- Step 2: Add composite unique constraint on (tenant_id, project_code)
ALTER TABLE projects 
ADD CONSTRAINT uq_project_tenant_code 
UNIQUE (tenant_id, project_code);

-- Verify the change
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'projects'::regclass 
AND conname LIKE '%project%';
