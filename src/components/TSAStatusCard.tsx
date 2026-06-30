import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { TSAUpdate, TSAStatus } from '../types/tsa';
import { formatDistanceToNow } from 'date-fns';

interface TSAStatusCardProps {
  update: TSAUpdate;
  onPress?: () => void;
}

const getStatusColor = (theme: AppTheme, status: TSAStatus) => {
  switch (status) {
    case TSAStatus.CLEAR: return theme.colors.success;
    case TSAStatus.MODERATE: return '#FFD700'; // Yellow
    case TSAStatus.BUSY: return '#FF9500'; // Orange
    case TSAStatus.CRITICAL: return theme.colors.error;
    default: return theme.colors.textMuted;
  }
};

export const TSAStatusCard: React.FC<TSAStatusCardProps> = ({ update, onPress }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const statusColor = getStatusColor(theme, update.status);
  const confidenceTone = update.confidenceScore >= 75 ? theme.colors.success : update.confidenceScore >= 55 ? '#FF9500' : theme.colors.textMuted;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.airportCode}>{update.airportCode}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <Text style={styles.terminalText}>{update.terminal}</Text>
      <Text style={styles.sourceText}>{update.sourceLabel}</Text>
      
      <View style={styles.waitContainer}>
        <Text style={[styles.waitValue, { color: statusColor }]}>
          {update.waitTimeMins}
        </Text>
        <Text style={styles.waitUnit}>MIN</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.timeText}>
          {formatDistanceToNow(new Date(update.timestamp))} ago
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.sourceBadge, update.isFallback ? styles.fallbackBadge : styles.primaryBadge]}>
            <Text style={styles.sourceBadgeText}>{update.providerId.toUpperCase()}</Text>
          </View>
          <View style={styles.reportBadge}>
            <Text style={[styles.reportText, { color: confidenceTone }]}>
              {update.sourceType === 'crew' ? `${update.reportCount} reports` : `${update.confidenceScore}% conf`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.roundness.lg,
    padding: 18,
    width: 168,
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  airportCode: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  terminalText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  sourceText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  waitContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.sm,
  },
  waitValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  waitUnit: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginLeft: 2,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 'auto',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  primaryBadge: {
    backgroundColor: theme.colors.primary + '18',
  },
  fallbackBadge: {
    backgroundColor: '#FF950014',
  },
  sourceBadgeText: {
    color: theme.colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  reportBadge: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  reportText: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: '800',
  },
});
