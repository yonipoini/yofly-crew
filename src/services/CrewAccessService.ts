import { supabase } from '../lib/supabase';

export const CrewAccessService = {
  async requireVerifiedCrew() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let user = session?.user ?? null;

    if (!user) {
      const {
        data: { user: verifiedUser },
      } = await supabase.auth.getUser();
      user = verifiedUser;
    }

    if (!user) {
      throw new Error('Sign in again before publishing. Your Supabase session is not active on this device.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('verified_crew, verified_marketplace')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!(data?.verified_crew || data?.verified_marketplace)) {
      throw new Error('Complete crew verification before using this feature.');
    }

    return user;
  },
};
