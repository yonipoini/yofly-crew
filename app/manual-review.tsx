import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { ManualReviewService } from '../src/services/ManualReviewService';
import { CrewVerificationMethod, CrewVerificationStatus } from '../src/types/verification';

export default function ManualReviewScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, saveProfileToRemote } = useAuth();
  const { profile, mergeProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [claimedAirline, setClaimedAirline] = useState(profile.airline === 'YoFly Crew' ? '' : profile.airline);
  const [employeeIdLast4, setEmployeeIdLast4] = useState('');
  const [badgeUri, setBadgeUri] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickBadge = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo Permission', 'Allow photo access so you can attach a badge or employee ID image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setBadgeUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'You need to be signed in before submitting a manual review request.');
      return;
    }

    if (!claimedAirline.trim()) {
      Alert.alert('Missing Airline', 'Enter the airline you fly or work for so the review can be routed correctly.');
      return;
    }

    if (!badgeUri && employeeIdLast4.trim().length !== 4) {
      Alert.alert('Proof Needed', 'Add a badge photo or the last 4 of your employee ID to submit manual review.');
      return;
    }

    setIsSubmitting(true);

    try {
      let badgeImagePath: string | undefined;

      if (badgeUri) {
        badgeImagePath = await ManualReviewService.uploadBadgePhoto(user.id, badgeUri);
      }

      await ManualReviewService.submitRequest({
        profileId: user.id,
        workEmail: profile.workEmail,
        claimedAirline: claimedAirline.trim(),
        employeeIdLast4: employeeIdLast4.trim(),
        badgeImagePath,
      });

      const nextProfile = {
        ...profile,
        airline: claimedAirline.trim(),
        verificationStatus: CrewVerificationStatus.PENDING_MANUAL,
        verificationMethod: CrewVerificationMethod.MANUAL_REVIEW,
        verifiedCrew: false,
        verifiedMarketplace: false,
      };

      mergeProfile(nextProfile);
      await saveProfileToRemote(nextProfile);

      Alert.alert(
        'Manual Review Submitted',
        'Your backup review request is now in the queue. Once approved, crew access can be unlocked manually.'
      );
      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Manual review submission failed. If you attached a badge image, check Supabase Storage setup.';
      Alert.alert('Submission Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manual Review</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Crew Backup Verification</Text>
          <Text style={styles.subtitle}>
            Use this if your airline work email is missing from the approved list. Badge image is optional if you can provide the last 4 of your employee ID.
          </Text>

          <Text style={styles.fieldLabel}>Claimed airline</Text>
          <TextInput
            style={styles.input}
            value={claimedAirline}
            onChangeText={setClaimedAirline}
            placeholder="Example: Envoy Air"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Employee ID last 4</Text>
          <TextInput
            style={styles.input}
            value={employeeIdLast4}
            onChangeText={(value) => setEmployeeIdLast4(value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="1234"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
          />

          <Text style={styles.fieldLabel}>Badge or ID image</Text>
          <TouchableOpacity style={styles.uploadCard} onPress={handlePickBadge}>
            {badgeUri ? (
              <Image source={{ uri: badgeUri }} style={styles.badgePreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.textMuted} />
                <Text style={styles.uploadText}>Attach badge photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
            <Text style={styles.infoText}>
              This request goes into the manual review queue stored in Supabase. Badge images are stored in a private bucket, not exposed as public links.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>{isSubmitting ? 'Submitting...' : 'Submit Manual Review'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    headerSpacer: {
      width: 42,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: theme.spacing.xs,
    },
    input: {
      height: 52,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 14,
      fontSize: 16,
    },
    uploadCard: {
      minHeight: 156,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadPlaceholder: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    uploadText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
    },
    badgePreview: {
      width: '100%',
      height: 180,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
    },
    infoText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    submitButton: {
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingVertical: 17,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    submitButtonDisabled: {
      opacity: 0.65,
    },
    submitText: {
      color: theme.colors.background,
      fontSize: 17,
      fontWeight: '900',
    },
  });
