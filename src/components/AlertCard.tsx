import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { Alert, AlertType } from '../types/alerts';
import { formatDistanceToNow } from 'date-fns';
import { getCrewIntelCategory } from '../constants/crewIntelCategories';

interface AlertCardProps {
  alert: Alert;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [timeLeft, setTimeLeft] = useState('');
  const [verifications, setVerifications] = useState(alert.verifications || 0);
  const [hasVerified, setHasVerified] = useState(false);
  const category = getCrewIntelCategory(alert.type);
  const categoryLabel = category.label.toUpperCase();

  const handleVerify = () => {
    if (!hasVerified) {
      setVerifications(v => v + 1);
      setHasVerified(true);
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      const expires = new Date(alert.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins % 60}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [alert.expiresAt]);

  return (
    <View style={[styles.card, alert.isCritical && styles.criticalCard]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={category.icon as any} size={20} color={alert.isCritical ? theme.colors.error : theme.colors.accent} />
          <Text style={[styles.typeText, alert.isCritical && { color: theme.colors.error }]}>
            {alert.isCritical ? `CRITICAL ${categoryLabel}` : categoryLabel}
          </Text>
        </View>
        <View style={[styles.timerBadge, alert.isCritical && { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
          <Ionicons name="time-outline" size={12} color={alert.isCritical ? theme.colors.error : theme.colors.accent} />
          <Text style={[styles.timerText, alert.isCritical && { color: theme.colors.error }]}>{timeLeft}</Text>
        </View>
      </View>

      <Text style={styles.title}>{alert.title}</Text>
      <Text style={styles.message}>{alert.message}</Text>

      <View style={styles.verificationRow}>
        {verifications > 0 ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
            <Text style={styles.verifiedText}>Verified by {verifications} crew</Text>
          </View>
        ) : <View />}
        <TouchableOpacity 
          style={[styles.verifyBtn, hasVerified && styles.verifyBtnActive]} 
          onPress={handleVerify}
          disabled={hasVerified}
        >
          <Text style={[styles.verifyBtnText, hasVerified && styles.verifyBtnTextActive]}>
            {hasVerified ? 'Verified' : 'Verify'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.locationText}>{alert.location}</Text>
        </View>
        <Text style={styles.userText}>
          {alert.username} {alert.userRole ? `• ${alert.userRole}` : ''}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.roundness.lg,
    padding: 18,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  criticalCard: {
    borderColor: theme.colors.error + '4A',
    backgroundColor: 'rgba(44, 14, 18, 0.86)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent + '1A',
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.roundness.full,
    gap: 4,
  },
  timerText: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success + '14',
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.roundness.full,
    gap: 4,
  },
  verifiedText: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  verifyBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.roundness.full,
    justifyContent: 'center',
  },
  verifyBtnActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary + '50',
  },
  verifyBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  verifyBtnTextActive: {
    color: theme.colors.primary,
    opacity: 0.8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  userText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
