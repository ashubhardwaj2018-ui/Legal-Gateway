-- Add force_password_change flag to admin_users
-- This column triggers the password-change screen on first login for admin accounts.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;
