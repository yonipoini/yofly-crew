import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';

interface ChatCreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; city: string }) => Promise<void> | void;
  favoriteAirports: string[];
}

export const ChatCreateRoomModal: React.FC<ChatCreateRoomModalProps> = ({
  visible,
  onClose,
  onCreate,
  favoriteAirports,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [city, setCity] = useState(favoriteAirports[0] || 'JFK');
  const canSubmit = Boolean(name.trim() && city.trim());

  useEffect(() => {
    if (!visible) {
      setName('');
      setCity(favoriteAirports[0] || 'JFK');
      return;
    }

    setCity((current) => current || favoriteAirports[0] || 'JFK');
  }, [favoriteAirports, visible]);

  const handleSubmit = async () => {
    if (!name.trim() || !city.trim()) {
      return;
    }

    await onCreate({
      name: name.trim(),
      city: city.trim().toUpperCase(),
    });
    setName('');
    setCity(favoriteAirports[0] || 'JFK');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Crew Room</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Room name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="JFK overnight swap"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>Airport code</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={(value) => setCity(value.toUpperCase())}
            placeholder="JFK"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
          />

          <View style={styles.chipRow}>
            {favoriteAirports.slice(0, 4).map((airportCode) => (
              <TouchableOpacity key={airportCode} style={styles.chip} onPress={() => setCity(airportCode)}>
                <Text style={styles.chipText}>{airportCode}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.background} />
            <Text style={styles.createButtonText}>Create Room</Text>
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
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.roundness.lg,
      borderTopRightRadius: theme.roundness.lg,
      padding: theme.spacing.md,
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    chip: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    createButton: {
      marginTop: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.roundness.full,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    createButtonDisabled: {
      opacity: 0.45,
    },
    createButtonText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
  });
