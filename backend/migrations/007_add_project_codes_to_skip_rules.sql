-- Migration: Add project_codes column to approval_skip_rules table
-- Description: Allows skip rules to match by project codes in addition to designation and email

-- Add project_codes column
ALTER TABLE approval_skip_rules 
ADD COLUMN IF NOT EXISTS project_codes VARCHAR[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN approval_skip_rules.project_codes IS 'List of project codes for project-based skip rules';

-- Update match_type check constraint to allow 'project' value
-- First drop existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'approval_skip_rules_match_type_check'
    ) THEN
        ALTER TABLE approval_skip_rules DROP CONSTRAINT approval_skip_rules_match_type_check;
    END IF;
END $$;

-- Add new constraint that includes 'project'
ALTER TABLE approval_skip_rules 
ADD CONSTRAINT approval_skip_rules_match_type_check 
CHECK (match_type IN ('designation', 'email', 'project'));
