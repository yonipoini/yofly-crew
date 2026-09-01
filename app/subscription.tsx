import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/theme';
import { SubscriptionService } from '../src/services/SubscriptionService';
import { useAuth } from '../src/context/AuthContext';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    void SubscriptionService.init(user?.id);
  }, [user?.id]);

  const handleStartTrial = async () => {
    setIsProcessing(true);
    try {
      const result = await SubscriptionService.purchasePlan(selectedPlan);
      if (result.success) {
        Alert.alert(
          'YoFly Pro Activated!',
          'Welcome to YoFly Pro! Your 14-day free trial is active and all features are unlocked.',
          [{ text: 'Get Started', onPress: () => router.back() }]
        );
      } else if (result.error && result.error !== 'Purchase cancelled.') {
        Alert.alert('Subscription Info', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unable to complete purchase.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsProcessing(true);
    try {
      const result = await SubscriptionService.restorePurchases();
      if (result.success && result.isPro) {
        Alert.alert('Purchases Restored', 'Your YoFly Pro subscription status has been verified.');
      } else {
        Alert.alert('No Active Subscription', 'No prior active YoFly Pro subscription was found for this Apple ID / Google account.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message || 'Unable to restore purchases.');
    } finally {
      setIsProcessing(false);
    }
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

        <TouchableOpacity
          style={[styles.actionButton, isProcessing && { opacity: 0.7 }]}
          onPress={handleStartTrial}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.actionButtonText}>Start 14-Day Free Trial</Text>
          )}
        </TouchableOpacity>

        <View style={styles.disclaimerContainer}>
          <Text style={[styles.disclaimerText, { color: theme.colors.textMuted }]}>
            • <Text style={{ fontWeight: '700' }}>14-Day Free Trial:</Text> New subscribers receive a 14-day free trial. You will not be charged if you cancel at least 24 hours before the trial ends.{'\n'}
            • <Text style={{ fontWeight: '700' }}>Auto-Renewal:</Text> Payment will be charged to your Apple ID / Google Play account at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period ($9.99/month for Monthly Plan or $99.00/year for Annual Plan).{'\n'}
            • <Text style={{ fontWeight: '700' }}>Manage Subscriptions:</Text> You can manage or cancel your subscription at any time in your device Account Settings after purchase.
          </Text>
        </View>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestorePurchases}>
            <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}> • </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://yoflycrew.com/terms.html')}>
            <Text style={[styles.footerText, { color: '#00E5FF', textDecorationLine: 'underline' }]}>Terms of Use (EULA)</Text>
          </TouchableOpacity>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}> • </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://yoflycrew.com/privacy.html')}>
            <Text style={[styles.footerText, { color: '#00E5FF', textDecorationLine: 'underline' }]}>Privacy Policy</Text>
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
  disclaimerContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
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
