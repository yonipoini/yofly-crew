import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert as RNAlert,
  Keyboard,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../src/context/ProfileContext';
import { AppTheme, useTheme } from '../src/theme/theme';

interface HotelCredentials {
  hotelName: string;
  roomNumber: string;
  wifiSsid: string;
  wifiPassword: string;
}

export default function SlamClickerScreen() {
  const { theme, isDark } = useTheme();
  const { profile } = useProfile();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Determine active airport context
  const activeAirportCode = useMemo(() => {
    return profile.preferences.opsContextMode === 'LAYOVER' && profile.preferences.layoverAirport
      ? profile.preferences.layoverAirport
      : profile.preferences.opsContextMode === 'TRIP' && profile.preferences.tripAirport
      ? profile.preferences.tripAirport
      : profile.preferences.opsContextMode === 'MANUAL'
      ? profile.preferences.activeOpsAirport || profile.baseAirport || 'JFK'
      : profile.baseAirport || 'JFK';
  }, [profile]);

  // State
  const [isSlamClicking, setIsSlamClicking] = useState(false);
  const [credentials, setCredentials] = useState<HotelCredentials>({
    hotelName: '',
    roomNumber: '',
    wifiSsid: '',
    wifiPassword: '',
  });
  const [reportTime, setReportTime] = useState('06:30'); // HH:MM format
  const [prepTime, setPrepTime] = useState(45); // in minutes
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStretch, setExpandedStretch] = useState<number | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Load DND status
        const storedDnd = await AsyncStorage.getItem(`yofly.slamclicker.dnd`);
        if (storedDnd === 'true') {
          setIsSlamClicking(true);
        } else {
          setIsSlamClicking(false);
        }

        // Load Hotel Wallet for active airport
        const storedCreds = await AsyncStorage.getItem(`yofly.slamclicker.wallet.${activeAirportCode}`);
        if (storedCreds) {
          setCredentials(JSON.parse(storedCreds));
        } else {
          setCredentials({
            hotelName: '',
            roomNumber: '',
            wifiSsid: '',
            wifiPassword: '',
          });
        }
      } catch (error) {
        console.warn('Failed to load Slam Clicker data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [activeAirportCode]);

  // Save Credentials helper
  const saveCredentials = async (updated: HotelCredentials) => {
    setCredentials(updated);
    try {
      await AsyncStorage.setItem(
        `yofly.slamclicker.wallet.${activeAirportCode}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.warn('Failed to persist credentials:', error);
    }
  };

  // Toggle Slam Clicking DND status
  const toggleSlamClicking = async () => {
    const nextVal = !isSlamClicking;
    setIsSlamClicking(nextVal);
    try {
      await AsyncStorage.setItem(`yofly.slamclicker.dnd`, nextVal ? 'true' : 'false');
    } catch (error) {
      console.warn('Failed to persist DND status:', error);
    }
  };

  // Share Hotel Wi-Fi Credentials
  const handleShareCredentials = async () => {
    const shareText = `🛌 Layover Wi-Fi Wallet (${activeAirportCode})\n🏨 Hotel: ${credentials.hotelName || 'Not Set'}\n🔑 Room: ${credentials.roomNumber || 'Not Set'}\n📶 Wi-Fi SSID: ${credentials.wifiSsid || 'Not Set'}\n🔑 Password: ${credentials.wifiPassword || 'Not Set'}\n\nShared via YoFly Crew Companion.`;
    try {
      await Share.share({
        message: shareText,
      });
    } catch (error: any) {
      RNAlert.alert('Error', error?.message || 'Could not share hotel details.');
    }
  };

  // Deep linking for delivery apps
  const handleLaunchDeliveryApp = (appName: string, schemeUrl: string, webUrl: string) => {
    Linking.canOpenURL(schemeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(schemeUrl);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl).catch(() => {
          RNAlert.alert('Error', `Could not open ${appName}.`);
        });
      });
  };

  // Sleep Calculator calculations
  const sleepCycles = useMemo(() => {
    // Parse HH:MM report time
    const [reportHour, reportMin] = reportTime.split(':').map(Number);
    if (isNaN(reportHour) || isNaN(reportMin) || reportHour < 0 || reportHour > 23 || reportMin < 0 || reportMin > 59) {
      return [];
    }

    // Convert target report time to minutes of the day
    const reportTotalMins = reportHour * 60 + reportMin;

    // Wake-up time is report time minus prep time
    let wakeTotalMins = reportTotalMins - prepTime;
    if (wakeTotalMins < 0) {
      wakeTotalMins += 24 * 60; // wrap to previous day
    }

    const wakeHour = Math.floor(wakeTotalMins / 60);
    const wakeMin = wakeTotalMins % 60;
    const formatTime = (h: number, m: number) => {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      return `${hh}:${mm}`;
    };

    // Calculate sleep cycles backwards (each cycle is 90 mins)
    const cyclesConfig = [
      { cycles: 6, label: 'Optimal Rest', desc: '9h Sleep • 6 Full Cycles' },
      { cycles: 5, label: 'Recommended', desc: '7.5h Sleep • 5 Full Cycles' },
      { cycles: 4, label: 'Core Rest', desc: '6h Sleep • 4 Full Cycles' },
    ];

    return cyclesConfig.map((item) => {
      let sleepMins = wakeTotalMins - item.cycles * 90;
      if (sleepMins < 0) {
        sleepMins += 24 * 60;
      }
      const sleepH = Math.floor(sleepMins / 60);
      const sleepM = sleepMins % 60;

      return {
        ...item,
        bedTime: formatTime(sleepH, sleepM),
        wakeTime: formatTime(wakeHour, wakeMin),
      };
    });
  }, [reportTime, prepTime]);

  // In-Room Stretching Routines
  const stretches = [
    {
      id: 1,
      name: 'Spinal Decompression Roll-Down',
      duration: '2 minutes',
      desc: 'Stand with feet shoulder-width apart. Inhale deeply, then exhale as you slowly roll down spine bone-by-bone. Let your head, neck, and arms hang heavy. Soften your knees.',
      tip: 'Perfect for counteracting gravity forces and long hours sitting in flight decks or standing in galleys.',
      icon: 'body-outline',
    },
    {
      id: 2,
      name: 'Hamstring & Lower Back Bed Stretch',
      duration: '3 minutes',
      desc: 'Sit upright on the edge of the bed. Extend one leg straight forward with foot flexed. Gently hinge forward from your hips, keeping your chest open. Hold for 90 seconds, then swap legs.',
      tip: 'Relieves sciatic pressure caused by long-duration crew seating.',
      icon: 'bed-outline',
    },
    {
      id: 3,
      name: 'Legs-Up-The-Wall (Viparita Karani)',
      duration: '10 minutes',
      desc: 'Lie on your back next to a hotel wall. Hinge your hips as close to the wall as comfortable and extend your legs straight up vertically. Place arms at your sides, close your eyes, and breathe slowly.',
      tip: 'Drains pooled blood and fluid from feet/legs, reduces swelling, and triggers parasympathetic rest responses.',
      icon: 'analytics-outline',
    },
    {
      id: 4,
      name: 'Doorway Shoulder & Chest Opener',
      duration: '2 minutes',
      desc: 'Stand in the hotel room doorway. Place your forearms flat against the doorframe at a 90-degree angle. Gently step one foot forward until you feel a comfortable stretch across your collarbone and shoulders.',
      tip: 'Corrects forward-slumped shoulders from steering or pushing galley carts.',
      icon: 'door-outline',
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Slam Clicker Mode</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareCredentials}>
          <Ionicons name="share-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* DND Toggle Widget */}
        <View style={[styles.card, styles.dndCard, isSlamClicking && styles.dndCardActive]}>
          <View style={styles.dndHeader}>
            <View style={styles.dndTitleRow}>
              <View style={[styles.dndIconWrap, { backgroundColor: isSlamClicking ? '#FF3B3018' : theme.colors.border }]}>
                <Ionicons 
                  name={isSlamClicking ? 'moon' : 'moon-outline'} 
                  size={22} 
                  color={isSlamClicking ? '#FF3B30' : theme.colors.textMuted} 
                />
              </View>
              <View>
                <Text style={styles.dndTitle}>Slam Clicker DND</Text>
                <Text style={styles.dndSubtitle}>
                  {isSlamClicking ? 'Active • Muted community notifications' : 'Disabled • Open for socialize / plans'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.toggleBtn, isSlamClicking && styles.toggleBtnActive]}
              onPress={toggleSlamClicking}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleCircle, isSlamClicking && styles.toggleCircleActive]} />
            </TouchableOpacity>
          </View>
          {isSlamClicking ? (
            <View style={styles.dndBanner}>
              <Ionicons name="lock-closed" size={14} color="#FF3B30" style={{ marginRight: 6 }} />
              <Text style={styles.dndBannerText}>
                Your door is shut! Other crew members will see you are resting. Muting general feeds.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Hotel Credentials Wallet */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>Layover Hotel credentials ({activeAirportCode})</Text>
          </View>
          <Text style={styles.cardInfo}>Persisted locally so you don't lose the Wi-Fi card.</Text>

          <View style={styles.walletForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Layover Hotel Name</Text>
              <TextInput
                style={styles.textInput}
                value={credentials.hotelName}
                onChangeText={(val) => saveCredentials({ ...credentials, hotelName: val })}
                placeholder="e.g. Hilton Orlando Airport"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Room Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={credentials.roomNumber}
                  onChangeText={(val) => saveCredentials({ ...credentials, roomNumber: val })}
                  placeholder="e.g. 402"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>Wi-Fi Network SSID</Text>
                <TextInput
                  style={styles.textInput}
                  value={credentials.wifiSsid}
                  onChangeText={(val) => saveCredentials({ ...credentials, wifiSsid: val })}
                  placeholder="e.g. Hilton_Guest"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Wi-Fi Password</Text>
              <TextInput
                style={styles.textInput}
                value={credentials.wifiPassword}
                onChangeText={(val) => saveCredentials({ ...credentials, wifiPassword: val })}
                placeholder="e.g. room402 or crew2026"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>

        {/* Optimal Sleep Rest Calculator */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="alarm-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>Sleep Cycle Calculator</Text>
          </View>
          <Text style={styles.cardInfo}>
            Waking up at the end of a 90-minute sleep cycle minimizes grogginess (sleep inertia) before duty.
          </Text>

          <View style={styles.calculatorForm}>
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.inputLabel}>Report/Shuttle Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={reportTime}
                  onChangeText={(val) => {
                    // Quick validation for raw typing format (HH:MM)
                    setReportTime(val);
                  }}
                  placeholder="06:30"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Wake Prep (mins)</Text>
                <View style={styles.prepRow}>
                  <TouchableOpacity
                    style={styles.prepBtn}
                    onPress={() => setPrepTime(Math.max(15, prepTime - 15))}
                  >
                    <Ionicons name="remove" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.prepValue}>{prepTime}m</Text>
                  <TouchableOpacity
                    style={styles.prepBtn}
                    onPress={() => setPrepTime(Math.min(120, prepTime + 15))}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.sleepResults}>
              <Text style={styles.resultsHeader}>Suggested Bedtimes (to wake at {sleepCycles[0]?.wakeTime || '05:45'} AM):</Text>
              {sleepCycles.map((cycle, index) => (
                <View key={cycle.cycles} style={styles.cycleCard}>
                  <View style={styles.cycleInfo}>
                    <Text style={styles.cycleLabel}>{cycle.label}</Text>
                    <Text style={styles.cycleDesc}>{cycle.desc}</Text>
                  </View>
                  <View style={styles.cycleTimeContainer}>
                    <Text style={styles.cycleTime}>{cycle.bedTime}</Text>
                    <Text style={styles.cycleBedLabel}>Go to sleep</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Room Service / Delivery Links */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>In-Room Dining & Delivery</Text>
          </View>
          <Text style={styles.cardInfo}>One-tap shortcuts to launch local delivery apps directly in your room.</Text>
          <View style={styles.deliveryGrid}>
            <TouchableOpacity
              style={[styles.deliveryBtn, { backgroundColor: '#FF3008' }]}
              onPress={() =>
                handleLaunchDeliveryApp(
                  'DoorDash',
                  'doordash://',
                  'https://www.doordash.com'
                )
              }
            >
              <Ionicons name="cart" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.deliveryText}>DoorDash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deliveryBtn, { backgroundColor: '#06C167' }]}
              onPress={() =>
                handleLaunchDeliveryApp(
                  'Uber Eats',
                  'ubereats://',
                  'https://www.ubereats.com'
                )
              }
            >
              <Ionicons name="restaurant" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.deliveryText}>Uber Eats</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deliveryBtn, { backgroundColor: '#FF8200' }]}
              onPress={() =>
                handleLaunchDeliveryApp(
                  'Instacart',
                  'instacart://',
                  'https://www.instacart.com'
                )
              }
            >
              <Ionicons name="basket" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.deliveryText}>Instacart</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* In-Room Crew Stretching Routine */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>Hotel Room Recovery Stretches</Text>
          </View>
          <Text style={styles.cardInfo}>
            Perform these zero-equipment stretches right next to your bed to relieve flight duties tension.
          </Text>

          <View style={styles.stretchesList}>
            {stretches.map((stretch) => {
              const active = expandedStretch === stretch.id;
              return (
                <TouchableOpacity
                  key={stretch.id}
                  style={[styles.stretchItem, active && styles.stretchItemActive]}
                  onPress={() => setExpandedStretch(active ? null : stretch.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.stretchHeader}>
                    <View style={styles.stretchIconWrap}>
                      <Ionicons
                        name={stretch.icon as any}
                        size={18}
                        color={theme.colors.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stretchName}>{stretch.name}</Text>
                      <Text style={styles.stretchDuration}>{stretch.duration}</Text>
                    </View>
                    <Ionicons
                      name={active ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </View>
                  {active ? (
                    <View style={styles.stretchExpanded}>
                      <Text style={styles.stretchDesc}>{stretch.desc}</Text>
                      <View style={styles.stretchTipBox}>
                        <Ionicons name="bulb-outline" size={14} color={theme.colors.accent} style={{ marginRight: 6 }} />
                        <Text style={styles.stretchTipText}>{stretch.tip}</Text>
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
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
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    shareButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      paddingBottom: 48,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 16,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    cardInfo: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 16,
      fontWeight: '600',
    },
    dndCard: {
      borderColor: theme.colors.border,
    },
    dndCardActive: {
      borderColor: '#FF3B3050',
      backgroundColor: isDark ? 'rgba(255, 59, 48, 0.04)' : 'rgba(255, 59, 48, 0.02)',
    },
    dndHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dndTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    dndIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dndTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    dndSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
      fontWeight: '700',
    },
    toggleBtn: {
      width: 50,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleBtnActive: {
      backgroundColor: '#FF3B30',
    },
    toggleCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      transform: [{ translateX: 0 }],
    },
    toggleCircleActive: {
      transform: [{ translateX: 20 }],
    },
    dndBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 59, 48, 0.05)',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginTop: 12,
    },
    dndBannerText: {
      flex: 1,
      color: '#FF3B30',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    walletForm: {
      gap: 12,
    },
    inputGroup: {
      gap: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inputLabel: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    textInput: {
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: 12,
      color: theme.colors.text,
      fontSize: 14,
    },
    calculatorForm: {
      gap: 16,
    },
    prepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      borderRadius: 10,
      height: 44,
      paddingHorizontal: 6,
    },
    prepBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    prepValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    sleepResults: {
      marginTop: 8,
      gap: 10,
    },
    resultsHeader: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
    },
    cycleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.input,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cycleInfo: {
      flex: 1,
      gap: 2,
    },
    cycleLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    cycleDesc: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    cycleTimeContainer: {
      alignItems: 'flex-end',
      gap: 2,
    },
    cycleTime: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '900',
    },
    cycleBedLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    deliveryGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    deliveryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      borderRadius: 21,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    deliveryText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    stretchesList: {
      gap: 10,
    },
    stretchItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      overflow: 'hidden',
    },
    stretchItemActive: {
      borderColor: theme.colors.accent + '44',
    },
    stretchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    stretchIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stretchName: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    stretchDuration: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    stretchExpanded: {
      paddingHorizontal: 12,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 10,
      gap: 10,
    },
    stretchDesc: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    stretchTipBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(114, 221, 225, 0.08)' : 'rgba(47, 175, 192, 0.06)',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    stretchTipText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
  });
