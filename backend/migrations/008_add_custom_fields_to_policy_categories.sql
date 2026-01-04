-- Migration: Add custom_fields column to policy_categories table
-- Date: 2026-01-04
-- Description: Add ability to define custom fields for extracted claim categories (same as custom_claims)

-- Add custom_fields column to policy_categories table
ALTER TABLE policy_categories
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN policy_categories.custom_fields IS 'JSON array of custom field definitions for this claim category';
