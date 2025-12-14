-- Migration: 001_create_users_table
-- Description: Creates the users table for storing user profile information
-- Created: 2025-01-08

-- Drop existing trigger first (to prevent it firing during cleanup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT false NOT NULL,
    guest_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can insert their own profile (when authenticated)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy: Service role can insert any profile (for triggers)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.users;
CREATE POLICY "Service role can insert profiles"
ON public.users
FOR INSERT
WITH CHECK (true);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Create function to automatically create profile on user signup
-- SECURITY DEFINER allows the function to bypass RLS
-- Supports both registered users and anonymous guest users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    guest_names TEXT[] := ARRAY[
        'Wandering Traveler',
        'Mystery Guest',
        'Anonymous Visitor',
        'Curious Explorer',
        'Digital Nomad',
        'Silent Observer',
        'Phantom User',
        'Shadow Walker'
    ];
    random_guest_name TEXT;
    is_anonymous BOOLEAN;
BEGIN
    -- Determine if this is an anonymous/guest user
    is_anonymous := (NEW.email IS NULL OR NEW.email = '');

    -- Generate random guest name for anonymous users
    IF is_anonymous THEN
        random_guest_name := guest_names[1 + floor(random() * array_length(guest_names, 1))];
    END IF;

    INSERT INTO public.users (id, email, full_name, is_guest, guest_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, 'guest-' || NEW.id || '@pholio.local'),
        NEW.raw_user_meta_data->>'full_name',
        is_anonymous,
        random_guest_name,
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User already exists, do nothing
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error and continue (don't fail user creation)
        RAISE WARNING 'Could not create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_is_guest_idx ON public.users(is_guest);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
