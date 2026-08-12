import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/theme';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const handleStartTrial = () => {
    Alert.alert(
      'YoFly Pro Free Trial',
      `Starting your 14-Day Free Trial on the ${
        selectedPlan === 'monthly' ? 'Monthly ($9.99/mo)' : 'Annual ($99.00/yr)'
      } plan. You won't be charged until after day 14.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const handleRestorePurchases = () => {
    Alert.alert('Purchases Restored', 'Your YoFly Pro subscription status has been verified.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>YoFly Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeContainer}>
          <Image
            source={require('../assets/yofly_crew_pro_elite_badge_clean.png')}
            style={styles.badgeImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>Unlock Everything with YoFly Pro</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Built exclusively for flight crew. 14 days free, cancel any time.
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#00E5FF22' }]}>
              <Ionicons name="flash" size={20} color="#00E5FF" />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Live Flight & Delay Alerts</Text>
              <Text style={[styles.featureSub, { color: theme.colors.textMuted }]}>
                Slamkicker alerts, FAA delay spikes, gate shifts & TSA wait times.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#FF3B3022' }]}>
              <Ionicons name="alert-circle" size={20} color="#FF3B30" />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Emergency Beacon SOS Safety</Text>
              <Text style={[styles.featureSub, { color: theme.colors.textMuted }]}>
                Instant emergency contact SMS dispatch & automated safety check-ins.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#AF52DE22' }]}>
              <Ionicons name="mic" size={20} color="#AF52DE" />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Unlimited Voice Translator & Dictation</Text>
              <Text style={[styles.featureSub, { color: theme.colors.textMuted }]}>
                Hands-free voice notes & real-time crew dictation across languages.
              </Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#34C75922' }]}>
              <Ionicons name="pricetags" size={20} color="#34C759" />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Unlimited Marketplace & Crashpads</Text>
              <Text style={[styles.featureSub, { color: theme.colors.textMuted }]}>
                Post gear, luggage, & crashpad listings with no restrictions.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.plansContainer}>
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'monthly' && { borderColor: '#00E5FF', backgroundColor: '#00E5FF10' },
            ]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={styles.planHeader}>
              <Text style={[styles.planTitle, { color: theme.colors.text }]}>Monthly Plan</Text>
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>14-DAY FREE TRIAL</Text>
              </View>
            </View>
            <Text style={[styles.planPrice, { color: '#00E5FF' }]}>$9.99 <Text style={styles.periodText}>/ month</Text></Text>
            <Text style={[styles.planSub, { color: theme.colors.textMuted }]}>Cancel anytime during 14-day trial.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'annual' && { borderColor: '#00E5FF', backgroundColor: '#00E5FF10' },
            ]}
            onPress={() => setSelectedPlan('annual')}
          >
            <View style={styles.planHeader}>
              <Text style={[styles.planTitle, { color: theme.colors.text }]}>Annual Plan</Text>
              <View style={[styles.trialBadge, { backgroundColor: '#34C759' }]}>
                <Text style={styles.trialBadgeText}>SAVE 17% • 14 DAYS FREE</Text>
              </View>
            </View>
            <Text style={[styles.planPrice, { color: '#00E5FF' }]}>$99.00 <Text style={styles.periodText}>/ year</Text></Text>
            <Text style={[styles.planSub, { color: theme.colors.textMuted }]}>Equal to $8.25/month billed annually.</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={handleStartTrial}>
          <Text style={styles.actionButtonText}>Start 14-Day Free Trial</Text>
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestorePurchases}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}> • </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://yoflycrew.com/privacy.html')}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}> • </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://yoflycrew.com/privacy.html')}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  badgeContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  badgeImage: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresList: {
    marginBottom: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  featureSub: {
    fontSize: 13,
    marginTop: 2,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffffff20',
    backgroundColor: '#ffffff08',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  trialBadge: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trialBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '900',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  planSub: {
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#00E5FF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
