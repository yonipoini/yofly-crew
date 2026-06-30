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
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';

type AuthMode = 'signup' | 'signin';
type AuthPage = 'intro' | 'form';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; page?: string; email?: string }>();
  const { theme } = useTheme();
  const { signUpWithWorkEmail, signInWithWorkEmail, isSubmitting } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState<AuthMode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [page, setPage] = useState<AuthPage>(params.page === 'intro' ? 'intro' : 'form');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (params.mode === 'signup' || params.mode === 'signin') {
      setMode(params.mode);
    }

    if (params.page === 'intro' || params.page === 'form') {
      setPage(params.page);
    }

    if (typeof params.email === 'string') {
      setEmail(params.email);
    }
  }, [params.mode, params.page, params.email]);

  const handleSubmit = async () => {
    setAuthError('');

    if (!email.trim() || !password.trim()) {
      setAuthError('Enter your airline work email and password.');
      return;
    }

    if (mode === 'signup' && password.trim().length < 8) {
      setAuthError('Use at least 8 characters for the account password.');
      return;
    }

    try {
      if (mode === 'signup') {
        await signUpWithWorkEmail({ email, password });
        Alert.alert(
          'Check Your Work Email',
          'Supabase sent a confirmation email. Verify that airline email, then sign in to unlock crew access.'
        );
        setMode('signin');
        setPassword('');
        return;
      }

      await signInWithWorkEmail({ email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      setAuthError(message);

      if (mode === 'signup') {
        Alert.alert('Work Email Signup Failed', message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 1 of 2</Text>
              </View>
              <View style={styles.pagePills}>
                <View style={[styles.pagePill, page === 'intro' && styles.pagePillActive]} />
                <View style={[styles.pagePill, page === 'form' && styles.pagePillActive]} />
              </View>
            </View>
            <View style={styles.logoFrame}>
              <Image source={require('../assets/logo-transparent.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{page === 'intro' ? 'Crew-Only Access' : 'Welcome Back'}</Text>
            <Text style={styles.subtitle}>
              {page === 'intro'
                ? 'Start by verifying your airline work email. After that, you will set your crew style, base, and theme on the next step.'
                : 'Sign in with your airline work email and get right back to your crew tools.'}
            </Text>
            <View style={styles.progressRow}>
              <View style={[styles.progressDot, styles.progressDotActive]} />
              <View style={styles.progressBar} />
              <View style={styles.progressDot} />
            </View>
          </View>

          <View style={styles.card}>
            {page === 'intro' ? (
              <>
                <View style={styles.verificationCard}>
                  <View style={styles.verificationIllustration}>
                    <View style={styles.illustrationGlow} />
                    <View style={styles.verificationHairBack} />
                    <View style={styles.verificationShoulderLeft} />
                    <View style={styles.verificationShoulderRight} />
                    <View style={styles.verificationHead} />
                    <View style={styles.verificationHair} />
                    <View style={styles.verificationNeck} />
                    <View style={styles.verificationBody} />
                    <View style={styles.verificationBadge} />
                    <View style={styles.passCard}>
                      <Text style={styles.passCardLabel}>MULTIPASS</Text>
                      <Text style={styles.passCardMeta}>VERIFIED CREW</Text>
                    </View>
                  </View>
                  <View style={styles.verificationCopy}>
                    <Text style={styles.verificationTitle}>Get Verified, Get Your Multipass</Text>
                    <Text style={styles.verificationText}>
                      Airline email verification is the joke and the real security layer. Once approved,
                      your crew-only multipass unlocks listings, intel, contact, and the rest of the app.
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
                  <TouchableOpacity
                    style={styles.navSecondaryButton}
                    onPress={() => {
                      setMode('signin');
                      setPage('form');
                      setAuthError('');
                    }}
                  >
                    <Text style={styles.navSecondaryText}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.navPrimaryButton} onPress={() => setPage('form')}>
                    <Text style={styles.navPrimaryText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={16} color={theme.colors.background} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeChip, mode === 'signin' && styles.modeChipActive]}
                    onPress={() => {
                      setMode('signin');
                      setAuthError('');
                    }}
                  >
                    <Text style={[styles.modeChipText, mode === 'signin' && styles.modeChipTextActive]}>
                      Sign In
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeChip, mode === 'signup' && styles.modeChipActive]}
                    onPress={() => {
                      setMode('signup');
                      setAuthError('');
                    }}
                  >
                    <Text style={[styles.modeChipText, mode === 'signup' && styles.modeChipTextActive]}>
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Airline work email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setAuthError('');
                    }}
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
                    onChangeText={(value) => {
                      setPassword(value);
                      setAuthError('');
                    }}
                    placeholder="At least 8 characters"
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

                {authError ? (
                  <View style={styles.authErrorCard}>
                    <Ionicons name="alert-circle-outline" size={18} color={theme.colors.error} />
                    <Text style={styles.authErrorText}>{authError}</Text>
                  </View>
                ) : null}

                <View style={styles.noteCard}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.noteText}>
                    Approved airline domains auto-verify after email confirmation. Other airline work emails can still create an account and use manual review as the fallback path.
                  </Text>
                </View>

                {mode === 'signin' ? (
                  <TouchableOpacity
                    style={styles.forgotButton}
                    onPress={() =>
                      router.push({
                        pathname: '/reset-password',
                        params: email.trim() ? { email: email.trim().toLowerCase() } : {},
                      })
                    }
                  >
                    <Text style={styles.forgotButtonText}>Forgot password?</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={styles.navSecondaryButton}
                    onPress={() => {
                      if (mode === 'signin') {
                        router.replace('/onboarding?step=features');
                        return;
                      }

                      setPage('intro');
                    }}
                  >
                    <Ionicons name="arrow-back" size={16} color={theme.colors.text} />
                    <Text style={styles.navSecondaryText}>{mode === 'signin' ? 'Intro' : 'Back'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    disabled={isSubmitting}
                    onPress={handleSubmit}
                  >
                    <Text style={styles.submitText}>
                      {isSubmitting
                        ? 'Working...'
                        : mode === 'signup'
                          ? 'Continue With Work Email'
                          : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
      justifyContent: 'center',
      flexGrow: 1,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      alignItems: 'center',
    },
    heroTopRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepBadge: {
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.primary + '55',
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    stepBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    pagePills: {
      flexDirection: 'row',
      gap: 6,
    },
    pagePill: {
      width: 26,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
    },
    pagePillActive: {
      backgroundColor: theme.colors.primary,
    },
    logoFrame: {
      width: 226,
      height: 106,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
      marginTop: 4,
      marginBottom: 2,
    },
    logo: {
      width: 248,
      height: 118,
    },
    title: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
    },
    progressRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 4,
    },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
    },
    progressDotDone: {
      backgroundColor: theme.colors.success,
    },
    progressDotActive: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 3,
    },
    progressBar: {
      width: 72,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    verificationCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    verificationIllustration: {
      height: 176,
      borderRadius: 18,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    illustrationGlow: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: theme.colors.primary + '18',
      left: -40,
      top: -10,
    },
    verificationHairBack: {
      width: 90,
      height: 88,
      borderTopLeftRadius: 44,
      borderTopRightRadius: 50,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 34,
      backgroundColor: '#FF6A00',
      position: 'absolute',
      top: 28,
      left: 42,
      transform: [{ rotate: '-8deg' }],
      zIndex: 1,
    },
    verificationHead: {
      width: 56,
      height: 62,
      borderRadius: 28,
      backgroundColor: '#FFD9C7',
      position: 'absolute',
      top: 42,
      left: 56,
      zIndex: 3,
    },
    verificationHair: {
      width: 78,
      height: 44,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 38,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 18,
      backgroundColor: '#FF6A00',
      position: 'absolute',
      top: 28,
      left: 45,
      zIndex: 4,
      transform: [{ rotate: '-9deg' }],
    },
    verificationNeck: {
      width: 18,
      height: 18,
      borderRadius: 8,
      backgroundColor: '#FFD9C7',
      position: 'absolute',
      top: 92,
      left: 76,
      zIndex: 2,
    },
    verificationBody: {
      width: 96,
      height: 74,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      backgroundColor: theme.colors.primary,
      position: 'absolute',
      top: 104,
      left: 34,
      zIndex: 1,
    },
    verificationShoulderLeft: {
      position: 'absolute',
      width: 28,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      left: 28,
      top: 108,
      transform: [{ rotate: '18deg' }],
    },
    verificationShoulderRight: {
      position: 'absolute',
      width: 28,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      left: 108,
      top: 110,
      transform: [{ rotate: '-22deg' }],
    },
    verificationBadge: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.accent,
      left: 104,
      top: 128,
      zIndex: 4,
    },
    passCard: {
      position: 'absolute',
      right: 18,
      top: 40,
      width: 154,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary + '66',
      paddingHorizontal: 14,
      paddingVertical: 16,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 4,
      zIndex: 5,
    },
    passCardLabel: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 1.1,
    },
    passCardMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 6,
      letterSpacing: 0.5,
    },
    verificationCopy: {
      gap: 8,
    },
    verificationTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: '900',
    },
    verificationText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    requirementsCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
      gap: 12,
    },
    requirementRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    requirementText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    navGhost: {
      flex: 1,
    },
    navPrimaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 54,
      minWidth: 148,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
    },
    navPrimaryText: {
      color: theme.colors.background,
      fontSize: 16,
      fontWeight: '900',
    },
    navSecondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 54,
      paddingHorizontal: 18,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
    },
    navSecondaryText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    modeRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    modeChip: {
      flex: 1,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingVertical: 14,
      alignItems: 'center',
    },
    modeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modeChipText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    modeChipTextActive: {
      color: '#050505',
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: theme.spacing.md,
      minHeight: 58,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    authErrorCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.error + '66',
      backgroundColor: theme.colors.error + '14',
      padding: theme.spacing.md,
    },
    authErrorText: {
      flex: 1,
      color: theme.colors.error,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      borderRadius: 18,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    noteText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    forgotButton: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    forgotButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    submitButton: {
      flex: 1,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingVertical: 18,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: '#050505',
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 20,
      textAlign: 'center',
    },
  });
