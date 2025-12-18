-- Migration: Create audit_logs table for security and compliance logging
-- Date: 2024
-- Description: Creates tamper-proof audit logging infrastructure for SaaS security

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Actor information
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    tenant_id UUID,
    
    -- Resource being accessed/modified
    resource_type VARCHAR(100),
    resource_id UUID,
    
    -- Action details
    action VARCHAR(100),
    action_details JSONB DEFAULT '{}',
    
    -- Request context
    ip_address VARCHAR(45),  -- IPv4 or IPv6
    user_agent VARCHAR(500),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    
    -- Outcome
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Tamper detection
    integrity_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_audit_event_type CHECK (
        event_type IN (
            'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAILED', 'AUTH_TOKEN_REFRESH',
            'AUTH_PASSWORD_CHANGE', 'AUTH_PASSWORD_RESET', 'AUTH_MFA_ENABLED', 'AUTH_MFA_DISABLED',
            'DATA_CREATE', 'DATA_READ', 'DATA_UPDATE', 'DATA_DELETE', 'DATA_EXPORT', 'DATA_BULK_ACCESS',
            'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_RETURNED', 'CLAIM_SETTLED', 'CLAIM_EDITED',
            'ADMIN_ACTION', 'CONFIG_CHANGE', 'PERMISSION_CHANGE',
            'SECURITY_ALERT', 'SUSPICIOUS_ACTIVITY'
        )
    )
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON audit_logs(tenant_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON audit_logs(user_id, event_timestamp);

-- Add comment to table
COMMENT ON TABLE audit_logs IS 'Tamper-proof audit log for security and compliance. Records all security-relevant events and data access patterns.';

-- Add comments to columns
COMMENT ON COLUMN audit_logs.event_type IS 'Type of audit event (AUTH_LOGIN, DATA_READ, CLAIM_APPROVED, etc.)';
COMMENT ON COLUMN audit_logs.integrity_hash IS 'SHA-256 hash of the log entry for tamper detection';
COMMENT ON COLUMN audit_logs.previous_hash IS 'Hash of previous log entry for chain verification';
COMMENT ON COLUMN audit_logs.ip_address IS 'Client IP address (supports IPv4 and IPv6)';
