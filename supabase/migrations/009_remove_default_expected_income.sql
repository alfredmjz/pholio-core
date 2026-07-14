-- Migration: 009_remove_default_expected_income
-- Description: Remove default expected income setting from users

ALTER TABLE public.users 
  DROP COLUMN IF EXISTS default_expected_income;
