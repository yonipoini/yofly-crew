import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { TSAStatus } from '../types/tsa';

interface TSAReportModalProps {
  visible: boolean;
  airport: string;
  onClose: () => void;
  onReport: (status: TSAStatus, mins: number) => void;
}

export const TSAReportModal: React.FC<TSAReportModalProps> = ({ visible, airport, onClose, onReport }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reportOptions = [
    { status: TSAStatus.CLEAR, mins: 5, label: 'Clear', icon: 'checkmark-circle', color: theme.colors.success },
    { status: TSAStatus.MODERATE, mins: 15, label: 'Moderate', icon: 'trending-up', color: '#FFD700' },
    { status: TSAStatus.BUSY, mins: 30, label: 'Busy', icon: 'people', color: '#FF9500' },
    { status: TSAStatus.CRITICAL, mins: 45, label: 'Long Line', icon: 'warning', color: theme.colors.error },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Report TSA Wait</Text>
              <Text style={styles.subtitle}>{airport} Security</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.instruction}>How&apos;s the line looking right now?</Text>

          <View style={styles.optionsGrid}>
            {reportOptions.map((opt) => (
              <TouchableOpacity
                key={opt.status}
                style={[styles.optionCard, { borderColor: opt.color + '40' }]}
                onPress={() => onReport(opt.status, opt.mins)}
              >
                <Ionicons name={opt.icon as keyof typeof Ionicons.glyphMap} size={32} color={opt.color} />
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={[styles.optionMins, { color: opt.color }]}>{opt.mins} MIN</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.customBtn}>
            <Text style={styles.customBtnText}>Enter Specific Wait Time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      padding: theme.spacing.lg,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.lg,
    },
    title: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: 'bold',
    },
    subtitle: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    instruction: {
      color: theme.colors.textMuted,
      fontSize: 16,
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
      marginBottom: theme.spacing.xl,
    },
    optionCard: {
      backgroundColor: theme.colors.background,
      width: '45%',
      aspectRatio: 1,
      borderRadius: theme.roundness.md,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      gap: 8,
    },
    optionLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    optionMins: {
      fontSize: 12,
      fontWeight: '900',
    },
    customBtn: {
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    customBtnText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
  });
