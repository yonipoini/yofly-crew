import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppTheme, ThemeMode, useTheme } from '../src/theme/theme';
import { ProfileState, useProfile } from '../src/context/ProfileContext';
import { useAuth } from '../src/context/AuthContext';
import { AirportOption, AirportSearchService } from '../src/services/AirportSearchService';
import { syncProfileAirportSelection } from '../src/utils/profileAirportSync';

type OnboardingStep = 'features' | 'setup' | 'verify-intro' | 'verify-form';
type AuthMode = 'signup' | 'signin';

const ROLE_OPTIONS = ['Pilot', 'Flight Attendant'] as const;
const FEATURE_ITEMS = [
  {
    icon: 'airplane-outline' as const,
    title: 'Aviation Dashboard',
    eyebrow: 'Trip-day tools',
    body: 'Track airport friction, weather context, and trip-day intel in one place.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Community Posts',
    eyebrow: 'Crew voices',
    body: 'See real crew posts, venting, local advice, and in-app conversation without the noise.',
  },
  {
    icon: 'restaurant-outline' as const,
    title: 'Layover Recs',
    eyebrow: 'Hotel + food picks',
    body: 'Get crew-recommended hotels, restaurants, coffee spots, and useful neighborhood saves.',
  },
  {
    icon: 'radio-outline' as const,
    title: 'Crew Intel',
    eyebrow: 'Live layover updates',
    body: 'See real-time shuttle, hotel, safety, and airport updates from verified crew only.',
  },
  {
    icon: 'bed-outline' as const,
    title: 'Marketplace & Pads',
    eyebrow: 'Crew-only listings',
    body: 'Browse crash pads, private rooms, products, services, and trusted listings.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Verified Crew Layer',
    eyebrow: 'Trust gate',
    body: 'Airline email verification keeps contact, listings, and chat tighter, safer, and cleaner.',
  },
] as const;

const resolveRequestedStep = (
  stepParam: string | undefined,
  hasVerifiedEmail: boolean
): OnboardingStep => {
  if (stepParam === 'setup') {
    return 'setup';
  }

  if (stepParam === 'verify-intro') {
    return hasVerifiedEmail ? 'verify-intro' : 'features';
  }

  if (stepParam === 'verify-form') {
    return hasVerifiedEmail ? 'verify-form' : 'features';
  }

  return hasVerifiedEmail ? 'verify-form' : 'features';
};

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const { theme, themeMode, setThemeMode, completeOnboarding } = useTheme();
  const { profile, mergeProfile } = useProfile();
  const {
    session,
    signUpWithWorkEmail,
    signInWithWorkEmail,
    isSubmitting,
    saveProfileToRemote,
  } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedRole, setSelectedRole] = useState(profile.roleLabel || 'Pilot');
  const [airportQuery, setAirportQuery] = useState(profile.baseAirport || '');
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | null>(
    AirportSearchService.resolveUsAirport(profile.baseAirport || '')
  );
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState(profile.workEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const hasVerifiedEmail = Boolean(session?.user?.email_confirmed_at);
  const requestedStep = resolveRequestedStep(
    typeof params.step === 'string' ? params.step : undefined,
    hasVerifiedEmail
  );
  const [step, setStep] = useState<OnboardingStep>(requestedStep);

  const airportResults = useMemo(() => {
    const trimmedQuery = airportQuery.trim();

    if (!trimmedQuery) {
      return [];
    }

    return AirportSearchService.searchUsAirports(trimmedQuery, 3);
  }, [airportQuery]);

  useEffect(() => {
    setStep(requestedStep);
  }, [requestedStep]);

  const persistSetupSelections = async (workEmailOverride = profile.workEmail) => {
    const resolvedAirport = selectedAirport ?? AirportSearchService.resolveUsAirport(airportQuery);

    if (!resolvedAirport) {
      Alert.alert('Choose A Base', 'Select a real U.S. base airport from the search results first.');
      return null;
    }

    const nextProfile = syncProfileAirportSelection(
      {
        ...profile,
        roleLabel: selectedRole,
        workEmail: workEmailOverride,
      },
      resolvedAirport.code,
      profile.baseAirport
    );

    mergeProfile({
      roleLabel: nextProfile.roleLabel,
      baseAirport: nextProfile.baseAirport,
      preferences: nextProfile.preferences,
    });
    setThemeMode(themeMode);
    setSelectedAirport(resolvedAirport);
    setAirportQuery(`${resolvedAirport.code} · ${resolvedAirport.name}`);
    return nextProfile;
  };

  const finalizeOnboarding = async (nextProfile: ProfileState) => {
    await saveProfileToRemote(nextProfile);
    mergeProfile({
      roleLabel: nextProfile.roleLabel,
      baseAirport: nextProfile.baseAirport,
      workEmail: nextProfile.workEmail,
      preferences: nextProfile.preferences,
    });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const handleSetupContinue = async () => {
    const nextProfile = await persistSetupSelections();
    if (!nextProfile) {
      return;
    }

    setStep('verify-intro');
  };

  const handleFinishVerifiedSetup = async () => {
    const verifiedEmail = session?.user?.email?.trim().toLowerCase();
    const nextProfile = await persistSetupSelections(verifiedEmail || email.trim().toLowerCase());

    if (!nextProfile) {
      setStep('setup');
      return;
    }

    try {
      await finalizeOnboarding(nextProfile);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to finish onboarding.';
      Alert.alert('Finish Setup Failed', message);
    }
  };

  const handleAuthSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Enter your airline work email and a password.');
      return;
    }

    if (mode === 'signup' && password.trim().length < 8) {
      Alert.alert('Weak Password', 'Use at least 8 characters for the account password.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === 'signin') {
        await signInWithWorkEmail({ email: normalizedEmail, password });
        return;
      }

      const nextProfile = await persistSetupSelections(normalizedEmail);

      if (!nextProfile) {
        setStep('setup');
        return;
      }

      await signUpWithWorkEmail({ email: normalizedEmail, password });
      Alert.alert(
        'Check Your Work Email',
        'We sent a verification email. Tap it, then come back here to finish your crew access.'
      );
      setMode('signin');
      setPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      Alert.alert(mode === 'signup' ? 'Work Email Signup Failed' : 'Sign In Failed', message);
    }
  };

  const renderStepPills = () => {
    const steps: OnboardingStep[] = ['features', 'setup', 'verify-intro', 'verify-form'];

    return (
      <View style={styles.stepPills}>
        {steps.map((item) => (
          <View
            key={item}
            style={[styles.stepPill, item === step && styles.stepPillActive]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          key={step}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {step === 'features'
                    ? 'Step 1 of 4'
                    : step === 'setup'
                      ? 'Step 2 of 4'
                      : step === 'verify-intro'
                        ? 'Step 3 of 4'
                        : 'Step 4 of 4'}
                </Text>
              </View>
              {renderStepPills()}
            </View>

            <View style={styles.logoFrame}>
              <Image source={require('../assets/logo-transparent.png')} style={styles.logo} resizeMode="contain" />
            </View>

            {step === 'features' ? (
              <>
                <Text style={styles.title}>Meet Your Crew Co-Pilot</Text>
                <Text style={styles.subtitle}>
                  Built for pilots and flight attendants who want smarter layovers, crew-only posts,
                  safer listings, and better local recommendations.
                </Text>
              </>
            ) : step === 'setup' ? (
              <>
                <Text style={styles.title}>Set Up Your Crew Cabin</Text>
                <Text style={styles.subtitle}>
                  Start with your role, base, and preferred look. Dark mode is selected by default,
                  but you can switch now and preview it live.
                </Text>
              </>
            ) : step === 'verify-intro' ? (
              <>
                <Text style={styles.title}>Verify Crew Access</Text>
                <Text style={styles.subtitle}>
                  Verification unlocks the trusted layer so listings, contact, intel, and chat stay
                  tighter and more useful.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Open Your Crew Pass</Text>
                <Text style={styles.subtitle}>
                  Create your account or sign in to finish unlocking the crew layer.
                </Text>
              </>
            )}
          </View>

          {step === 'features' ? (
            <View style={styles.card}>
              <View style={styles.featuresHeader}>
                <Text style={styles.sectionTitle}>Why Crew Actually Use It</Text>
                <Text style={styles.sectionText}>
                  Before you set anything up, here is what unlocks once you are inside.
                </Text>
              </View>

              <View style={styles.featureList}>
                {FEATURE_ITEMS.map((feature) => (
                  <View key={feature.title} style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <Ionicons name={feature.icon} size={20} color={theme.colors.accent} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureEyebrow}>{feature.eyebrow}</Text>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureText}>{feature.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={styles.navSecondaryButton}
                  onPress={() => router.replace('/auth?mode=signin')}
                >
                  <Ionicons name="log-in-outline" size={16} color={theme.colors.text} />
                  <Text style={styles.navSecondaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navPrimaryButton} onPress={() => setStep('setup')}>
                  <Text style={styles.navPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>See My Setup</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : step === 'setup' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Crew Profile</Text>
              <Text style={styles.sectionText}>
                This gives the app the right crew context from the start.
              </Text>

              <Text style={styles.fieldLabel}>Crew role</Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((role) => {
                  const selected = selectedRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleChip, selected && styles.roleChipActive]}
                      onPress={() => setSelectedRole(role)}
                    >
                      <Text style={[styles.roleChipText, selected && styles.roleChipTextActive]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Base airport</Text>
              <Text style={styles.helperText}>
                Search United States airports by code or airport name.
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
                <TextInput
                  value={airportQuery}
                  onChangeText={(value) => {
                    setAirportQuery(value);
                    setSelectedAirport(null);
                  }}
                  placeholder="JFK or John F Kennedy"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              {airportResults.length > 0 ? (
                <View style={styles.airportResults}>
                  {airportResults.map((airport) => {
                    const selected = selectedAirport?.code === airport.code;
                    return (
                      <TouchableOpacity
                        key={airport.code}
                        style={[styles.airportRow, selected && styles.airportRowSelected]}
                        onPress={() => {
                          setSelectedAirport(airport);
                          setAirportQuery(`${airport.code} · ${airport.name}`);
                        }}
                      >
                        <View>
                          <Text style={styles.airportCode}>{airport.code}</Text>
                          <Text style={styles.airportName}>{airport.name}</Text>
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Choose Your Cabin Mode</Text>
              <Text style={styles.sectionText}>
                Tap either card and the onboarding screen will switch immediately.
              </Text>

              <View style={styles.themeRow}>
                <ThemeCard
                  label="Dark"
                  active={themeMode === 'dark'}
                  previewMode="dark"
                  onPress={() => setThemeMode('dark')}
                  theme={theme}
                />
                <ThemeCard
                  label="Light"
                  active={themeMode === 'light'}
                  previewMode="light"
                  onPress={() => setThemeMode('light')}
                  theme={theme}
                />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.navSecondaryButton} onPress={() => setStep('features')}>
                  <Ionicons name="arrow-back" size={16} color={theme.colors.text} />
                  <Text style={styles.navSecondaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navPrimaryButton} onPress={handleSetupContinue}>
                  <Text style={styles.navPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : step === 'verify-intro' ? (
            <View style={styles.card}>
              <View style={styles.verificationCard}>
                <View style={styles.verificationImageWrap}>
                  <Image
                    source={require('../assets/yoflymascot.png')}
                    style={styles.verificationImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.passBadge}>
                  <Text style={styles.passCardLabel}>MULTIPASS</Text>
                  <Text style={styles.passCardMeta}>VERIFIED CREW</Text>
                </View>
                <View style={styles.verificationCopy}>
                  <Text style={styles.verificationTitle}>Get Verified, Get Your Multipass</Text>
                  <Text style={styles.verificationText}>
                    Once approved, your multipass unlocks listings, intel, contact, and the rest of
                    the app.
                  </Text>
                </View>
              </View>

              <View style={styles.requirementsCard}>
                <View style={styles.requirementRow}>
                  <Ionicons name="mail-open-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.requirementText}>Use your airline work email, not a personal inbox.</Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.requirementText}>Tap the verification email to activate crew-only access.</Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons name="id-card-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.requirementText}>If your airline email fails, manual review is the fallback path.</Text>
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.navSecondaryButton} onPress={() => setStep('setup')}>
                  <Ionicons name="arrow-back" size={16} color={theme.colors.text} />
                  <Text style={styles.navSecondaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navPrimaryButton} onPress={() => setStep('verify-form')}>
                  <Text style={styles.navPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.background} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              {hasVerifiedEmail ? (
                <>
                  <View style={styles.noteCard}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.accent} />
                    <Text style={styles.noteText}>
                      Your work email is already verified. Finish setup to save your crew profile and enter the app.
                    </Text>
                  </View>

                  <View style={styles.verifiedSummaryCard}>
                    <Text style={styles.verifiedSummaryLabel}>Verified account</Text>
                    <Text style={styles.verifiedSummaryValue}>
                      {session?.user?.email?.trim().toLowerCase() || email.trim().toLowerCase()}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.modeRow}>
                    <TouchableOpacity
                      style={[styles.modeChip, mode === 'signup' && styles.modeChipActive]}
                      onPress={() => setMode('signup')}
                    >
                      <Text style={[styles.modeChipText, mode === 'signup' && styles.modeChipTextActive]}>
                        Create Account
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeChip, mode === 'signin' && styles.modeChipActive]}
                      onPress={() => setMode('signin')}
                    >
                      <Text style={[styles.modeChipText, mode === 'signin' && styles.modeChipTextActive]}>
                        Sign In
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Airline work email</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@yourairline.com"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                      placeholderTextColor={theme.colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowPassword((current) => !current)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.noteCard}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
                    <Text style={styles.noteText}>
                      Approved airline domains auto-verify after email confirmation. Other airline work emails can still create an account and use manual review as the fallback path.
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.navSecondaryButton} onPress={() => setStep('verify-intro')}>
                  <Ionicons name="arrow-back" size={16} color={theme.colors.text} />
                  <Text style={styles.navSecondaryText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  disabled={isSubmitting}
                  onPress={hasVerifiedEmail ? handleFinishVerifiedSetup : handleAuthSubmit}
                >
                  <Text style={styles.submitText}>
                    {isSubmitting
                      ? 'Working...'
                      : hasVerifiedEmail
                        ? 'Finish Setup'
                        : mode === 'signup'
                          ? 'Use Work Email'
                          : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ThemeCard({
  label,
  active,
  previewMode,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  previewMode: ThemeMode;
  onPress: () => void;
  theme: AppTheme;
}) {
  const previewIsDark = previewMode === 'dark';

  return (
    <TouchableOpacity
      style={[
        stylesShared.themeCard,
        {
          backgroundColor: previewIsDark ? '#050505' : '#F6F7FB',
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
        active ? stylesShared.themeCardActive : undefined,
      ]}
      onPress={onPress}
    >
      <View style={stylesShared.themeCardHeader}>
        <Text style={[stylesShared.themeCardLabel, { color: previewIsDark ? '#FFFFFF' : '#111111' }]}>
          {label}
        </Text>
        <View
          style={[
            stylesShared.themeCheck,
            {
              backgroundColor: active ? theme.colors.accent : previewIsDark ? '#191919' : '#FFFFFF',
              borderColor: active ? theme.colors.accent : '#D5D8E0',
            },
          ]}
        >
          {active ? <Ionicons name="checkmark" size={15} color={previewIsDark ? '#000000' : '#111111'} /> : null}
        </View>
      </View>
      <View
        style={[
          stylesShared.themePreview,
          { backgroundColor: previewIsDark ? '#0D0D0D' : '#FFFFFF' },
        ]}
      >
        <View
          style={[
            stylesShared.themePreviewAccent,
            { backgroundColor: theme.colors.primary },
          ]}
        />
        <View
          style={[
            stylesShared.themePreviewPanel,
            { backgroundColor: previewIsDark ? '#171717' : '#EEF1F8' },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const stylesShared = StyleSheet.create({
  themeCard: {
    flex: 1,
    minHeight: 188,
    borderWidth: 2,
    borderRadius: 24,
    padding: 18,
    justifyContent: 'space-between',
  },
  themeCardActive: {
    shadowColor: '#FF00FF',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeCardLabel: {
    fontSize: 22,
    fontWeight: '900',
  },
  themeCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  themePreview: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  themePreviewAccent: {
    height: 22,
    width: '72%',
    borderRadius: 12,
  },
  themePreviewPanel: {
    height: 58,
    borderRadius: 14,
  },
});

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
      flexGrow: 1,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 28,
      paddingTop: 18,
      paddingBottom: 18,
      gap: 8,
      alignItems: 'center',
    },
    heroTopRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepBadge: {
      borderRadius: theme.roundness.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,0,255,0.32)',
      backgroundColor: 'rgba(255,0,255,0.08)',
    },
    stepBadgeText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    stepPills: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepPill: {
      width: 32,
      height: 8,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.border,
    },
    stepPillActive: {
      backgroundColor: theme.colors.primary,
    },
    logoFrame: {
      width: 214,
      height: 84,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    logo: {
      width: 236,
      height: 124,
      marginTop: 0,
    },
    title: {
      color: theme.colors.text,
      fontSize: 38,
      lineHeight: 40,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 2,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
    },
    sectionText: {
      color: theme.colors.textMuted,
      fontSize: 17,
      lineHeight: 26,
    },
    featuresHeader: {
      gap: 6,
    },
    featureList: {
      gap: 14,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      backgroundColor: theme.colors.input,
      padding: 18,
    },
    featureIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    featureCopy: {
      flex: 1,
      gap: 4,
    },
    featureEyebrow: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    featureTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: '900',
    },
    featureText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 8,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      lineHeight: 24,
      marginTop: -4,
    },
    roleRow: {
      flexDirection: 'row',
      gap: 12,
    },
    roleChip: {
      flex: 1,
      minHeight: 58,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    roleChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    roleChipText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    roleChipTextActive: {
      color: '#000000',
    },
    inputWrap: {
      minHeight: 62,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '700',
      paddingVertical: 16,
    },
    airportResults: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
    },
    airportRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    airportRowSelected: {
      backgroundColor: theme.colors.cardSoft,
    },
    airportCode: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    airportName: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginTop: 4,
      maxWidth: 250,
    },
    themeRow: {
      flexDirection: 'row',
      gap: 14,
    },
    primaryButton: {
      height: 72,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.sm,
      width: '100%',
    },
    primaryButtonInline: {
      marginTop: 0,
      flex: 1,
      width: undefined,
    },
    primaryButtonText: {
      color: '#000000',
      fontSize: 22,
      fontWeight: '900',
    },
    verificationCard: {
      gap: theme.spacing.lg,
      alignItems: 'center',
    },
    verificationImageWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 28,
      backgroundColor: theme.colors.cardSoft,
      overflow: 'hidden',
    },
    verificationImage: {
      width: '100%',
      height: '100%',
    },
    passBadge: {
      alignSelf: 'center',
      minWidth: 190,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 20,
      backgroundColor: '#0F0F16',
      borderWidth: 1,
      borderColor: 'rgba(255,0,255,0.28)',
      alignItems: 'center',
    },
    passCardLabel: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1.8,
    },
    passCardMeta: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 6,
    },
    verificationCopy: {
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    verificationTitle: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
      textAlign: 'center',
    },
    verificationText: {
      color: theme.colors.textMuted,
      fontSize: 17,
      lineHeight: 26,
      textAlign: 'center',
    },
    requirementsCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: 18,
      gap: 14,
    },
    requirementRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    requirementText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: theme.spacing.sm,
    },
    navSecondaryButton: {
      minWidth: 118,
      height: 60,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
    },
    navSecondaryText: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    navPrimaryButton: {
      flex: 1,
      height: 60,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
    },
    navPrimaryText: {
      color: '#000000',
      fontSize: 18,
      fontWeight: '900',
    },
    modeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    modeChip: {
      flex: 1,
      minHeight: 52,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    modeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modeChipText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    modeChipTextActive: {
      color: '#000000',
    },
    noteCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    noteText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    verifiedSummaryCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.primary + '33',
      backgroundColor: theme.colors.cardSoft,
      padding: 18,
      gap: 6,
    },
    verifiedSummaryLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    verifiedSummaryValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    submitButton: {
      flex: 1,
      height: 60,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    submitButtonDisabled: {
      opacity: 0.72,
    },
    submitText: {
      color: '#000000',
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
      lineHeight: 20,
    },
  });
