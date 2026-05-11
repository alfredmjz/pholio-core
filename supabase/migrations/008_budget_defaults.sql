-- Migration: 008_budget_defaults
-- Description: Add default expected income setting to users
-- Previous: 007_unified_transaction_rpc.sql

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS default_expected_income DECIMAL(15,2) DEFAULT 0 CHECK (default_expected_income >= 0);

-- Trigger to update updated_at if needed, already handled by update_users_updated_at trigger.

-- Update view permissions if needed, users table is already handled.
