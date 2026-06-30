import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppTheme, useTheme } from '../src/theme/theme';

const MOCK_DISCOUNTS = [
  { id: '1', title: 'Marriott Bonvoy Crew Rate', description: 'Up to 30% off standard rates with crew ID.', icon: 'bed-outline' },
  { id: '2', title: 'Airport Shake Shack', description: '20% off all burgers and shakes in-terminal.', icon: 'fast-food-outline' },
  { id: '3', title: 'Avis Car Rental', description: 'Exclusive $35/day rate for airline employees.', icon: 'car-outline' },
  { id: '4', title: 'TUMI Luggage Outlet', description: 'Extra 15% off heavily discounted roller bags.', icon: 'briefcase-outline' },
];

export default function DiscountsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crew Discounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={MOCK_DISCOUNTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.discountCard}>
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Ionicons name="pricetag" size={48} color={theme.colors.primary} style={styles.heroIcon} />
            <Text style={styles.heroText}>Flash your crew badge and save automatically at these verified partners.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { padding: 8, marginLeft: -8, width: 40 },
    headerTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' },
    headerSpacer: { width: 40 },
    listContent: { padding: theme.spacing.md },
    listHeader: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '40',
    },
    heroIcon: { alignSelf: 'center', marginBottom: 16 },
    heroText: { color: theme.colors.text, fontSize: 16, textAlign: 'center', lineHeight: 24 },
    discountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    content: { flex: 1 },
    title: { color: theme.colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    description: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  });
