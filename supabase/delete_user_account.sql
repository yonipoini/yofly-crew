-- Function to allow authenticated users to delete their own account from auth.users
-- This cascades automatically to public.profiles, manual_review_requests, and all related tables.

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the authenticated user from auth.users
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Allow authenticated users to execute this function
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
