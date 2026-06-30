import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';

export function CrewLockBanner({ message }: { message: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.banner}>
      <Ionicons name="shield-outline" size={16} color={theme.colors.background} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    banner: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.roundness.lg,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.accent + '2E',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    text: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
  });
