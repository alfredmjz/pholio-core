-- Migration: 001_core
-- Description: Core helpers, user profiles, and identity management

-- =============================================================================
-- GLOBAL SETTINGS & HELPERS
-- =============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================================================
-- TABLE: users
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT false NOT NULL,
    guest_name TEXT,
    timezone TEXT DEFAULT NULL,
    has_seen_welcome BOOLEAN DEFAULT false NOT NULL,
    -- Allocation settings: Controls default behavior when navigating to a new month
    allocation_new_month_default TEXT DEFAULT 'dialog'
        CHECK (allocation_new_month_default IN ('dialog', 'import_previous', 'template', 'fresh')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

COMMENT ON COLUMN public.users.timezone IS 'IANA timezone identifier (e.g. America/New_York). NULL means use system-detected timezone.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can insert profiles" ON public.users;
CREATE POLICY "Service role can insert profiles" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- TRIGGERS: User Profile Creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    guest_names TEXT[] := ARRAY['Wandering Traveler', 'Mystery Guest', 'Anonymous Visitor', 'Curious Explorer', 'Digital Nomad', 'Silent Observer', 'Phantom User', 'Shadow Walker'];
    random_guest_name TEXT;
    is_anonymous BOOLEAN;
BEGIN
    is_anonymous := (NEW.email IS NULL OR NEW.email = '');
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
    WHEN unique_violation THEN RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Could not create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_is_guest_idx ON public.users(is_guest);

-- Update trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
