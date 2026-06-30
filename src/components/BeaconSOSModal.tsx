import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { EmergencyContact } from '../types/safety';
import { MAX_BEACON_CONTACTS, normalizeEmergencyContacts } from '../utils/beaconSOS';

interface BeaconSOSModalProps {
  visible: boolean;
  enabled: boolean;
  contacts: EmergencyContact[];
  onClose: () => void;
  onSave: (payload: { enabled: boolean; contacts: EmergencyContact[] }) => Promise<void> | void;
}

const createBlankContact = (index: number): EmergencyContact => ({
  id: `beacon-contact-${Date.now()}-${index}`,
  name: '',
  phone: '',
  relation: '',
});

export const BeaconSOSModal: React.FC<BeaconSOSModalProps> = ({
  visible,
  enabled,
  contacts,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftContacts, setDraftContacts] = useState<EmergencyContact[]>(normalizeEmergencyContacts(contacts));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setDraftEnabled(enabled);
    setDraftContacts(normalizeEmergencyContacts(contacts));
    setIsSaving(false);
  }, [contacts, enabled, visible]);

  const handleChangeContact = (id: string, key: keyof EmergencyContact, value: string) => {
    setDraftContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              [key]: value,
            }
          : contact
      )
    );
  };

  const handleAddContact = () => {
    setDraftContacts((current) =>
      current.length >= MAX_BEACON_CONTACTS ? current : [...current, createBlankContact(current.length)]
    );
  };

  const handleRemoveContact = (id: string) => {
    setDraftContacts((current) => current.filter((contact) => contact.id !== id));
  };

  const handleSave = async () => {
    const cleaned = draftContacts
      .map((contact) => ({
        ...contact,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        relation: contact.relation.trim(),
      }))
      .filter((contact) => contact.name || contact.phone || contact.relation);

    const hasPartialContact = cleaned.some((contact) => !contact.name || !contact.phone);
    if (hasPartialContact) {
      Alert.alert('Finish Contact Details', 'Each Beacon contact needs at least a name and phone number.');
      return;
    }

    const normalized = normalizeEmergencyContacts(cleaned);
    if (draftEnabled && !normalized.length) {
      Alert.alert('Add A Contact', 'Add at least one emergency contact before enabling Beacon Emergency SOS.');
      return;
    }

    setIsSaving(true);

    try {
      await onSave({ enabled: draftEnabled, contacts: normalized });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Beacon Emergency SOS</Text>
              <Text style={styles.subtitle}>
                Keep up to {MAX_BEACON_CONTACTS} trusted contacts ready if you report an emergency.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Enable Beacon Emergency SOS</Text>
              <Text style={styles.toggleHint}>
                Beacon stays armed and only starts safety checks after an emergency or SOS trigger.
              </Text>
            </View>
            <Switch
              value={draftEnabled}
              onValueChange={setDraftEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.error }}
              thumbColor={theme.colors.text}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {draftContacts.map((contact, index) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactTitle}>Contact {index + 1}</Text>
                  <TouchableOpacity onPress={() => handleRemoveContact(contact.id)}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={contact.name}
                  onChangeText={(value) => handleChangeContact(contact.id, 'name', value)}
                  placeholder="Full name"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={contact.phone}
                  onChangeText={(value) => handleChangeContact(contact.id, 'phone', value)}
                  placeholder="Phone number"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  value={contact.relation}
                  onChangeText={(value) => handleChangeContact(contact.id, 'relation', value)}
                  placeholder="Relation or role"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addButton, draftContacts.length >= MAX_BEACON_CONTACTS && styles.addButtonDisabled]}
              onPress={handleAddContact}
              disabled={draftContacts.length >= MAX_BEACON_CONTACTS}
            >
              <Ionicons name="person-add-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.addButtonText}>
                {draftContacts.length >= MAX_BEACON_CONTACTS
                  ? 'Beacon contact limit reached'
                  : 'Add emergency contact'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={isSaving}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.background} />
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Beacon SOS'}</Text>
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
      borderTopLeftRadius: theme.roundness.lg,
      borderTopRightRadius: theme.roundness.lg,
      paddingHorizontal: theme.spacing.md,
      paddingTop: 10,
      paddingBottom: theme.spacing.md,
      gap: 12,
      maxHeight: '88%',
    },
    handleWrap: {
      alignItems: 'center',
    },
    handle: {
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.textMuted + '55',
    },
    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: 14,
    },
    toggleCopy: {
      flex: 1,
      gap: 4,
    },
    toggleTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    toggleHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    scrollContent: {
      gap: 10,
      paddingBottom: 8,
    },
    contactCard: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: 14,
      gap: 10,
    },
    contactHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    contactTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    input: {
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      color: theme.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    addButton: {
      minHeight: 46,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '33',
      backgroundColor: theme.colors.accent + '10',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
    addButtonDisabled: {
      opacity: 0.45,
    },
    addButtonText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
    },
    saveButton: {
      minHeight: 50,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
