import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';

interface PlaceCrewInfoModalProps {
  visible: boolean;
  placeName: string;
  onClose: () => void;
  onSave: (payload: { note: string; deal?: string }) => Promise<void> | void;
}

export const PlaceCrewInfoModal: React.FC<PlaceCrewInfoModalProps> = ({
  visible,
  placeName,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [note, setNote] = useState('');
  const [deal, setDeal] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setNote('');
    setDeal('');
    setIsSaving(false);
  }, [visible]);

  const handleSave = async () => {
    if (!note.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ note, deal });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Add Crew Info</Text>
              <Text style={styles.subtitle}>Help turn {placeName} into a better crew directory entry.</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={styles.label}>Crew note</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={note}
              onChangeText={setNote}
              placeholder="Example: Crew discount with badge, fastest order line after 6am, safest pickup side, quiet seating..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Deal or perk</Text>
            <TextInput
              style={styles.input}
              value={deal}
              onChangeText={setDeal}
              placeholder="Example: 15% with crew badge"
              placeholderTextColor={theme.colors.textMuted}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, (!note.trim() || isSaving) && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={!note.trim() || isSaving}
          >
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.background} />
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Crew Info'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingBottom: 18,
      paddingTop: 10,
      maxHeight: '78%',
    },
    handleWrap: {
      alignItems: 'center',
      marginBottom: 10,
    },
    handle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted + '44',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },
    content: {
      gap: 10,
      paddingBottom: 12,
    },
    label: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
    },
    inputMultiline: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    saveButton: {
      height: 48,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
  });
