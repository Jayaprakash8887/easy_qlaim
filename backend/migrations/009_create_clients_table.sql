-- Migration: Create clients table and add client_id to projects
-- Date: 2026-01-04
-- Description: Add client management feature - clients table with optional project linking

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Client identification
    client_code VARCHAR(50) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Contact information
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Additional data
    client_data JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_client_tenant_code UNIQUE (tenant_id, client_code)
);

-- Create indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);

-- Add client_id column to projects table (optional foreign key)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Create index for client_id in projects
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON clients;
CREATE TRIGGER trigger_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_clients_updated_at();

-- Comments for documentation
COMMENT ON TABLE clients IS 'Client/Customer master for tenant organizations';
COMMENT ON COLUMN clients.client_code IS 'Unique client code per tenant';
COMMENT ON COLUMN clients.client_name IS 'Full client/company name';
COMMENT ON COLUMN clients.client_data IS 'Additional client metadata in JSON format';
COMMENT ON COLUMN projects.client_id IS 'Optional reference to client this project belongs to';
