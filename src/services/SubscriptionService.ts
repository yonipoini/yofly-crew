import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  PurchasesStoreProduct,
  PurchasesIntroPrice,
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
} from 'react-native-purchases';

// Configuration keys - can be set via env variables or fallback
const REVENUECAT_APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'appl_yoflycrew_placeholder';
const REVENUECAT_GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || 'goog_yoflycrew_placeholder';

export const IAP_PRODUCT_IDS = {
  MONTHLY: 'com.yoflycrew.app.pro',
  ANNUAL: 'com.yoflycrew.app.pro.annual',
  ENTITLEMENT_ID: 'pro_access',
};

export interface PlanPricingInfo {
  loaded: boolean;
  price: number;
  priceString: string;
  pricePerMonthString: string | null;
  hasFreeTrial: boolean;
  trialTitle: string;
  trialDurationPhrase: string;
}

export interface PlanDetailsMap {
  monthly: PlanPricingInfo;
  annual: PlanPricingInfo;
  savePercent: number;
}

export const DEFAULT_PLAN_DETAILS: PlanDetailsMap = {
  monthly: {
    loaded: false,
    price: 9.99,
    priceString: '$9.99',
    pricePerMonthString: '$9.99',
    hasFreeTrial: true,
    trialTitle: '14-Day',
    trialDurationPhrase: '14-day',
  },
  annual: {
    loaded: false,
    price: 99.0,
    priceString: '$99.00',
    pricePerMonthString: '$8.25',
    hasFreeTrial: true,
    trialTitle: '14-Day',
    trialDurationPhrase: '14-day',
  },
  savePercent: 17,
};

function formatTrialPeriod(introPrice: PurchasesIntroPrice): { title: string; phrase: string } {
  const units = introPrice.periodNumberOfUnits || 0;
  const unit = (introPrice.periodUnit || '').toUpperCase();
  const totalDays =
    unit === 'WEEK' ? units * 7 : unit === 'DAY' ? units : 0;

  if (totalDays > 0) {
    return {
      title: `${totalDays}-Day`,
      phrase: `${totalDays}-day`,
    };
  }
  if (unit === 'MONTH' && units > 0) {
    return {
      title: `${units}-Month`,
      phrase: `${units}-month`,
    };
  }
  return {
    title: '14-Day',
    phrase: '14-day',
  };
}

function buildPlanPricing(
  product: PurchasesStoreProduct | undefined,
  fallback: PlanPricingInfo,
  eligibilityStatus?: INTRO_ELIGIBILITY_STATUS
): PlanPricingInfo {
  if (!product) {
    return fallback;
  }

  const isFreeIntro = product.introPrice != null && product.introPrice.price === 0;
  const isIneligible = eligibilityStatus === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE;
  const hasFreeTrial = isFreeIntro && !isIneligible;
  const trialPeriod =
    hasFreeTrial && product.introPrice
      ? formatTrialPeriod(product.introPrice)
      : { title: fallback.trialTitle, phrase: fallback.trialDurationPhrase };

  return {
    loaded: true,
    price: product.price,
    priceString: product.priceString,
    pricePerMonthString: product.pricePerMonthString || fallback.pricePerMonthString,
    hasFreeTrial,
    trialTitle: trialPeriod.title,
    trialDurationPhrase: trialPeriod.phrase,
  };
}

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

  async getPlanDetails(): Promise<PlanDetailsMap> {
    try {
      if (!isInitialized) await this.init();

      let monthlyProduct: PurchasesStoreProduct | undefined;
      let annualProduct: PurchasesStoreProduct | undefined;

      try {
        const offerings = await Purchases.getOfferings();
        monthlyProduct = offerings.current?.monthly?.product;
        annualProduct = offerings.current?.annual?.product;
      } catch (offeringErr) {
        console.warn('[SubscriptionService] Offerings lookup skipped:', offeringErr);
      }

      if (!monthlyProduct || !annualProduct) {
        const products = await Purchases.getProducts([
          IAP_PRODUCT_IDS.MONTHLY,
          IAP_PRODUCT_IDS.ANNUAL,
        ]);
        monthlyProduct =
          monthlyProduct || products.find((p) => p.identifier === IAP_PRODUCT_IDS.MONTHLY);
        annualProduct =
          annualProduct || products.find((p) => p.identifier === IAP_PRODUCT_IDS.ANNUAL);
      }

      let eligibilityMap: Record<string, { status: INTRO_ELIGIBILITY_STATUS }> = {};
      if (Platform.OS === 'ios') {
        try {
          eligibilityMap = await Purchases.checkTrialOrIntroductoryPriceEligibility([
            IAP_PRODUCT_IDS.MONTHLY,
            IAP_PRODUCT_IDS.ANNUAL,
          ]);
        } catch (eligErr) {
          console.warn('[SubscriptionService] Intro eligibility check skipped:', eligErr);
        }
      }

      const monthly = buildPlanPricing(
        monthlyProduct,
        DEFAULT_PLAN_DETAILS.monthly,
        eligibilityMap[IAP_PRODUCT_IDS.MONTHLY]?.status
      );
      const annual = buildPlanPricing(
        annualProduct,
        DEFAULT_PLAN_DETAILS.annual,
        eligibilityMap[IAP_PRODUCT_IDS.ANNUAL]?.status
      );

      const yearlyMonthlyCost = monthly.price * 12;
      const savePercent =
        yearlyMonthlyCost > 0 && annual.price < yearlyMonthlyCost
          ? Math.round((1 - annual.price / yearlyMonthlyCost) * 100)
          : DEFAULT_PLAN_DETAILS.savePercent;

      return { monthly, annual, savePercent };
    } catch (error) {
      console.warn('[SubscriptionService] Error loading plan details:', error);
      return DEFAULT_PLAN_DETAILS;
    }
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
