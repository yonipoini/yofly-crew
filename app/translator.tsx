import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { AppTheme, useTheme } from '../src/theme/theme';

const LANGUAGES = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳' },
];

export default function TranslatorScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async (text: string, langCode: string) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }
    setIsTranslating(true);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text.trim())}`;
      const response = await fetch(url);
      const result = await response.json();
      const translated = result[0].map((item: any) => item[0]).join('');
      setTranslatedText(translated);
    } catch (err) {
      console.warn('Real-time translation failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyTranslation = () => {
    if (translatedText) {
      Clipboard.setString(translatedText);
      Alert.alert('Copied!', 'Translation copied to clipboard.');
    }
  };

  const handleSpeakTranslation = () => {
    if (translatedText) {
      Speech.stop();
      Speech.speak(translatedText, {
        language: targetLang,
        pitch: 1.0,
        rate: 0.9,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Layover Translator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="language-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>Real-Time Translator</Text>
          </View>
          <Text style={styles.cardInfo}>
            Translate crew phrases, airport instructions, or hotel signs instantly. Auto-detects input language. Use keyboard voice dictation to speak directly.
          </Text>

          {/* Language Selector */}
          <View style={styles.languageScrollContainer}>
            <Text style={styles.label}>Select Target Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageScroll}>
              {LANGUAGES.map((lang) => {
                const active = targetLang === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageChip, active && styles.languageChipActive]}
                    onPress={() => {
                      setTargetLang(lang.code);
                      if (inputText.trim()) {
                        handleTranslate(inputText, lang.code);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.languageFlag}>{lang.flag}</Text>
                    <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Input box */}
          <View style={styles.translatorInputWrapper}>
            <TextInput
              style={styles.translatorInput}
              placeholder="Type here to translate crew phrases..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
              }}
            />
            {inputText.trim().length > 0 && (
              <TouchableOpacity
                style={styles.clearInputBtn}
                onPress={() => {
                  setInputText('');
                  setTranslatedText('');
                }}
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Action Row */}
          <View style={styles.translationActionRow}>
            <TouchableOpacity
              style={[styles.translateButton, !inputText.trim() && styles.translateButtonDisabled]}
              onPress={() => handleTranslate(inputText, targetLang)}
              disabled={!inputText.trim() || isTranslating}
              activeOpacity={0.8}
            >
              {isTranslating ? (
                <ActivityIndicator size="small" color="#08070B" />
              ) : (
                <>
                  <Ionicons name="globe-outline" size={16} color="#08070B" style={{ marginRight: 6 }} />
                  <Text style={styles.translateButtonText}>Translate</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Output Card */}
          {translatedText ? (
            <View style={styles.translationOutputContainer}>
              <View style={styles.translationOutputHeader}>
                <Text style={styles.translationLabel}>Translation</Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <TouchableOpacity style={styles.copyButton} onPress={handleSpeakTranslation}>
                    <Ionicons name="volume-high-outline" size={14} color={theme.colors.accent} />
                    <Text style={styles.copyButtonText}>Speak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyButton} onPress={handleCopyTranslation}>
                    <Ionicons name="copy-outline" size={14} color={theme.colors.accent} />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.translationText}>{translatedText}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: theme.colors.border + '33',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    scrollContent: {
      padding: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    cardInfo: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: theme.spacing.md,
    },
    label: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    languageScrollContainer: {
      marginBottom: theme.spacing.md,
    },
    languageScroll: {
      gap: 8,
    },
    languageChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      gap: 6,
    },
    languageChipActive: {
      backgroundColor: theme.colors.accent + '15',
      borderColor: theme.colors.accent,
    },
    languageFlag: {
      fontSize: 14,
    },
    languageChipText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    languageChipTextActive: {
      color: theme.colors.accent,
    },
    translatorInputWrapper: {
      position: 'relative',
      backgroundColor: theme.colors.input,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 100,
      padding: theme.spacing.md,
    },
    translatorInput: {
      color: theme.colors.text,
      fontSize: 14,
      textAlignVertical: 'top',
      paddingRight: 24,
      minHeight: 80,
    },
    clearInputBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
    },
    translationActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    translateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: theme.roundness.md,
    },
    translateButtonDisabled: {
      backgroundColor: theme.colors.textMuted,
      opacity: 0.5,
    },
    translateButtonText: {
      color: '#08070B',
      fontSize: 13,
      fontWeight: 'bold',
    },
    translationOutputContainer: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.xs,
    },
    translationOutputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    translationLabel: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    copyButtonText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    translationText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
    },
  });
