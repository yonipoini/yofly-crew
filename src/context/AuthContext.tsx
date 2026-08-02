import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AdminService } from '../services/AdminService';
import { CrewVerificationService } from '../services/CrewVerificationService';
import { ProfileRemoteService } from '../services/ProfileRemoteService';
import { CrewVerificationMethod, CrewVerificationStatus } from '../types/verification';
import { useProfile } from './ProfileContext';
import { ModerationService } from '../services/ModerationService';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isReady: boolean;
  isSubmitting: boolean;
  isAdmin: boolean;
  isPasswordRecoveryFlow: boolean;
  signUpWithWorkEmail: (params: { email: string; password: string }) => Promise<void>;
  signInWithWorkEmail: (params: { email: string; password: string }) => Promise<void>;
  sendPasswordRecoveryEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfileToRemote: (profileOverride?: Parameters<typeof ProfileRemoteService.saveProfile>[1]) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const EMAIL_REDIRECT_TO = Linking.createURL('/onboarding', {
  queryParams: { step: 'verify-form' },
});
const PASSWORD_RESET_REDIRECT_TO =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/reset-password`
    : Linking.createURL('/reset-password');
const LOCAL_PROFILE_WRITE_GUARD_MS = 12000;

const SUPABASE_PROJECT_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

const normalizeAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || 'Authentication failed.');
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid email or password') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return new Error('Wrong email or password. Check the password and try again.');
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return new Error('That email is not confirmed yet. Open the verification email first, then sign in again.');
  }

  if (normalizedMessage.includes('network request failed')) {
    const host = SUPABASE_PROJECT_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'your Supabase project';

    return new Error(
      `Cannot reach Supabase (${host}). Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY match the active Supabase project, then restart Expo with a cleared cache.`
    );
  }

  return error instanceof Error ? error : new Error(message);
};

const clearPersistedAuthSession = async () => {
  const storageKeys = await AsyncStorage.getAllKeys();
  const supabaseKeys = storageKeys.filter((key) => key.startsWith('sb-'));

  if (supabaseKeys.length > 0) {
    await AsyncStorage.multiRemove(supabaseKeys);
  }
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { profile, isReady: isProfileReady, lastLocalWriteAt, updateProfile, mergeProfile, resetProfile } = useProfile();
  const latestProfileRef = useRef(profile);
  const lastLocalWriteAtRef = useRef(lastLocalWriteAt);
  const handledAuthUrlsRef = useRef(new Set<string>());
  const authUrlPromiseRef = useRef<Promise<Session | null> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState(false);

  const cleanupWebRecoveryUrl = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const current = new URL(window.location.href);
    current.hash = '';

    if (
      current.pathname === '/reset-password' &&
      current.searchParams.has('code')
    ) {
      current.searchParams.delete('code');
    }

    window.history.replaceState({}, document.title, `${current.pathname}${current.search}`);
  };

  const handleAuthUrl = async (url: string | null): Promise<Session | null> => {
    if (!url) {
      return null;
    }

    const parsed = Linking.parse(url);
    const queryParams = parsed.queryParams || {};
    const hashParams = new URLSearchParams(url.split('#')[1] || '');
    const code = typeof queryParams.code === 'string' ? queryParams.code : undefined;
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const authKey = code
      ? `code:${code}`
      : accessToken && refreshToken
      ? `tokens:${accessToken.slice(0, 12)}:${refreshToken.slice(0, 12)}`
      : null;

    if (!authKey) {
      return null;
    }

    if (handledAuthUrlsRef.current.has(authKey)) {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      return currentSession;
    }

    if (authUrlPromiseRef.current) {
      return authUrlPromiseRef.current;
    }

    const authUrlPromise = (async () => {
      handledAuthUrlsRef.current.add(authKey);

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          handledAuthUrlsRef.current.delete(authKey);
          console.warn('Failed to exchange Supabase auth code:', error);
          return null;
        }

        cleanupWebRecoveryUrl();
        setIsPasswordRecoveryFlow(true);
        setSession(data.session);
        return data.session;
      }

      if (!accessToken || !refreshToken) {
        handledAuthUrlsRef.current.delete(authKey);
        return null;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        handledAuthUrlsRef.current.delete(authKey);
        console.warn('Failed to restore Supabase recovery session:', error);
        return null;
      }

      cleanupWebRecoveryUrl();
      setIsPasswordRecoveryFlow(true);
      setSession(data.session);
      return data.session;
    })();

    authUrlPromiseRef.current = authUrlPromise;

    try {
      return await authUrlPromise;
    } finally {
      authUrlPromiseRef.current = null;
    }
  };

  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    lastLocalWriteAtRef.current = lastLocalWriteAt;
  }, [lastLocalWriteAt]);

  const syncVerifiedProfile = async (user: User) => {
    if (!user.email) {
      return;
    }

    const currentProfile = latestProfileRef.current;
    const localWriteIsSettling = Date.now() - lastLocalWriteAtRef.current < LOCAL_PROFILE_WRITE_GUARD_MS;

    let remoteProfile: Partial<typeof currentProfile> | null = null;

    try {
      remoteProfile = await ProfileRemoteService.fetchProfile(user.id);
    } catch (error) {
      console.warn('Failed to load remote profile before verification sync:', error);
    }

    const effectiveProfile = {
      ...currentProfile,
      ...(remoteProfile || {}),
    };

    if (localWriteIsSettling) {
      return;
    }

    const remoteManualApproval =
      Boolean(remoteProfile?.verifiedCrew || remoteProfile?.verifiedMarketplace) ||
      (effectiveProfile.verifiedCrew &&
        effectiveProfile.verificationMethod === CrewVerificationMethod.MANUAL_REVIEW);

    const verification = await CrewVerificationService.checkAirlineEmail(user.email, effectiveProfile.roleLabel);

    if (Date.now() - lastLocalWriteAtRef.current < LOCAL_PROFILE_WRITE_GUARD_MS) {
      return;
    }

    const isCrewVerified =
      remoteManualApproval || (Boolean(user.email_confirmed_at) && verification.matched);

    const nextStatus = remoteManualApproval
      ? CrewVerificationStatus.VERIFIED_CREW
      : isCrewVerified
      ? CrewVerificationStatus.VERIFIED_CREW
      : verification.matched
        ? CrewVerificationStatus.PENDING_EMAIL
        : CrewVerificationStatus.PENDING_MANUAL;

    const nextMethod = remoteManualApproval
      ? CrewVerificationMethod.MANUAL_REVIEW
      : verification.matched
      ? CrewVerificationMethod.AIRLINE_EMAIL
      : CrewVerificationMethod.MANUAL_REVIEW;

    await ProfileRemoteService.saveProfile(user.id, {
      ...effectiveProfile,
      workEmail: verification.normalizedEmail,
      verificationAirline: verification.airlineName ?? effectiveProfile.verificationAirline,
      verificationStatus: nextStatus,
      verificationMethod: nextMethod,
      verifiedCrew: isCrewVerified,
      verifiedMarketplace: isCrewVerified,
    }, {
      verified_at: isCrewVerified ? new Date().toISOString() : null,
      manual_review_requested_at:
        nextStatus === CrewVerificationStatus.PENDING_MANUAL ? new Date().toISOString() : null,
    });

    mergeProfile({
      ...(remoteProfile || {}),
      workEmail: verification.normalizedEmail,
      verificationAirline: verification.airlineName ?? effectiveProfile.verificationAirline,
      verificationStatus: nextStatus,
      verificationMethod: nextMethod,
      verifiedCrew: isCrewVerified,
      verifiedMarketplace: isCrewVerified,
      airline:
        verification.airlineName && (!effectiveProfile.airline || effectiveProfile.airline === 'YoFly Crew')
          ? verification.airlineName
          : effectiveProfile.airline,
    }, { source: 'remote' });
  };

  const saveProfileToRemote = async (
    profileOverride: Parameters<typeof ProfileRemoteService.saveProfile>[1] = profile
  ) => {
    let activeUser = session?.user ?? null;

    if (!activeUser) {
      const {
        data: { session: latestSession },
      } = await supabase.auth.getSession();
      activeUser = latestSession?.user ?? null;
    }

    if (!activeUser) {
      return;
    }

    await ProfileRemoteService.saveProfile(activeUser.id, profileOverride);
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      let bootSession: Session | null = null;

      try {
        await ModerationService.init(); // Initialize user blocks list
        const recoveredSession = await handleAuthUrl(await Linking.getInitialURL());
        if (recoveredSession) {
          bootSession = recoveredSession;
        } else {
          const { data } = await supabase.auth.getSession();
          bootSession = data.session;
        }
      } catch (error) {
        console.warn('Failed to restore Supabase session, clearing local auth state:', error);
        try {
          await clearPersistedAuthSession();
        } catch (clearError) {
          console.warn('Failed to clear stale Supabase auth session:', clearError);
        }
        bootSession = null;
      }

      if (active) {
        setSession(bootSession);
        if (bootSession?.user?.email) {
          try {
            setIsAdmin(await AdminService.isCurrentUserAdmin(bootSession.user.email));
          } catch (error) {
            console.warn('Failed to check admin status during bootstrap:', error);
          }
        } else {
          setIsAdmin(false);
        }
        setIsReady(true);
      }
    };

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, nextSession: any) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void ModerationService.syncBlockListWithDb(nextSession.user.id);
      } else {
        void ModerationService.clear();
      }

      if (!nextSession?.user?.email) {
        setIsAdmin(false);
        return;
      }

      void AdminService.isCurrentUserAdmin(nextSession.user.email)
        .then(setIsAdmin)
        .catch((error) => {
          console.warn('Failed to refresh admin status:', error);
        });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [resetProfile]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isProfileReady || !session?.user) {
      return;
    }

    void syncVerifiedProfile(session.user).catch((error) => {
      console.warn('Failed to sync crew profile after auth event:', error);
    });
  }, [isProfileReady, session?.user?.id, session?.user?.email, session?.user?.email_confirmed_at]);

  const signUpWithWorkEmail = async ({ email, password }: { email: string; password: string }) => {
    setIsSubmitting(true);

    try {
      const verification = await CrewVerificationService.checkAirlineEmail(email, profile.roleLabel);

      const { error } = await supabase.auth.signUp({
        email: verification.normalizedEmail,
        password,
        options: {
          emailRedirectTo: EMAIL_REDIRECT_TO,
          data: {
            role_label: profile.roleLabel,
            airline: profile.airline,
            base_airport: profile.baseAirport,
          },
        },
      });

      if (error) {
        throw error;
      }

      mergeProfile({
        workEmail: verification.normalizedEmail,
        verificationAirline: verification.airlineName,
        verificationStatus: verification.matched
          ? CrewVerificationStatus.PENDING_EMAIL
          : CrewVerificationStatus.PENDING_MANUAL,
        verificationMethod: verification.matched
          ? CrewVerificationMethod.AIRLINE_EMAIL
          : CrewVerificationMethod.MANUAL_REVIEW,
        verifiedCrew: false,
        verifiedMarketplace: false,
        airline:
          verification.airlineName && (!profile.airline || profile.airline === 'YoFly Crew')
            ? verification.airlineName
            : profile.airline,
      });
    } catch (error) {
      throw normalizeAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithWorkEmail = async ({ email, password }: { email: string; password: string }) => {
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
      }

      if (data.user) {
        await syncVerifiedProfile(data.user);
      }
    } catch (error) {
      throw normalizeAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendPasswordRecoveryEmail = async (email: string) => {
    setIsSubmitting(true);

    try {
      setIsPasswordRecoveryFlow(false);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: PASSWORD_RESET_REDIRECT_TO,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw normalizeAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePassword = async (password: string) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setIsPasswordRecoveryFlow(false);
    } catch (error) {
      throw normalizeAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.warn('Global sign out failed, clearing local session instead:', error);
      }
    } finally {
      try {
        await clearPersistedAuthSession();
      } catch (error) {
        console.warn('Failed to clear persisted auth storage:', error);
      }

      setSession(null);
      setIsAdmin(false);
      setIsPasswordRecoveryFlow(false);
      resetProfile();
      void ModerationService.clear();
      setIsSubmitting(false);
    }
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isReady,
      isSubmitting,
      isAdmin,
      isPasswordRecoveryFlow,
      signUpWithWorkEmail,
      signInWithWorkEmail,
      sendPasswordRecoveryEmail,
      updatePassword,
      signOut,
      saveProfileToRemote,
    }),
    [isAdmin, isPasswordRecoveryFlow, isReady, isSubmitting, session, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
