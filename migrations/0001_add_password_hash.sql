-- Migration: Add password_hash column to users table
-- This enables email/password authentication

-- Add password_hash column (nullable initially to support migration of existing users)
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Create index for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_users_email_password ON users(email, password_hash);
