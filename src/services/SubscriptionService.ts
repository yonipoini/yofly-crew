import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';

// Configuration keys - can be set via env variables or fallback
const REVENUECAT_APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'appl_yoflycrew_placeholder';
const REVENUECAT_GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || 'goog_yoflycrew_placeholder';

export const IAP_PRODUCT_IDS = {
  MONTHLY: 'com.yoflycrew.app.pro',
  ANNUAL: 'com.yoflycrew.app.pro.annual',
  ENTITLEMENT_ID: 'pro_access',
};

let isInitialized = false;

export const SubscriptionService = {
  async init(userId?: string) {
    if (isInitialized) return;

    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: REVENUECAT_APPLE_API_KEY, appUserID: userId });
        isInitialized = true;
      } else if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_GOOGLE_API_KEY, appUserID: userId });
        isInitialized = true;
      }
    } catch (error) {
      console.warn('[SubscriptionService] Init error:', error);
    }
  },

  async getOfferings(): Promise<PurchasesPackage[]> {
    try {
      if (!isInitialized) await this.init();
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        return offerings.current.availablePackages;
      }
    } catch (error) {
      console.warn('[SubscriptionService] Error getting offerings:', error);
    }
    return [];
  },

  async purchasePlan(planType: 'monthly' | 'annual'): Promise<{ success: boolean; customerInfo?: CustomerInfo; error?: string }> {
    try {
      if (!isInitialized) await this.init();

      const targetProductId = planType === 'monthly' ? IAP_PRODUCT_IDS.MONTHLY : IAP_PRODUCT_IDS.ANNUAL;

      // 1. Try purchasing via RevenueCat Offerings package
      try {
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;
        const pkg = planType === 'monthly' ? currentOffering?.monthly : currentOffering?.annual;

        if (pkg) {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const isPro = customerInfo.entitlements.active[IAP_PRODUCT_IDS.ENTITLEMENT_ID] !== undefined ||
                        customerInfo.activeSubscriptions.includes(targetProductId);
          return { success: isPro, customerInfo };
        }
      } catch (offeringErr: any) {
        if (offeringErr.userCancelled) return { success: false, error: 'Purchase cancelled.' };
        console.warn('[SubscriptionService] Offerings lookup failed, trying direct product purchase:', offeringErr);
      }

      // 2. Fallback: Purchase directly via StoreKit product identifier
      const products = await Purchases.getProducts([targetProductId]);
      const product = products.find(p => p.identifier === targetProductId);

      if (product) {
        const { customerInfo } = await Purchases.purchaseStoreProduct(product);
        const isPro = customerInfo.entitlements.active[IAP_PRODUCT_IDS.ENTITLEMENT_ID] !== undefined ||
                      customerInfo.activeSubscriptions.includes(targetProductId);
        return { success: isPro, customerInfo };
      }

      return {
        success: false,
        error: 'Unable to connect to the App Store. Please ensure In-App Purchases are enabled on your device.'
      };
    } catch (error: any) {
      if (error.userCancelled) {
        return { success: false, error: 'Purchase cancelled.' };
      }
      return { success: false, error: error?.message || 'Purchase failed.' };
    }
  },

  async restorePurchases(): Promise<{ success: boolean; isPro: boolean; customerInfo?: CustomerInfo; error?: string }> {
    try {
      if (!isInitialized) await this.init();
      const customerInfo = await Purchases.restorePurchases();
      const isPro = customerInfo.entitlements.active[IAP_PRODUCT_IDS.ENTITLEMENT_ID] !== undefined ||
                    customerInfo.activeSubscriptions.includes(IAP_PRODUCT_IDS.MONTHLY) ||
                    customerInfo.activeSubscriptions.includes(IAP_PRODUCT_IDS.ANNUAL);
      return { success: true, isPro, customerInfo };
    } catch (error: any) {
      return { success: false, isPro: false, error: error?.message || 'Restore failed.' };
    }
  },

  async checkProStatus(): Promise<boolean> {
    try {
      if (!isInitialized) await this.init();
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[IAP_PRODUCT_IDS.ENTITLEMENT_ID] !== undefined ||
             customerInfo.activeSubscriptions.includes(IAP_PRODUCT_IDS.MONTHLY) ||
             customerInfo.activeSubscriptions.includes(IAP_PRODUCT_IDS.ANNUAL);
    } catch (error) {
      return false;
    }
  },
};
