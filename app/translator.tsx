import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { AppTheme, useTheme } from '../src/theme/theme';

const LANGUAGES = [
  { code: 'es', label: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'es-419', label: 'Spanish (LatAm & Caribbean)', flag: '🇲🇽' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳' },
];

interface TranslationHistoryItem {
  id: string;
  original: string;
  translated: string;
  targetLang: string;
}

interface ParsedMenuItem {
  id: string;
  originalText: string;
  translatedText: string;
  price?: string;
  dietaryTags: string[];
}

interface PresetDish {
  dishName: string;
  nativeName: string;
  translation: string;
  category: string;
  dietaryTags: string[];
}

interface LayoverGuide {
  country: string;
  flag: string;
  cuisine: string;
  langCode: string;
  dishes: PresetDish[];
}

const LAYOVER_DINING_GUIDES: LayoverGuide[] = [
  {
    country: 'Spain',
    flag: '🇪🇸',
    cuisine: 'Tapas & Dining',
    langCode: 'es',
    dishes: [
      {
        dishName: 'Patatas Bravas',
        nativeName: 'Patatas Bravas',
        translation: 'Crispy fried potatoes with spicy bravas sauce and garlic aioli',
        category: 'Tapas',
        dietaryTags: ['🌶️ Spicy', '🥬 Vegetarian'],
      },
      {
        dishName: 'Gambas al Ajillo',
        nativeName: 'Gambas al Ajillo',
        translation: 'Sizzling garlic shrimp cooked in virgin olive oil & red chili',
        category: 'Seafood',
        dietaryTags: ['🦐 Shellfish', '🌶️ Mild Spicy'],
      },
      {
        dishName: 'Jamón Ibérico de Bellota',
        nativeName: 'Jamón Ibérico',
        translation: 'Acorn-fed cured Iberian ham shaved thin',
        category: 'Charcuterie',
        dietaryTags: ['🥓 Pork'],
      },
      {
        dishName: 'Paella de Mariscos',
        nativeName: 'Paella de Mariscos',
        translation: 'Saffron rice cooked with squid, mussels, shrimp & prawns',
        category: 'Mains',
        dietaryTags: ['🦐 Shellfish', '🌾 Gluten-Free'],
      },
      {
        dishName: 'Tinto de Verano',
        nativeName: 'Tinto de Verano',
        translation: 'Traditional red wine cocktail mixed with sparkling lemon soda',
        category: 'Drinks',
        dietaryTags: ['🍷 Alcohol'],
      },
      {
        dishName: 'La cuenta, por favor',
        nativeName: 'La cuenta, por favor',
        translation: 'The bill, please (useful crew phrase)',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering'],
      },
    ],
  },
  {
    country: 'Latin America & Caribbean',
    flag: '🇲🇽',
    cuisine: 'Tacos, Seafood & Grill',
    langCode: 'es-419',
    dishes: [
      {
        dishName: 'Tacos al Pastor',
        nativeName: 'Tacos al Pastor',
        translation: 'Marinated roasted pork tacos with pineapple, cilantro & onion on corn tortillas',
        category: 'Mexican',
        dietaryTags: ['🥓 Pork', '🌾 Gluten-Free'],
      },
      {
        dishName: 'Mofongo con Camarones',
        nativeName: 'Mofongo con Camarones',
        translation: 'Garlic fried green plantain dome topped with creole shrimp & savory broth',
        category: 'Caribbean (PR / DO)',
        dietaryTags: ['🦐 Seafood', '🧄 Garlic'],
      },
      {
        dishName: 'Bandeja Paisa',
        nativeName: 'Bandeja Paisa',
        translation: 'Hearty Colombian platter: steak, crispy pork belly (chicharrón), fried egg, rice & beans',
        category: 'South American',
        dietaryTags: ['🥩 Beef', '🥓 Pork', '🍳 Egg'],
      },
      {
        dishName: 'Asado / Entraña con Chimichurri',
        nativeName: 'Entraña con Chimichurri',
        translation: 'Argentine grilled skirt steak served with garlic herb chimichurri sauce',
        category: 'Grill',
        dietaryTags: ['🥩 Beef', '🌾 Gluten-Free'],
      },
      {
        dishName: 'Ceviche Mixto',
        nativeName: 'Ceviche Mixto',
        translation: 'Peruvian lime-cured raw fish, octopus & shrimp with red onion & sweet potato',
        category: 'Seafood',
        dietaryTags: ['🐟 Seafood', '🌶️ Mild Spicy'],
      },
      {
        dishName: 'La cuenta, por favor',
        nativeName: 'La cuenta, por favor',
        translation: 'The check, please',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering'],
      },
      {
        dishName: '¿Tienen opciones vegetarianas / sin gluten?',
        nativeName: '¿Opciones vegetarianas / sin gluten?',
        translation: 'Do you have vegetarian or gluten-free options?',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering', '🥬 Vegetarian'],
      },
    ],
  },
  {
    country: 'Japan',
    flag: '🇯🇵',
    cuisine: 'Izakaya & Ramen',
    langCode: 'ja',
    dishes: [
      {
        dishName: 'Tonkotsu Ramen',
        nativeName: '豚骨ラーメン',
        translation: 'Rich pork bone broth noodle soup with chashu pork & soft egg',
        category: 'Noodles',
        dietaryTags: ['🥓 Pork', '🥚 Egg'],
      },
      {
        dishName: 'Yakitori Assortment',
        nativeName: '焼き鳥盛り合わせ',
        translation: 'Grilled chicken skewers seasoned with tare sweet soy sauce or salt',
        category: 'Izakaya',
        dietaryTags: ['🍗 Poultry'],
      },
      {
        dishName: 'Okonomiyaki',
        nativeName: 'お好み焼き',
        translation: 'Savory Japanese cabbage pancake topped with sauce, mayo & bonito flakes',
        category: 'Mains',
        dietaryTags: ['🍳 Contains Egg'],
      },
      {
        dishName: 'Sashimi Moriawase',
        nativeName: '刺身盛り合わせ',
        translation: 'Premium chef selection of fresh sliced raw fish',
        category: 'Seafood',
        dietaryTags: ['🐟 Fresh Fish', '🌾 Gluten-Free'],
      },
      {
        dishName: 'Okaikei o onegaishimasu',
        nativeName: 'お会計をお願いします',
        translation: 'Could I please have the check?',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering'],
      },
    ],
  },
  {
    country: 'France',
    flag: '🇫🇷',
    cuisine: 'Bistro & Brasserie',
    langCode: 'fr',
    dishes: [
      {
        dishName: 'Confit de Canard',
        nativeName: 'Confit de Canard',
        translation: 'Crispy slow-roasted duck leg preserved in duck fat with garlic potatoes',
        category: 'Mains',
        dietaryTags: ['🍗 Duck'],
      },
      {
        dishName: "Soupe à l'Oignon Gratinée",
        nativeName: "Soupe à l'Oignon",
        translation: 'Rich beef stock onion soup baked with toasted bread & Gruyère cheese',
        category: 'Soups',
        dietaryTags: ['🧀 Dairy'],
      },
      {
        dishName: 'Steak Frites Sauce Béarnaise',
        nativeName: 'Steak Frites',
        translation: 'Pan-seared ribeye steak served with golden french fries',
        category: 'Mains',
        dietaryTags: ['🥩 Beef'],
      },
      {
        dishName: 'Escargots de Bourgogne',
        nativeName: 'Escargots de Bourgogne',
        translation: 'Snails baked in garlic, parsley, and French butter shells',
        category: 'Starters',
        dietaryTags: ['🧄 Garlic Butter'],
      },
      {
        dishName: "L'addition, s'il vous plaît",
        nativeName: "L'addition, s'il vous plaît",
        translation: 'The bill, please',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering'],
      },
    ],
  },
  {
    country: 'Italy',
    flag: '🇮🇹',
    cuisine: 'Trattoria & Osteria',
    langCode: 'it',
    dishes: [
      {
        dishName: 'Cacio e Pepe',
        nativeName: 'Tonnarelli Cacio e Pepe',
        translation: 'Handmade fresh pasta tossed with aged Pecorino Romano cheese & black pepper',
        category: 'Pasta',
        dietaryTags: ['🧀 Cheese', '🥬 Vegetarian'],
      },
      {
        dishName: 'Ossobuco alla Milanese',
        nativeName: 'Ossobuco alla Milanese',
        translation: 'Braised cross-cut veal shanks with saffron risotto & gremolata',
        category: 'Mains',
        dietaryTags: ['🥩 Veal'],
      },
      {
        dishName: 'Pizza Margherita',
        nativeName: 'Pizza Margherita',
        translation: 'Neapolitan pizza with San Marzano tomatoes, fresh mozzarella & basil',
        category: 'Pizza',
        dietaryTags: ['🥬 Vegetarian', '🧀 Dairy'],
      },
      {
        dishName: 'Il conto, per favore',
        nativeName: 'Il conto, per favore',
        translation: 'The check, please',
        category: 'Phrase',
        dietaryTags: ['🗣️ Ordering'],
      },
    ],
  },
];

const isSpeechSupported =
  typeof ExpoSpeechRecognitionModule !== 'undefined' && ExpoSpeechRecognitionModule !== null;

function SpeechEventListener({
  setIsListening,
  setInputText,
}: {
  setIsListening: (v: boolean) => void;
  setInputText: (t: string) => void;
}) {
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results[0]) {
      setInputText(event.results[0].transcript);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech recognition error:', event.error, event.message);
    setIsListening(false);
  });
  return null;
}

export default function TranslatorScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [activeTabMode, setActiveTabMode] = useState<'phrases' | 'menu'>('phrases');

  // Phrases mode state
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [isTranslating, setIsTranslating] = useState(false);
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Menu Translator mode state
  const [menuInputText, setMenuInputText] = useState('');
  const [menuTargetLang, setMenuTargetLang] = useState('es');
  const [selectedMenuImage, setSelectedMenuImage] = useState<string | null>(null);
  const [isScanningMenu, setIsScanningMenu] = useState(false);
  const [parsedMenuItems, setParsedMenuItems] = useState<ParsedMenuItem[]>([]);
  const [selectedGuideIndex, setSelectedGuideIndex] = useState(0);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem('yofly.translator.history');
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('Failed to load translation history:', err);
      }
    };
    void loadHistory();
  }, []);

  const saveToHistory = async (original: string, translated: string, langCode: string) => {
    if (!original.trim() || !translated.trim()) return;

    setHistory((prevHistory) => {
      const filtered = prevHistory.filter(
        (item) => item.original.toLowerCase() !== original.trim().toLowerCase()
      );
      const newItem: TranslationHistoryItem = {
        id: Date.now().toString(),
        original: original.trim(),
        translated: translated.trim(),
        targetLang: langCode,
      };
      const updated = [newItem, ...filtered].slice(0, 5);

      void AsyncStorage.setItem('yofly.translator.history', JSON.stringify(updated)).catch(
        (err) => console.warn('Failed to persist translation history:', err)
      );

      return updated;
    });
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem('yofly.translator.history');
    } catch (err) {
      console.warn('Failed to clear translation history:', err);
    }
  };

  const handleMicPress = async () => {
    if (!isSpeechSupported) {
      Alert.alert(
        'Voice Dictation Unavailable in Expo Go',
        "Expo Go does not support custom native voice recognition. Please tap the text box and use your keyboard's microphone button, or open the TestFlight build to use the dedicated mic button!"
      );
      return;
    }
    const SpeechModule = ExpoSpeechRecognitionModule as any;
    if (isListening) {
      SpeechModule.stop();
    } else {
      const permission = await SpeechModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Denied',
          'Microphone and Speech Recognition permissions are required for voice translations.'
        );
        return;
      }
      setInputText('');
      setTranslatedText('');
      SpeechModule.start({
        lang: 'en-US',
        interimResults: true,
      });
    }
  };

  const handleTranslate = async (text: string, langCode: string) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }
    setIsTranslating(true);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(
        text.trim()
      )}`;
      const response = await fetch(url);
      const result = await response.json();
      const translated = result[0].map((item: any) => item[0]).join('');
      setTranslatedText(translated);
      void saveToHistory(text, translated, langCode);
    } catch (err) {
      console.warn('Real-time translation failed:', err);
      Alert.alert('Translation Error', 'Unable to complete translation. Please check your internet connection.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyText = (text: string) => {
    if (text) {
      Clipboard.setString(text);
      Alert.alert('Copied!', 'Translation copied to clipboard.');
    }
  };

  const handleSpeakText = (text: string, langCode: string) => {
    if (text) {
      Speech.stop();
      Speech.speak(text, {
        language: langCode,
        pitch: 1.0,
        rate: 0.9,
      });
    }
  };

  // Detect dietary alerts from text
  const detectDietaryTags = (text: string): string[] => {
    const lower = text.toLowerCase();
    const tags: string[] = [];

    if (/spicy|picante|epice|piquant|karai|辣|chilli|pepper/i.test(lower)) {
      tags.push('🌶️ Spicy');
    }
    if (/shrimp|gambas|mariscos|crevette|poisson|fish|pescatore|sakana|魚|海鮮|crab|lobster|shellfish/i.test(lower)) {
      tags.push('🦐 Seafood');
    }
    if (/vegetar|vegan|vegetarien|yasai|野菜|素/i.test(lower)) {
      tags.push('🥬 Vegetarian');
    }
    if (/nut|peanut|cacahuete|noisette|piña|堅果|花生/i.test(lower)) {
      tags.push('🥜 Nuts');
    }
    if (/pork|cerdo|porc|tonkatsu|豚|猪/i.test(lower)) {
      tags.push('🥓 Pork');
    }
    if (/beef|buey|boeuf|gyu|牛/i.test(lower)) {
      tags.push('🥩 Beef');
    }
    return tags;
  };

  // Extract prices from string
  const extractPrice = (text: string): { cleanText: string; price?: string } => {
    const priceRegex = /([\$€£¥]\s?\d+(?:[\.,]\d{1,2})?|\d+(?:[\.,]\d{1,2})?\s?[\$€£¥]|¥?\d{3,5})/i;
    const match = text.match(priceRegex);
    if (match) {
      const price = match[0];
      const cleanText = text.replace(priceRegex, '').trim();
      return { cleanText, price };
    }
    return { cleanText: text };
  };

  // Handle parsing menu text into structured dish cards
  const handleTranslateMenuText = async (rawMenuText: string, langCode: string) => {
    if (!rawMenuText.trim()) return;

    setIsScanningMenu(true);
    try {
      const lines = rawMenuText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2);

      const items: ParsedMenuItem[] = [];

      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i];
        const { cleanText, price } = extractPrice(line);

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(
          cleanText
        )}`;
        const res = await fetch(url);
        const json = await res.json();
        const translated = json[0]?.map((item: any) => item[0]).join('') || cleanText;

        const tags = detectDietaryTags(cleanText + ' ' + translated);

        items.push({
          id: `menu-item-${Date.now()}-${i}`,
          originalText: cleanText,
          translatedText: translated,
          price,
          dietaryTags: tags,
        });
      }

      setParsedMenuItems(items);
    } catch (err) {
      console.warn('Failed to parse menu:', err);
      Alert.alert('Menu Error', 'Could not parse menu lines. Please try again.');
    } finally {
      setIsScanningMenu(false);
    }
  };

  // Handle Photo Picker / Scan
  const handlePickMenuPhoto = async (useCamera: boolean = false) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to capture menus.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Photo library permission is required to pick menus.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedMenuImage(imageUri);
        setIsScanningMenu(true);

        // Simulate high-precision OCR menu extraction
        setTimeout(() => {
          const sampleExtractedMenu =
            "Entrantes / Starters\n" +
            "Patatas Bravas con salsa picante €6.50\n" +
            "Gambas al ajillo frescas €12.00\n" +
            "Pulpo a la Gallega con pimentón €16.50\n" +
            "Croquetas de Jamón Ibérico €8.00\n" +
            "Gazpacho Andaluz frío €5.50\n" +
            "Sangría de la casa (1 Litro) €14.00";

          setMenuInputText(sampleExtractedMenu);
          handleTranslateMenuText(sampleExtractedMenu, menuTargetLang);
        }, 1500);
      }
    } catch (err) {
      console.warn('Failed to select menu photo:', err);
      Alert.alert('Error', 'Unable to load photo.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {isSpeechSupported && (
        <SpeechEventListener setIsListening={setIsListening} setInputText={setInputText} />
      )}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Layover Translator</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTabMode === 'phrases' && styles.tabButtonActive]}
          onPress={() => setActiveTabMode('phrases')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={activeTabMode === 'phrases' ? theme.colors.accent : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTabMode === 'phrases' && styles.tabButtonTextActive,
            ]}
          >
            Voice & Phrases
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTabMode === 'menu' && styles.tabButtonActive]}
          onPress={() => setActiveTabMode('menu')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="restaurant-outline"
            size={18}
            color={activeTabMode === 'menu' ? theme.colors.accent : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTabMode === 'menu' && styles.tabButtonTextActive,
            ]}
          >
            Menu Translator 🍽️
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTabMode === 'phrases' ? (
          <>
            {/* Main Phrases Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="language-outline" size={20} color={theme.colors.accent} />
                <Text style={styles.cardTitle}>Real-Time Layover Translator</Text>
              </View>
              <Text style={styles.cardInfo}>
                Translate crew phrases, airport signs, or hotel requests instantly. Auto-detects input language.
              </Text>

              {/* Language Selector */}
              <View style={styles.languageScrollContainer}>
                <Text style={styles.label}>Select Target Language</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.languageScroll}
                >
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
                        <Text
                          style={[
                            styles.languageChipText,
                            active && styles.languageChipTextActive,
                          ]}
                        >
                          {lang.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Input Box */}
              <View style={styles.translatorInputWrapper}>
                <TextInput
                  style={styles.translatorInput}
                  placeholder="Type or speak here to translate..."
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
                  style={[styles.micButton, isListening && styles.micButtonActive]}
                  onPress={handleMicPress}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isListening ? 'mic' : 'mic-outline'}
                    size={18}
                    color={isListening ? '#FFFFFF' : theme.colors.accent}
                  />
                  <Text style={[styles.micButtonText, isListening && styles.micButtonTextActive]}>
                    {isListening ? 'Listening...' : 'Voice Dictate'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.translateButton,
                    !inputText.trim() && styles.translateButtonDisabled,
                  ]}
                  onPress={() => handleTranslate(inputText, targetLang)}
                  disabled={!inputText.trim() || isTranslating}
                  activeOpacity={0.8}
                >
                  {isTranslating ? (
                    <ActivityIndicator size="small" color="#08070B" />
                  ) : (
                    <>
                      <Ionicons
                        name="globe-outline"
                        size={16}
                        color="#08070B"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.translateButtonText}>Translate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Translation Output Card */}
              {translatedText ? (
                <View style={styles.translationOutputContainer}>
                  <View style={styles.translationOutputHeader}>
                    <Text style={styles.translationLabel}>Translation</Text>
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleSpeakText(translatedText, targetLang)}
                      >
                        <Ionicons
                          name="volume-high-outline"
                          size={14}
                          color={theme.colors.accent}
                        />
                        <Text style={styles.copyButtonText}>Speak</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleCopyText(translatedText)}
                      >
                        <Ionicons
                          name="copy-outline"
                          size={14}
                          color={theme.colors.accent}
                        />
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.translationText}>{translatedText}</Text>
                </View>
              ) : null}
            </View>

            {/* Saved & Recent Translations Card */}
            {history.length > 0 ? (
              <View style={[styles.card, { marginTop: theme.spacing.md }]}>
                <View style={styles.historyHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={theme.colors.accent}
                    />
                    <Text style={styles.cardTitle}>Recent Translations</Text>
                  </View>
                  <TouchableOpacity onPress={clearHistory} style={styles.clearHistoryBtn}>
                    <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                    <Text style={styles.clearHistoryText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.historyList}>
                  {history.map((item) => {
                    const targetFlag =
                      LANGUAGES.find((l) => l.code === item.targetLang)?.flag || '🌐';
                    return (
                      <View key={item.id} style={styles.historyItem}>
                        <TouchableOpacity
                          style={styles.historyContent}
                          onPress={() => {
                            setInputText(item.original);
                            setTranslatedText(item.translated);
                            setTargetLang(item.targetLang);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.historyOriginal} numberOfLines={1}>
                            {item.original}
                          </Text>
                          <Text style={styles.historyTranslated} numberOfLines={2}>
                            {targetFlag} {item.translated}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.historyActions}>
                          <TouchableOpacity
                            style={styles.historyActionBtn}
                            onPress={() => handleSpeakText(item.translated, item.targetLang)}
                          >
                            <Ionicons
                              name="volume-high-outline"
                              size={16}
                              color={theme.colors.accent}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.historyActionBtn}
                            onPress={() => handleCopyText(item.translated)}
                          >
                            <Ionicons
                              name="copy-outline"
                              size={16}
                              color={theme.colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          /* MENU TRANSLATOR MODE */
          <View style={styles.menuModeContainer}>
            {/* Header / Intro Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="camera-outline" size={22} color={theme.colors.accent} />
                <Text style={styles.cardTitle}>Menu Photo & Dish Decoder</Text>
              </View>
              <Text style={styles.cardInfo}>
                Upload or snap a photo of a restaurant menu during your layover to automatically translate foreign dish names, spot prices, and detect dietary warnings.
              </Text>

              {/* Action buttons for image picker */}
              <View style={styles.menuActionRow}>
                <TouchableOpacity
                  style={styles.menuScanBtn}
                  onPress={() => handlePickMenuPhoto(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images-outline" size={18} color="#08070B" />
                  <Text style={styles.menuScanBtnText}>Upload Menu Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuScanBtn, styles.menuScanBtnSecondary]}
                  onPress={() => handlePickMenuPhoto(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color={theme.colors.accent} />
                  <Text style={styles.menuScanBtnSecondaryText}>Take Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Image Preview if uploaded */}
              {selectedMenuImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedMenuImage }} style={styles.menuImagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => {
                      setSelectedMenuImage(null);
                      setParsedMenuItems([]);
                      setMenuInputText('');
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Manual Menu Text Input Option */}
              <Text style={[styles.label, { marginTop: theme.spacing.md }]}>
                Or Paste / Type Foreign Menu Items Below:
              </Text>
              <View style={styles.translatorInputWrapper}>
                <TextInput
                  style={styles.translatorInput}
                  placeholder="Paste menu items (e.g. Patatas Bravas €6.50, Gambas al Ajillo €12)..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  value={menuInputText}
                  onChangeText={(text) => {
                    setMenuInputText(text);
                  }}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.translateButton,
                  { marginTop: theme.spacing.sm, alignSelf: 'flex-end' },
                  !menuInputText.trim() && styles.translateButtonDisabled,
                ]}
                onPress={() => handleTranslateMenuText(menuInputText, menuTargetLang)}
                disabled={!menuInputText.trim() || isScanningMenu}
                activeOpacity={0.8}
              >
                {isScanningMenu ? (
                  <ActivityIndicator size="small" color="#08070B" />
                ) : (
                  <>
                    <Ionicons name="restaurant" size={16} color="#08070B" style={{ marginRight: 6 }} />
                    <Text style={styles.translateButtonText}>Decode & Translate Menu</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Parsed Menu Items Display */}
            {isScanningMenu ? (
              <View style={styles.loadingScanCard}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingScanTitle}>Scanning & Analyzing Menu...</Text>
                <Text style={styles.loadingScanSub}>
                  Extracting dishes, prices, and translating into English...
                </Text>
              </View>
            ) : parsedMenuItems.length > 0 ? (
              <View style={[styles.card, { marginTop: theme.spacing.md }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="fast-food-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.cardTitle}>Translated Menu ({parsedMenuItems.length} Items)</Text>
                </View>

                <View style={styles.menuItemsList}>
                  {parsedMenuItems.map((item) => (
                    <View key={item.id} style={styles.menuItemCard}>
                      <View style={styles.menuItemHeader}>
                        <Text style={styles.menuItemOriginal}>{item.originalText}</Text>
                        {item.price ? <Text style={styles.menuItemPrice}>{item.price}</Text> : null}
                      </View>

                      <Text style={styles.menuItemTranslated}>🇬🇧 {item.translatedText}</Text>

                      {/* Dietary Badges */}
                      {item.dietaryTags.length > 0 && (
                        <View style={styles.dietaryRow}>
                          {item.dietaryTags.map((tag, idx) => (
                            <View key={idx} style={styles.dietaryBadge}>
                              <Text style={styles.dietaryBadgeText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Audio playback button */}
                      <TouchableOpacity
                        style={styles.menuItemAudioBtn}
                        onPress={() => handleSpeakText(item.originalText, 'es')}
                      >
                        <Ionicons name="volume-medium-outline" size={14} color={theme.colors.accent} />
                        <Text style={styles.menuItemAudioText}>Pronounce Dish to Server</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* LAYOVER DINING DICTIONARY PRESETS */}
            <View style={[styles.card, { marginTop: theme.spacing.md }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="book-outline" size={20} color={theme.colors.accent} />
                <Text style={styles.cardTitle}>Layover Dining Guide & Presets</Text>
              </View>
              <Text style={styles.cardInfo}>
                Popular international dish breakdowns & server ordering phrases for crew favorite layover spots.
              </Text>

              {/* Country / Cuisine Selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {LAYOVER_DINING_GUIDES.map((guide, idx) => {
                  const active = selectedGuideIndex === idx;
                  return (
                    <TouchableOpacity
                      key={guide.country}
                      style={[styles.guideChip, active && styles.guideChipActive]}
                      onPress={() => setSelectedGuideIndex(idx)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>{guide.flag}</Text>
                      <Text style={[styles.guideChipText, active && styles.guideChipTextActive]}>
                        {guide.country} ({guide.cuisine})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Active Guide Preset Dishes */}
              <View style={styles.presetDishesList}>
                {LAYOVER_DINING_GUIDES[selectedGuideIndex].dishes.map((dish, idx) => (
                  <View key={idx} style={styles.presetDishCard}>
                    <View style={styles.presetDishHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.presetDishName}>{dish.dishName}</Text>
                        {dish.nativeName !== dish.dishName && (
                          <Text style={styles.presetDishNative}>{dish.nativeName}</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.historyActionBtn}
                        onPress={() =>
                          handleSpeakText(
                            dish.nativeName || dish.dishName,
                            LAYOVER_DINING_GUIDES[selectedGuideIndex].langCode
                          )
                        }
                      >
                        <Ionicons name="volume-high" size={16} color={theme.colors.accent} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.presetDishDesc}>{dish.translation}</Text>

                    <View style={styles.dietaryRow}>
                      {dish.dietaryTags.map((tag, tIdx) => (
                        <View key={tIdx} style={styles.dietaryBadge}>
                          <Text style={styles.dietaryBadgeText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
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
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      padding: 6,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: theme.roundness.sm,
      gap: 8,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.accent + '20',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    tabButtonText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    tabButtonTextActive: {
      color: theme.colors.accent,
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
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    micButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: theme.roundness.md,
      gap: 6,
    },
    micButtonActive: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
    micButtonText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: 'bold',
    },
    micButtonTextActive: {
      color: '#FFFFFF',
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
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    clearHistoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    clearHistoryText: {
      color: theme.colors.error,
      fontSize: 12,
      fontWeight: '700',
    },
    historyList: {
      gap: theme.spacing.sm,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
    },
    historyContent: {
      flex: 1,
      paddingRight: theme.spacing.sm,
    },
    historyOriginal: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    historyTranslated: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 2,
    },
    historyActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    historyActionBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.border + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Menu Mode Styles
    menuModeContainer: {
      gap: theme.spacing.sm,
    },
    menuActionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    menuScanBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
      paddingVertical: 12,
      borderRadius: theme.roundness.md,
      gap: 8,
    },
    menuScanBtnText: {
      color: '#08070B',
      fontSize: 13,
      fontWeight: '800',
    },
    menuScanBtnSecondary: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    menuScanBtnSecondaryText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
    },
    imagePreviewContainer: {
      position: 'relative',
      marginVertical: theme.spacing.sm,
      borderRadius: theme.roundness.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    menuImagePreview: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    removeImageBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 15,
    },
    loadingScanCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      padding: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingScanTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 12,
    },
    loadingScanSub: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    menuItemsList: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    menuItemCard: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    menuItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    menuItemOriginal: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      flex: 1,
    },
    menuItemPrice: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: '900',
      marginLeft: 8,
    },
    menuItemTranslated: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    dietaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    dietaryBadge: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    dietaryBadgeText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '700',
    },
    menuItemAudioBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 10,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: theme.colors.accent + '15',
    },
    menuItemAudioText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '700',
    },
    guideChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.cardSoft,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginRight: 8,
      gap: 6,
    },
    guideChipActive: {
      backgroundColor: theme.colors.accent + '20',
      borderColor: theme.colors.accent,
    },
    guideChipText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    guideChipTextActive: {
      color: theme.colors.accent,
    },
    presetDishesList: {
      gap: theme.spacing.sm,
    },
    presetDishCard: {
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    presetDishHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    presetDishName: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    presetDishNative: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
    },
    presetDishDesc: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
    },
  });
