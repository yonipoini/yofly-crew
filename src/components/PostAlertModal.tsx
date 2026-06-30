import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { AlertType } from '../types/alerts';
import { CREW_INTEL_CATEGORIES } from '../constants/crewIntelCategories';

interface PostAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onReport: (
    type: AlertType,
    title: string,
    message: string,
    isPrivate: boolean,
    coordinate: { latitude: number; longitude: number } | null
  ) => void;
  initialCoordinate?: { latitude: number; longitude: number } | null;
  initialType?: AlertType;
  initialTitle?: string;
  initialMessage?: string;
  initialIsPrivate?: boolean;
  initialIsLocationSpecific?: boolean;
  onAdjustLocationStart?: (
    currentType: AlertType,
    currentTitle: string,
    currentMessage: string,
    currentIsPrivate: boolean,
    currentIsLocationSpecific: boolean
  ) => void;
}

export const PostAlertModal: React.FC<PostAlertModalProps> = ({
  visible,
  onClose,
  onReport,
  initialCoordinate = null,
  initialType = AlertType.CATERING,
  initialTitle = '',
  initialMessage = '',
  initialIsPrivate = false,
  initialIsLocationSpecific = false,
  onAdjustLocationStart,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [selectedType, setSelectedType] = useState<AlertType>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [message, setMessage] = useState(initialMessage);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [isLocationSpecific, setIsLocationSpecific] = useState(initialIsLocationSpecific);
  const [isSummaryFocused, setIsSummaryFocused] = useState(false);
  const [isDetailsFocused, setIsDetailsFocused] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setSelectedType(initialType);
      setTitle(initialTitle);
      setMessage(initialMessage);
      setIsPrivate(initialIsPrivate);
      setIsLocationSpecific(initialIsLocationSpecific);
    }
  }, [visible, initialType, initialTitle, initialMessage, initialIsPrivate, initialIsLocationSpecific]);

  const handleReport = () => {
    if (title.trim() && message.trim()) {
      onReport(
        selectedType,
        title,
        message,
        isPrivate,
        isLocationSpecific ? initialCoordinate : null
      );
      setTitle('');
      setMessage('');
      setIsPrivate(false);
      setIsLocationSpecific(false);
      onClose();
    }
  };

  const handleAdjustLocation = () => {
    onAdjustLocationStart?.(
      selectedType,
      title,
      message,
      isPrivate,
      true
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.containerContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Report Crew Intel</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Choose Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryList}
            contentContainerStyle={styles.categoryListContent}
          >
            {CREW_INTEL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.type}
                style={[
                  styles.categoryItem,
                  selectedType === cat.type && styles.categoryItemSelected
                ]}
                onPress={() => setSelectedType(cat.type)}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={20} 
                  color={selectedType === cat.type ? theme.colors.background : theme.colors.text} 
                />
                <Text style={[
                  styles.categoryLabel,
                  selectedType === cat.type && styles.categoryLabelSelected
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, !isPrivate && styles.toggleButtonActive]}
              onPress={() => setIsPrivate(false)}
            >
              <Ionicons 
                name="people-outline" 
                size={16} 
                color={!isPrivate ? theme.colors.background : theme.colors.text} 
              />
              <Text style={[styles.toggleButtonText, !isPrivate && styles.toggleButtonTextActive]}>
                Public (Crew Shared)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, isPrivate && styles.toggleButtonActive]}
              onPress={() => setIsPrivate(true)}
            >
              <Ionicons 
                name="lock-closed-outline" 
                size={16} 
                color={isPrivate ? theme.colors.background : theme.colors.text} 
              />
              <Text style={[styles.toggleButtonText, isPrivate && styles.toggleButtonTextActive]}>
                Private (Personal)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Location Placement</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, !isLocationSpecific && styles.toggleButtonActive]}
              onPress={() => setIsLocationSpecific(false)}
            >
              <Ionicons 
                name="globe-outline" 
                size={16} 
                color={!isLocationSpecific ? theme.colors.background : theme.colors.text} 
              />
              <Text style={[styles.toggleButtonText, !isLocationSpecific && styles.toggleButtonTextActive]}>
                Airport Wide
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, isLocationSpecific && styles.toggleButtonActive]}
              onPress={() => {
                setIsLocationSpecific(true);
                if (!initialCoordinate) {
                  onAdjustLocationStart?.(
                    selectedType,
                    title,
                    message,
                    isPrivate,
                    true
                  );
                }
              }}
            >
              <Ionicons 
                name="pin-outline" 
                size={16} 
                color={isLocationSpecific ? theme.colors.background : theme.colors.text} 
              />
              <Text style={[styles.toggleButtonText, isLocationSpecific && styles.toggleButtonTextActive]}>
                Drop Pin
              </Text>
            </TouchableOpacity>
          </View>

          {isLocationSpecific && (
            <View style={styles.coordinateContainer}>
              <Text style={styles.coordinateText} numberOfLines={1}>
                {initialCoordinate 
                  ? `📍 ${initialCoordinate.latitude.toFixed(5)}, ${initialCoordinate.longitude.toFixed(5)}`
                  : '📍 No coordinates set'}
              </Text>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={handleAdjustLocation}
              >
                <Ionicons name="map-outline" size={14} color={theme.colors.accent} style={{ marginRight: 4 }} />
                <Text style={styles.adjustButtonText}>
                  {initialCoordinate ? 'Adjust Spot' : 'Set Spot'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Summary</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                { height: 44, marginBottom: 0 },
                isSummaryFocused && { borderColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.15, shadowRadius: 4 }
              ]}
              placeholder="E.g., Shuttle delay, safe route, hotel issue"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
              onFocus={() => setIsSummaryFocused(true)}
              onBlur={() => setIsSummaryFocused(false)}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>
          </View>

          <Text style={styles.label}>Details</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                { height: 100, marginBottom: 0 },
                isDetailsFocused && { borderColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.15, shadowRadius: 4 }
              ]}
              placeholder="Share the details with the crew..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={200}
              value={message}
              onChangeText={setMessage}
              onFocus={() => setIsDetailsFocused(true)}
              onBlur={() => setIsDetailsFocused(false)}
            />
            <Text style={styles.charCount}>{message.length}/200</Text>
          </View>

          <TouchableOpacity 
            style={[styles.postButton, (!title.trim() || !message.trim()) && styles.postButtonDisabled]}
            onPress={handleReport}
            disabled={!title.trim() || !message.trim()}
          >
            <Text style={styles.postButtonText}>Share Intel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '88%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.roundness.lg,
    borderTopRightRadius: theme.roundness.lg,
  },
  containerContent: {
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryList: {
    flexGrow: 0,
    marginBottom: theme.spacing.lg,
  },
  categoryListContent: {
    gap: 10,
    paddingRight: theme.spacing.lg,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.roundness.md,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryItemSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryLabel: {
    color: theme.colors.text,
    fontSize: 14,
  },
  categoryLabelSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputWrapper: {
    marginBottom: theme.spacing.lg,
  },
  charCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginRight: 4,
    marginTop: 2,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.roundness.md,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  coordinateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    borderRadius: theme.roundness.md,
    marginBottom: theme.spacing.lg,
  },
  coordinateText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  adjustButtonText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
