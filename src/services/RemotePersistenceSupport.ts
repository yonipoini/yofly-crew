import { supabase } from '../lib/supabase';

const MISSING_RELATION_CODES = new Set(['42P01', 'PGRST205']);

export const getSignedInUserId = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (_error) {
    return null;
  }
};

export const shouldFallbackToLocalPersistence = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String((error as { code?: string }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';

  return (
    MISSING_RELATION_CODES.has(code) ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
};
