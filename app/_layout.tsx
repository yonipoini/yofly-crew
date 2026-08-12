import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme/theme';
import { ProfileProvider, useProfile } from '../src/context/ProfileContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import SplashScreen from './splash';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import { NotificationService } from '../src/services/NotificationService';
import { supabase } from '../src/lib/supabase';

function OpsBootstrap() {
  const { session } = useAuth();
  const { profile } = useProfile();

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void NotificationService.syncExistingSubscription(session.user.id, profile).catch((error) => {
      console.warn('Push subscription sync skipped:', error);
    });

    if (profile.preferences.opsPush || profile.preferences.dailyDigest || profile.preferences.intelPush) {
      void NotificationService.registerForOpsPush(session.user.id, profile).catch((error) => {
        console.warn('Push registration skipped:', error);
      });
    }
  }, [
    session?.user?.id,
    profile.roleLabel,
    profile.verifiedCrew,
    profile.baseAirport,
    profile.preferences.activeOpsAirport,
    profile.preferences.favoriteAirports.join(','),
    profile.preferences.preferredAirlines.join(','),
    profile.preferences.intelPush,
    profile.preferences.opsPush,
    profile.preferences.dailyDigest,
  ]);

  return null;
}

function RootNavigator() {
  const { theme, isDark, isReady, completeOnboarding } = useTheme();
  const { isReady: isProfileReady } = useProfile();
  const { isReady: isAuthReady, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [mustOnboard, setMustOnboard] = useState(false);

  useEffect(() => {
    if (!session) {
      setOnboardingChecked(false);
      setMustOnboard(false);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('base_airport')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!data || !data.base_airport) {
          setMustOnboard(true);
        } else {
          setMustOnboard(false);
          // Sync local AsyncStorage flag if database is complete
          completeOnboarding();
        }
      } catch (error) {
        console.warn('Failed to check onboarding state, defaulting to app:', error);
      } finally {
        setOnboardingChecked(true);
      }
    };

    void checkOnboarding();
  }, [session]);

  useEffect(() => {
    if (!isReady || !isProfileReady || !isAuthReady) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'reset-password';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) {
        const timer = setTimeout(() => {
          router.replace('/auth');
        }, 0);
        return () => clearTimeout(timer);
      }
    } else {
      if (!onboardingChecked) {
        return;
      }

      if (mustOnboard) {
        if (!inOnboarding) {
          const timer = setTimeout(() => {
            router.replace('/onboarding?step=setup');
          }, 0);
          return () => clearTimeout(timer);
        }
      } else {
        if (inAuthGroup || inOnboarding) {
          const timer = setTimeout(() => {
            router.replace('/(tabs)');
          }, 0);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [session, segments, isReady, isProfileReady, isAuthReady, onboardingChecked, mustOnboard]);

  const [hasPlayedSplash, setHasPlayedSplash] = useState(false);

  if (!hasPlayedSplash) {
    return <SplashScreen onComplete={() => setHasPlayedSplash(true)} />;
  }

  if (!isReady || !isProfileReady || !isAuthReady || (session && !onboardingChecked)) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <>
      <OpsBootstrap />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="favorite-hubs" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="schedule-import" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="manual-review" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="admin-review" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="create-listing" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="chat/index" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="chat/[roomId]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="discounts" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="slam-clicker" options={{ presentation: 'card', headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
