-- Migration: Create approval_skip_rules table
-- Description: Allows admins to configure rules for skipping approval levels based on designation or email

CREATE TABLE IF NOT EXISTS approval_skip_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Rule identification
    rule_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Match criteria: 'designation' or 'email'
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('designation', 'email')),
    
    -- Designations to match (e.g., ['CEO', 'CTO', 'CFO'])
    designations TEXT[] DEFAULT '{}',
    
    -- Emails to match (e.g., ['ceo@company.com'])
    emails TEXT[] DEFAULT '{}',
    
    -- Which approval levels to skip
    skip_manager_approval BOOLEAN DEFAULT FALSE,
    skip_hr_approval BOOLEAN DEFAULT FALSE,
    skip_finance_approval BOOLEAN DEFAULT FALSE,
    
    -- Optional constraints
    max_amount_threshold DECIMAL(15, 2),  -- NULL means no limit
    category_codes TEXT[] DEFAULT '{}',   -- Empty array means all categories
    
    -- Rule priority (lower = higher priority, checked first)
    priority INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_rule_name_per_tenant UNIQUE (tenant_id, rule_name)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_approval_skip_rules_tenant ON approval_skip_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_skip_rules_active ON approval_skip_rules(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_approval_skip_rules_priority ON approval_skip_rules(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_approval_skip_rules_match_type ON approval_skip_rules(match_type);

-- Add foreign key to tenants table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE approval_skip_rules
            ADD CONSTRAINT fk_approval_skip_rules_tenant
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE approval_skip_rules IS 'Configurable rules for skipping approval levels based on employee designation or email';
COMMENT ON COLUMN approval_skip_rules.match_type IS 'Type of matching: designation or email';
COMMENT ON COLUMN approval_skip_rules.designations IS 'Array of designation codes to match when match_type is designation';
COMMENT ON COLUMN approval_skip_rules.emails IS 'Array of email addresses to match when match_type is email';
COMMENT ON COLUMN approval_skip_rules.max_amount_threshold IS 'Maximum claim amount for this rule to apply (NULL = no limit)';
COMMENT ON COLUMN approval_skip_rules.category_codes IS 'Claim category codes this rule applies to (empty = all categories)';
COMMENT ON COLUMN approval_skip_rules.priority IS 'Lower priority number = checked first (1-100 recommended)';
