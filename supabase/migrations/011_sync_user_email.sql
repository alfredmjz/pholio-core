-- Keep the denormalized profile email in sync with Supabase Auth.
--
-- Financial records reference auth.users(id) through user_id, so changing an
-- email never changes ownership of existing data. public.users.email is only a
-- display copy, but it must follow the auth email to avoid stale profiles and
-- unique-constraint collisions on future sign-ups.

CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
        UPDATE public.users
        SET email = NEW.email,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RAISE WARNING 'Could not sync email for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Could not sync email for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (NEW.email IS DISTINCT FROM OLD.email)
    EXECUTE FUNCTION public.handle_user_email_update();

-- Backfill profiles whose auth email already changed before this trigger existed.
-- Skip rows where syncing would collide with an existing profile email.
UPDATE public.users AS u
SET email = a.email,
    updated_at = NOW()
FROM auth.users AS a
WHERE a.id = u.id
  AND u.email IS DISTINCT FROM a.email
  AND a.email IS NOT NULL
  AND a.email <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM public.users AS other
      WHERE other.id <> u.id
        AND other.email = a.email
  );
