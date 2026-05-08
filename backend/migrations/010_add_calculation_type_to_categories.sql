-- Migration: Add calculation_type and rate_per_unit to policy_categories
-- This enables different calculation methods for allowances:
--   - per_day: Working Days × Per Day Rate (default, current behavior)
--   - per_km: Distance × Rate per KM × Number of Trips (for conveyance)
--   - fixed: Direct amount entry (no calculation)

-- Add calculation_type column
ALTER TABLE policy_categories 
ADD COLUMN IF NOT EXISTS calculation_type VARCHAR(20) DEFAULT 'per_day';

-- Add rate_per_unit column (used as per-day rate OR per-km rate based on calculation_type)
ALTER TABLE policy_categories 
ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(12, 2);

-- Add check constraint for valid calculation types
ALTER TABLE policy_categories 
DROP CONSTRAINT IF EXISTS valid_calculation_type;

ALTER TABLE policy_categories 
ADD CONSTRAINT valid_calculation_type 
CHECK (calculation_type IN ('per_day', 'per_km', 'fixed'));

-- Create index for calculation_type
CREATE INDEX IF NOT EXISTS idx_policy_categories_calc_type 
ON policy_categories(calculation_type);

-- Update existing records: set calculation_type based on category_type
-- Reimbursements default to 'fixed', Allowances to 'per_day'
UPDATE policy_categories 
SET calculation_type = CASE 
    WHEN category_type = 'REIMBURSEMENT' THEN 'fixed'
    ELSE 'per_day'
END
WHERE calculation_type IS NULL;

-- Copy max_amount to rate_per_unit for allowances (represents per-day rate)
UPDATE policy_categories 
SET rate_per_unit = max_amount
WHERE category_type = 'ALLOWANCE' AND rate_per_unit IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN policy_categories.calculation_type IS 'How the claim amount is calculated: per_day (working days × rate), per_km (distance × rate × trips), fixed (direct entry)';
COMMENT ON COLUMN policy_categories.rate_per_unit IS 'Rate per unit: per-day rate for per_day type, per-km rate for per_km type, ignored for fixed type';
