-- Migration: Increase avatar_url column length for signed URLs
-- Date: 2025-12-26
-- Description: Signed URLs from GCS can be very long (1000+ chars), need to increase column length

-- Change avatar_url from VARCHAR(500) to TEXT to accommodate long signed URLs
ALTER TABLE users 
ALTER COLUMN avatar_url TYPE TEXT;

-- Also increase avatar_storage_path just in case (longer tenant paths)
ALTER TABLE users 
ALTER COLUMN avatar_storage_path TYPE VARCHAR(1000);

COMMENT ON COLUMN users.avatar_url IS 'Signed URL for displaying the avatar (can be long due to signature params)';
