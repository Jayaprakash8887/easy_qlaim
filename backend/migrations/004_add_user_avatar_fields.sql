-- Migration: Add avatar/profile picture fields to users table
-- Date: 2025-12-26
-- Description: Add columns to support user profile picture upload to cloud storage

-- Add avatar columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS avatar_storage_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS avatar_blob_name VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN users.avatar_url IS 'Signed URL or public URL for displaying the avatar';
COMMENT ON COLUMN users.avatar_storage_path IS 'Cloud storage path (e.g., gs://bucket/path)';
COMMENT ON COLUMN users.avatar_blob_name IS 'Blob name for generating signed URLs';

-- Create index for blob_name lookup (used for deletion)
CREATE INDEX IF NOT EXISTS idx_users_avatar_blob_name ON users(avatar_blob_name) WHERE avatar_blob_name IS NOT NULL;
