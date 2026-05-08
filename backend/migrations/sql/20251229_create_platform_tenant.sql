-- Migration: Create Platform Tenant for system-wide settings
-- Created: 2024-12-29
-- 
-- This creates a special "Platform" tenant used for system-wide settings
-- that are not tenant-specific (e.g., maintenance mode, platform email settings)

-- Insert Platform tenant if it doesn't exist
INSERT INTO tenants (id, name, code, domain, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Platform',
    'PLATFORM',
    'platform.internal',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verify the platform tenant exists
SELECT id, name, code FROM tenants WHERE id = '00000000-0000-0000-0000-000000000000';
