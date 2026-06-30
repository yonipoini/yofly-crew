import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { AirportSearchService } from '../src/services/AirportSearchService';
import { AppSyncService } from '../src/services/AppSyncService';

const MAX_FAVORITE_HUBS = 5;

export default function FavoriteHubsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { saveProfileToRemote } = useAuth();
  const { profile, mergeProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const favoriteHubs = profile.preferences.favoriteAirports.slice(0, MAX_FAVORITE_HUBS);
  const searchResults = useMemo(
    () =>
      AirportSearchService.searchUsAirports(query, 6).filter(
        (airport) => !favoriteHubs.includes(airport.code)
      ),
    [favoriteHubs, query]
  );

  const persistFavoriteHubs = async (nextFavoriteHubs: string[]) => {
    setIsSaving(true);
    try {
      await saveProfileToRemote({
        ...profile,
        preferences: {
          ...profile.preferences,
          favoriteAirports: nextFavoriteHubs,
        },
      });
      mergeProfile({
        preferences: {
          favoriteAirports: nextFavoriteHubs,
        },
      });
      AppSyncService.emit('profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHub = async (airportCode: string) => {
    if (favoriteHubs.length >= MAX_FAVORITE_HUBS) {
      Alert.alert('Hub Limit Reached', `You can save up to ${MAX_FAVORITE_HUBS} favorite hubs.`);
      return;
    }

    const nextFavoriteHubs = Array.from(new Set([profile.baseAirport, ...favoriteHubs, airportCode])).slice(0, MAX_FAVORITE_HUBS);
    await persistFavoriteHubs(nextFavoriteHubs);
    setQuery('');
  };

  const handleRemoveHub = async (airportCode: string) => {
    const nextFavoriteHubs = favoriteHubs.filter((code) => code !== airportCode);
    await persistFavoriteHubs(nextFavoriteHubs.length > 0 ? nextFavoriteHubs : [profile.baseAirport]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorite Hubs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Quick Airports</Text>
          <Text style={styles.heroTitle}>Save up to 5 hubs</Text>
          <Text style={styles.heroText}>
            These are the airports you want to jump between quickly for Home, Intel, Map, and crew browsing.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved hubs</Text>
            <Text style={styles.sectionMeta}>{favoriteHubs.length}/{MAX_FAVORITE_HUBS}</Text>
          </View>
          <View style={styles.chipsWrap}>
            {favoriteHubs.map((airportCode) => (
              <TouchableOpacity
                key={airportCode}
                style={styles.hubChip}
                onPress={() => void handleRemoveHub(airportCode)}
                disabled={isSaving}
              >
                <Text style={styles.hubChipText}>{airportCode}</Text>
                <Ionicons name="close" size={14} color={theme.colors.background} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionHint}>Tap a chip to remove it.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add a hub</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="MCO or Orlando International"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {searchResults.map((airport) => (
            <TouchableOpacity
              key={airport.code}
              style={styles.resultRow}
              onPress={() => void handleAddHub(airport.code)}
              disabled={isSaving}
            >
              <View style={styles.resultCodeWrap}>
                <Text style={styles.resultCode}>{airport.code}</Text>
              </View>
              <Text style={styles.resultName} numberOfLines={1}>
                {airport.name}
              </Text>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
            </TouchableOpacity>
          ))}
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
      paddingBottom: 36,
      gap: theme.spacing.md,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    heroEyebrow: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '900',
    },
    heroText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      flex: 1,
    },
    sectionMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    hubChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
    },
    hubChipText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
    input: {
      minHeight: 54,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 16,
      fontSize: 15,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    resultCodeWrap: {
      minWidth: 44,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    resultCode: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    resultName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
  });
