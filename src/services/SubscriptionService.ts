import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  restorePurchases as iapRestorePurchases,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  purchaseUpdatedListener,
  purchaseErrorListener,
  isEligibleForIntroOfferIOS,
  type ProductSubscription,
  type ProductSubscriptionIOS,
  type Purchase,
} from 'expo-iap';

export const IAP_PRODUCT_IDS = {
  MONTHLY: 'com.yoflycrew.app.pro',
  ANNUAL: 'com.yoflycrew.app.pro.annual',
  ENTITLEMENT_ID: 'pro_access',
};

const ALL_SUBSCRIPTION_SKUS = [IAP_PRODUCT_IDS.MONTHLY, IAP_PRODUCT_IDS.ANNUAL];

export interface PlanPricingInfo {
  loaded: boolean;
  available: boolean;
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

// Safe defaults: NEVER advertise a free trial unless StoreKit confirms an active free intro offer.
export const DEFAULT_PLAN_DETAILS: PlanDetailsMap = {
  monthly: {
    loaded: false,
    available: false,
    price: 9.99,
    priceString: '$9.99',
    pricePerMonthString: '$9.99',
    hasFreeTrial: false,
    trialTitle: '',
    trialDurationPhrase: '',
  },
  annual: {
    loaded: false,
    available: false,
    price: 99.0,
    priceString: '$99.00',
    pricePerMonthString: '$8.25',
    hasFreeTrial: false,
    trialTitle: '',
    trialDurationPhrase: '',
  },
  savePercent: 17,
};

function formatCurrencyAmount(amount: number, currency?: string | null): string {
  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  } catch {
    // Fall back to USD-style formatting if Intl currency fails
  }
  return `$${amount.toFixed(2)}`;
}

function formatTrialPeriod(
  periodUnitRaw?: string | null,
  numPeriodsRaw?: string | number | null
): { title: string; phrase: string } | null {
  const units = Number(numPeriodsRaw || 0);
  const unit = (periodUnitRaw || '').toUpperCase();
  if (!units || units <= 0) return null;

  if (unit === 'WEEK') {
    const totalDays = units * 7;
    return { title: `${totalDays}-Day`, phrase: `${totalDays}-day` };
  }
  if (unit === 'DAY') {
    return { title: `${units}-Day`, phrase: `${units}-day` };
  }
  if (unit === 'MONTH') {
    return { title: `${units}-Month`, phrase: `${units}-month` };
  }
  if (unit === 'YEAR') {
    return { title: `${units}-Year`, phrase: `${units}-year` };
  }
  return null;
}

function isIOSProduct(product: ProductSubscription): product is ProductSubscriptionIOS {
  return product.platform === 'ios';
}

function buildPlanPricing(
  product: ProductSubscription | undefined,
  fallback: PlanPricingInfo,
  isAnnual: boolean,
  isEligibleForIntro: boolean
): PlanPricingInfo {
  if (!product) {
    return { ...fallback, loaded: true, available: false, hasFreeTrial: false };
  }

  const numericPrice = typeof product.price === 'number' && product.price > 0 ? product.price : fallback.price;
  const displayPrice = product.displayPrice || formatCurrencyAmount(numericPrice, product.currency);
  const pricePerMonthString = isAnnual
    ? formatCurrencyAmount(numericPrice / 12, product.currency)
    : displayPrice;

  let hasFreeTrial = false;
  let trialTitle = '';
  let trialDurationPhrase = '';

  if (isIOSProduct(product) && isEligibleForIntro) {
    // 1. Prefer standardized StoreKit 2 subscriptionOffers (accurate period.value * periodCount)
    const introOffer = product.subscriptionOffers?.find((offer) => {
      const offerType = String((offer as any)?.type || '').toLowerCase();
      const offerMode = String((offer as any)?.paymentMode || '').toLowerCase();
      return (
        (offerType === 'introductory' || offerType === 'intro') &&
        (offerMode === 'free-trial' || offerMode === 'freetrial' || offerMode === 'free_trial')
      );
    });

    if (introOffer && (introOffer as any).period) {
      const offerPeriod = (introOffer as any).period as { unit?: string; value?: number };
      const count = Number((introOffer as any).periodCount || 1);
      const totalUnits = Number(offerPeriod.value || 0) * (count > 0 ? count : 1);
      const period = formatTrialPeriod(offerPeriod.unit, totalUnits);
      if (period) {
        hasFreeTrial = true;
        trialTitle = period.title;
        trialDurationPhrase = period.phrase;
      }
    }

    // 2. Fallback to legacy iOS introductoryPrice* fields if subscriptionOffers is absent
    if (!hasFreeTrial) {
      const paymentMode = String(product.introductoryPricePaymentModeIOS || '').toLowerCase();
      const isFreeTrialMode =
        paymentMode === 'free-trial' ||
        paymentMode === 'freetrial' ||
        paymentMode === 'free_trial';

      if (isFreeTrialMode) {
        const period = formatTrialPeriod(
          product.introductoryPriceSubscriptionPeriodIOS,
          product.introductoryPriceNumberOfPeriodsIOS
        );
        if (period) {
          hasFreeTrial = true;
          trialTitle = period.title;
          trialDurationPhrase = period.phrase;
        }
      }
    }
  }

  return {
    loaded: true,
    available: true,
    price: numericPrice,
    priceString: displayPrice,
    pricePerMonthString,
    hasFreeTrial,
    trialTitle,
    trialDurationPhrase,
  };
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let cachedProducts: ProductSubscription[] = [];

export const SubscriptionService = {
  async init(_userId?: string): Promise<void> {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          await initConnection();
          isInitialized = true;
        }
      } catch (error) {
        console.warn('[SubscriptionService] StoreKit init error:', error);
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  },

  async fetchStoreProducts(): Promise<ProductSubscription[]> {
    await this.init();
    if (!isInitialized) return [];

    try {
      const products = await fetchProducts({
        skus: ALL_SUBSCRIPTION_SKUS,
        type: 'subs',
      });
      const list = Array.isArray(products) ? (products as ProductSubscription[]) : [];
      cachedProducts = list;
      return list;
    } catch (error) {
      console.warn('[SubscriptionService] Error fetching StoreKit products:', error);
      return cachedProducts;
    }
  },

  async getPlanDetails(): Promise<PlanDetailsMap> {
    try {
      const products = await this.fetchStoreProducts();
      const monthlyProduct = products.find((p) => p.id === IAP_PRODUCT_IDS.MONTHLY);
      const annualProduct = products.find((p) => p.id === IAP_PRODUCT_IDS.ANNUAL);

      let isEligibleForIntro = false;
      if (Platform.OS === 'ios') {
        const iosProduct = [monthlyProduct, annualProduct].find(
          (p): p is ProductSubscriptionIOS => Boolean(p && isIOSProduct(p) && p.subscriptionGroupIdIOS)
        );
        if (iosProduct?.subscriptionGroupIdIOS) {
          try {
            isEligibleForIntro = Boolean(
              await isEligibleForIntroOfferIOS(iosProduct.subscriptionGroupIdIOS)
            );
          } catch (eligErr) {
            console.warn('[SubscriptionService] Intro offer eligibility check skipped:', eligErr);
            isEligibleForIntro = false;
          }
        }
      }

      const monthly = buildPlanPricing(
        monthlyProduct,
        DEFAULT_PLAN_DETAILS.monthly,
        false,
        isEligibleForIntro
      );
      const annual = buildPlanPricing(
        annualProduct,
        DEFAULT_PLAN_DETAILS.annual,
        true,
        isEligibleForIntro
      );

      const yearlyMonthlyCost = monthly.price * 12;
      const savePercent =
        yearlyMonthlyCost > 0 && annual.price < yearlyMonthlyCost
          ? Math.round((1 - annual.price / yearlyMonthlyCost) * 100)
          : DEFAULT_PLAN_DETAILS.savePercent;

      return { monthly, annual, savePercent };
    } catch (error) {
      console.warn('[SubscriptionService] Error loading plan details:', error);
      return {
        ...DEFAULT_PLAN_DETAILS,
        monthly: { ...DEFAULT_PLAN_DETAILS.monthly, loaded: true },
        annual: { ...DEFAULT_PLAN_DETAILS.annual, loaded: true },
      };
    }
  },

  async purchasePlan(
    planType: 'monthly' | 'annual'
  ): Promise<{ success: boolean; purchase?: Purchase; error?: string }> {
    await this.init();
    if (!isInitialized) {
      return {
        success: false,
        error: 'Unable to connect to the App Store. Please ensure In-App Purchases are enabled on your device.',
      };
    }

    const targetProductId =
      planType === 'monthly' ? IAP_PRODUCT_IDS.MONTHLY : IAP_PRODUCT_IDS.ANNUAL;

    // Ensure product is loaded from StoreKit before requesting purchase
    let products = cachedProducts;
    if (!products.find((p) => p.id === targetProductId)) {
      products = await this.fetchStoreProducts();
    }
    const targetProduct = products.find((p) => p.id === targetProductId);
    if (!targetProduct) {
      return {
        success: false,
        error: 'This subscription plan is currently unavailable from the App Store. Please try again in a moment.',
      };
    }

    return new Promise((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let updateSub: { remove: () => void } | null = null;
      let errorSub: { remove: () => void } | null = null;

      const finish = (result: { success: boolean; purchase?: Purchase; error?: string }) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        updateSub?.remove();
        errorSub?.remove();
        resolve(result);
      };

      updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
        if (purchase.productId !== targetProductId) return;
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (finishErr) {
          console.warn('[SubscriptionService] finishTransaction warning:', finishErr);
        }
        finish({ success: true, purchase });
      });

      errorSub = purchaseErrorListener((err) => {
        const code = String((err as any)?.code || '').toLowerCase();
        const message = String(err?.message || '');
        const isCancelled =
          code.includes('cancel') || message.toLowerCase().includes('cancel');
        if (isCancelled) {
          finish({ success: false, error: 'Purchase cancelled.' });
          return;
        }
        finish({
          success: false,
          error: message || 'Unable to complete purchase. Please try again.',
        });
      });

      timeoutId = setTimeout(() => {
        finish({
          success: false,
          error: 'The App Store request timed out. Please try again.',
        });
      }, 90_000);

      void requestPurchase({
        request: {
          apple: { sku: targetProductId },
          google: { skus: [targetProductId] },
        },
        type: 'subs',
      }).catch((err: any) => {
        const code = String(err?.code || '').toLowerCase();
        const message = String(err?.message || '');
        if (code.includes('cancel') || message.toLowerCase().includes('cancel')) {
          finish({ success: false, error: 'Purchase cancelled.' });
        } else {
          finish({
            success: false,
            error: message || 'Unable to start App Store purchase.',
          });
        }
      });
    });
  },

  async restorePurchases(): Promise<{ success: boolean; isPro: boolean; error?: string }> {
    try {
      await this.init();
      if (!isInitialized) {
        return { success: false, isPro: false, error: 'Unable to connect to the App Store.' };
      }
      await iapRestorePurchases();
      const active = await getActiveSubscriptions(ALL_SUBSCRIPTION_SKUS);
      const isPro = Array.isArray(active) && active.length > 0;
      return { success: true, isPro };
    } catch (error: any) {
      return {
        success: false,
        isPro: false,
        error: error?.message || 'Restore failed.',
      };
    }
  },

  async checkProStatus(): Promise<boolean> {
    try {
      await this.init();
      if (!isInitialized) return false;
      return Boolean(await hasActiveSubscriptions(ALL_SUBSCRIPTION_SKUS));
    } catch {
      return false;
    }
  },
};
