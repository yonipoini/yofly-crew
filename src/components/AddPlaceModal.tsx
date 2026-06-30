import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { LocationType } from '../types/locations';
import { getLocationTypeLabel } from '../utils/mapLocationPresentation';

interface AddPlaceModalProps {
  visible: boolean;
  coordinate: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    type: LocationType;
    level?: string;
    zone?: string;
    note?: string;
  }) => Promise<void>;
}

const CATEGORY_ITEMS = [
  { type: LocationType.RESTAURANT, icon: 'fast-food' as const },
  { type: LocationType.COFFEE, icon: 'cafe' as const },
  { type: LocationType.GROCERY, icon: 'cart' as const },
  { type: LocationType.SAFE_AREA, icon: 'shield-checkmark' as const },
  { type: LocationType.PHARMACY, icon: 'medical' as const },
  { type: LocationType.GYM, icon: 'barbell' as const },
  { type: LocationType.LOUNGE, icon: 'bed' as const },
  { type: LocationType.NIGHTLIFE, icon: 'beer' as const },
  { type: LocationType.SHOPPING, icon: 'bag' as const },
  { type: LocationType.SERVICE, icon: 'cash' as const },
];

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  visible,
  coordinate,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<LocationType>(LocationType.COFFEE);
  const [level, setLevel] = useState('');
  const [zone, setZone] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setName('');
    setSelectedType(LocationType.COFFEE);
    setLevel('');
    setZone('');
    setNote('');
    setIsSaving(false);
    setErrorText(null);
  }, [visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorText('Please enter a business name.');
      return;
    }

    setIsSaving(true);
    setErrorText(null);

    try {
      await onSave({
        name: name.trim(),
        type: selectedType,
        level: level.trim() || undefined,
        zone: zone.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to create custom place:', err);
      setErrorText(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              <Text style={styles.title}>Add Crew Spot</Text>
              <Text style={styles.subtitle}>
                Create a permanent public directory pin for all crew users.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSaving}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {errorText ? (
            <View style={styles.errorAlert}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorAlertText}>{errorText}</Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errorText) setErrorText(null);
              }}
              placeholder="e.g. Starbucks, KCM Exit Corridor"
              placeholderTextColor={theme.colors.textMuted}
              editable={!isSaving}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_ITEMS.map((item) => {
                const isSelected = selectedType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                    ]}
                    onPress={() => setSelectedType(item.type)}
                    disabled={isSaving}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isSelected ? theme.colors.background : theme.colors.text}
                    />
                    <Text
                      style={[
                        styles.categoryCardText,
                        isSelected && styles.categoryCardTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {getLocationTypeLabel(item.type)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Terminal Level</Text>
                <TextInput
                  style={styles.input}
                  value={level}
                  onChangeText={setLevel}
                  placeholder="e.g. 2, 3, Baggage"
                  placeholderTextColor={theme.colors.textMuted}
                  editable={!isSaving}
                />
                <View style={styles.levelSuggestions}>
                  {['B', '1', '2', '3'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.levelSuggestionChip,
                        level === item && styles.levelSuggestionChipActive,
                      ]}
                      onPress={() => setLevel(item)}
                      disabled={isSaving}
                    >
                      <Text
                        style={[
                          styles.levelSuggestionText,
                          level === item && styles.levelSuggestionTextActive,
                        ]}
                      >
                        Lvl {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.label}>Zone / Gate</Text>
                <TextInput
                  style={styles.input}
                  value={zone}
                  onChangeText={setZone}
                  placeholder="e.g. Gate B22, Terminal 4"
                  placeholderTextColor={theme.colors.textMuted}
                  editable={!isSaving}
                />
              </View>
            </View>

            <Text style={styles.label}>Crew Notes / Tips</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. 10% discount with airline badge, fastest security line, safe seating area with power outlets..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              editable={!isSaving}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, (!name.trim() || isSaving) && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color={theme.colors.background} />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Publishing...' : 'Publish Crew Spot'}
            </Text>
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
      paddingBottom: Platform.OS === 'ios' ? 34 : 18,
      paddingTop: 10,
      maxHeight: '85%',
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
      marginBottom: 16,
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
    errorAlert: {
      backgroundColor: '#FF3B3012',
      borderWidth: 1,
      borderColor: '#FF3B3033',
      borderRadius: theme.roundness.md,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    errorAlertText: {
      color: '#FF3B30',
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    content: {
      gap: 12,
      paddingBottom: 20,
    },
    label: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
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
      minHeight: 80,
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfCol: {
      flex: 1,
      gap: 4,
    },
    levelSuggestions: {
      flexDirection: 'row',
      gap: 5,
      marginTop: 6,
    },
    levelSuggestionChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelSuggestionChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    levelSuggestionText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    levelSuggestionTextActive: {
      color: theme.colors.background,
      fontWeight: '800',
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 4,
    },
    categoryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      width: '48%', // Approx 2 columns
    },
    categoryCardSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryCardText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    categoryCardTextSelected: {
      color: theme.colors.background,
      fontWeight: '800',
    },
    saveButton: {
      height: 48,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
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
