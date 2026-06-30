import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

interface CrewPreviewCardProps {
  crew: {
    id: string;
    name: string;
    role: string;
  };
  onClose: () => void;
}

export const CrewPreviewCard: React.FC<CrewPreviewCardProps> = ({ crew, onClose }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.imagePlaceholder}>
          <Ionicons name="person-circle-outline" size={48} color={theme.colors.border} />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.name} numberOfLines={1}>{crew.name}</Text>
              <Text style={styles.role}>{crew.role}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => Alert.alert('Message', `Opening chat with ${crew.name}`)}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.background} />
              <Text style={styles.primaryActionText}>Send Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => Alert.alert('Add', `Adding ${crew.name} to connections`)}>
              <Ionicons name="person-add-outline" size={18} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  imagePlaceholder: {
    width: 80,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  closeBtn: {
    marginTop: -4,
    marginRight: -4,
  },
  name: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  role: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.roundness.md,
    gap: 6,
  },
  primaryActionText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryAction: {
    width: 40,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
});
