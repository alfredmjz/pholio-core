-- ⚠️ DANGER ZONE: This script wipes the ENTIRE database state ⚠️
-- Run this ONLY if you want to completely reset your environment.

-- 1. Reset Public Schema (Drops all tables: users, accounts, allocations, etc.)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2. Restore standard permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
COMMENT ON SCHEMA public IS 'standard public schema';

-- 3. (Optional) Wipe Auth Users
-- Remove the '--' comments below if you also want to delete all registered users
TRUNCATE TABLE auth.users CASCADE;

-- 4. (Optional) Wipe Storage Objects
-- Remove the '--' comments below if you want to assume storage buckets are empty
DELETE FROM storage.objects;
