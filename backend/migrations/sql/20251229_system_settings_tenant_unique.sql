-- Migration: Change system_settings unique constraint to be tenant-specific
-- Created: 2024-12-29
-- 
-- This allows different tenants to have the same setting keys.
-- Run this script in your PostgreSQL database.

-- Step 1: Drop the existing unique constraint on setting_key alone
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;

-- Step 2: Add composite unique constraint on (tenant_id, setting_key)
ALTER TABLE system_settings 
ADD CONSTRAINT uq_settings_tenant_key 
UNIQUE (tenant_id, setting_key);

-- Verify the change
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'system_settings'::regclass 
AND conname LIKE '%setting%' OR conname LIKE '%tenant%';
