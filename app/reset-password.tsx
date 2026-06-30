import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { theme } = useTheme();
  const { isPasswordRecoveryFlow, sendPasswordRecoveryEmail, updatePassword, isSubmitting } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const clearWebRecoveryToken = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleSendReset = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Enter the email address for the account you want to recover.');
      return;
    }

    try {
      await sendPasswordRecoveryEmail(email);
      setResetEmailSent(true);
      Alert.alert('Check Your Email', 'Open the password reset link, then set a new password here.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send a reset email right now.';
      Alert.alert('Reset Email Failed', message);
    }
  };

  const handleUpdatePassword = async () => {
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Use at least 8 characters for the new password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Enter the same new password twice.');
      return;
    }

    try {
      await updatePassword(password);
      clearWebRecoveryToken();
      setPassword('');
      setConfirmPassword('');
      setResetComplete(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update this password right now.';
      Alert.alert('Password Update Failed', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/auth')}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.iconBubble}>
              <Ionicons
                name={resetComplete ? 'checkmark-done-outline' : 'key-outline'}
                size={28}
                color={theme.colors.background}
              />
            </View>
            <Text style={styles.title}>{resetComplete ? 'Password Updated' : 'Reset Password'}</Text>
            <Text style={styles.subtitle}>
              {resetComplete
                ? 'Your new password is saved. You can continue back into YoFly Crew.'
                : isPasswordRecoveryFlow
                ? 'Enter a new password for this crew account.'
                : 'Send yourself a secure recovery link, then return here to set a new password.'}
            </Text>

            {resetComplete ? (
              <>
                <View style={styles.successCard}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.success} />
                  <Text style={styles.successText}>
                    Password reset complete. Use the new password the next time you sign in.
                  </Text>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/marketplace')}>
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            ) : isPasswordRecoveryFlow ? (
              <>
                <Text style={styles.fieldLabel}>New password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
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

                <Text style={styles.fieldLabel}>Confirm password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter new password"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                  onPress={handleUpdatePassword}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Account email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.noteCard}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.noteText}>
                    {resetEmailSent
                      ? 'Reset email sent. Open the newest email link to set your new password.'
                      : 'Supabase rate-limits recovery emails. If you just requested one, wait a few seconds before trying again.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
                  onPress={handleSendReset}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </Text>
                </TouchableOpacity>
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
      flexGrow: 1,
      justifyContent: 'center',
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    backText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    card: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    iconBubble: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      minWidth: 0,
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
    },
    noteText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    successCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.success + '66',
      backgroundColor: theme.colors.success + '14',
      padding: theme.spacing.md,
    },
    successText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
    },
    primaryButton: {
      minHeight: 54,
      borderRadius: theme.roundness.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 18,
    },
    disabledButton: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: theme.colors.background,
      fontSize: 16,
      fontWeight: '900',
    },
  });
