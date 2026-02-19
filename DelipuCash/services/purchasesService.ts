/**
 * RevenueCat Purchases Service
 * 
 * Handles in-app purchases and subscriptions via RevenueCat.
 * RevenueCat manages Google Play Billing (Android) and App Store (iOS).
 * 
 * IMPORTANT: In Uganda, users can pay with MTN/Airtel Mobile Money through
 * Google Play's carrier billing integration - no direct mobile money needed.
 * 
 * Setup Required:
 * 1. Create RevenueCat account at https://app.revenuecat.com
 * 2. Create a project and get API keys
 * 3. Connect Google Play Console to RevenueCat
 * 4. Create products in Google Play Console
 * 5. Add products to RevenueCat Offerings
 * 
 * @module services/purchasesService
 */

import { Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PurchasesError,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * RevenueCat API Keys
 * 
 * Get these from RevenueCat Dashboard:
 * https://app.revenuecat.com/projects/[your-project]/api-keys
 * 
 * IMPORTANT: Never commit real API keys to git.
 * Use environment variables in production.
 */
const REVENUECAT_API_KEYS = {
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'your_android_api_key',
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'your_ios_api_key',
};

/**
 * Entitlement identifiers
 * These must match what you configure in RevenueCat Dashboard
 */
export const ENTITLEMENTS = {
  SURVEY_CREATOR: 'survey_creator', // Access to create surveys
  PREMIUM: 'premium', // Premium features
  VIDEO_PREMIUM: 'video_premium', // Extended video upload (>40MB) and livestream (>5min)
} as const;

/**
 * Product identifiers
 * These must match products in Google Play Console / App Store Connect
 */
export const PRODUCTS = {
  // Subscription products
  SURVEY_DAILY: 'survey_subscription_daily',
  SURVEY_WEEKLY: 'survey_subscription_weekly',
  SURVEY_MONTHLY: 'survey_subscription_monthly',
  SURVEY_QUARTERLY: 'survey_subscription_quarterly',
  SURVEY_HALF_YEARLY: 'survey_subscription_half_yearly',
  SURVEY_YEARLY: 'survey_subscription_yearly',
  
  // One-time purchases
  SURVEY_SINGLE: 'survey_single_access',
  SURVEY_LIFETIME: 'survey_lifetime_access',

  // Video premium products
  VIDEO_PREMIUM_WEEKLY: 'video_premium_weekly',
  VIDEO_PREMIUM_MONTHLY: 'video_premium_monthly',
  VIDEO_UPLOAD_SINGLE: 'video_upload_single', // Single large upload (up to 500MB)
  VIDEO_LIVESTREAM_EXTENDED: 'video_livestream_extended', // Single extended livestream session
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionInfo {
  isActive: boolean;
  willRenew: boolean;
  expirationDate: Date | null;
  productId: string | null;
  entitlements: string[];
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
  errorCode?: PURCHASES_ERROR_CODE;
  userCancelled?: boolean;
}

export interface OfferingsResult {
  current: PurchasesOffering | null;
  all: Record<string, PurchasesOffering>;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class PurchasesService {
  private isInitialized = false;

  /**
   * Initialize RevenueCat SDK
   * Call this once on app startup (e.g., in _layout.tsx)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Purchases] Already initialized');
      return;
    }

    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.ios 
      : REVENUECAT_API_KEYS.android;

    if (apiKey === 'your_android_api_key' || apiKey === 'your_ios_api_key') {
      console.warn('[Purchases] RevenueCat API key not configured. Using mock mode.');
      return;
    }

    try {
      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure RevenueCat
      await Purchases.configure({ apiKey });
      
      this.isInitialized = true;
      console.log('[Purchases] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[Purchases] Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Check if SDK is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Identify user (call after login)
   * This syncs the user's purchases across devices
   */
  async login(userId: string): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[Purchases] User logged in:', userId);
      return customerInfo;
    } catch (error) {
      console.error('[Purchases] Login failed:', error);
      throw error;
    }
  }

  /**
   * Log out user (call on sign out)
   */
  async logout(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      const customerInfo = await Purchases.logOut();
      console.log('[Purchases] User logged out');
      return customerInfo;
    } catch (error) {
      console.error('[Purchases] Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get available offerings (subscription plans)
   */
  async getOfferings(): Promise<OfferingsResult> {
    if (!this.isInitialized) {
      console.warn('[Purchases] Not initialized, returning empty offerings');
      return { current: null, all: {} };
    }

    try {
      const offerings = await Purchases.getOfferings();
      console.log('[Purchases] Fetched offerings:', Object.keys(offerings.all));
      
      return {
        current: offerings.current,
        all: offerings.all,
      };
    } catch (error) {
      console.error('[Purchases] Failed to get offerings:', error);
      throw error;
    }
  }

  /**
   * Get customer info (current subscription status)
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[Purchases] Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has an active subscription
   */
  async checkSubscription(): Promise<SubscriptionInfo> {
    if (!this.isInitialized) {
      return {
        isActive: false,
        willRenew: false,
        expirationDate: null,
        productId: null,
        entitlements: [],
      };
    }

    try {
      const customerInfo = await this.getCustomerInfo();
      const surveyEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.SURVEY_CREATOR];
      
      return {
        isActive: Boolean(surveyEntitlement?.isActive),
        willRenew: surveyEntitlement?.willRenew ?? false,
        expirationDate: surveyEntitlement?.expirationDate 
          ? new Date(surveyEntitlement.expirationDate) 
          : null,
        productId: surveyEntitlement?.productIdentifier ?? null,
        entitlements: Object.keys(customerInfo.entitlements.active),
      };
    } catch (error) {
      console.error('[Purchases] Failed to check subscription:', error);
      throw error;
    }
  }

  /**
   * Purchase a package (subscription or one-time)
   * 
   * This triggers the native Google Play / App Store purchase flow.
   * In Uganda, users will see MTN/Airtel Mobile Money as payment options
   * through Google Play's carrier billing.
   */
  async purchasePackage(packageToBuy: PurchasesPackage): Promise<PurchaseResult> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      
      console.log('[Purchases] Purchase successful:', packageToBuy.identifier);
      
      return {
        success: true,
        customerInfo,
      };
    } catch (error) {
      const purchaseError = error as PurchasesError;
      
      // User cancelled the purchase
      if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        console.log('[Purchases] Purchase cancelled by user');
        return {
          success: false,
          userCancelled: true,
          error: 'Purchase cancelled',
          errorCode: purchaseError.code,
        };
      }

      // Payment pending (e.g., waiting for mobile money confirmation)
      if (purchaseError.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        console.log('[Purchases] Payment pending');
        return {
          success: false,
          error: 'Payment is pending. Please complete the transaction on your phone.',
          errorCode: purchaseError.code,
        };
      }

      console.error('[Purchases] Purchase failed:', purchaseError);
      return {
        success: false,
        error: purchaseError.message,
        errorCode: purchaseError.code,
      };
    }
  }

  /**
   * Restore purchases (for users who reinstall or switch devices)
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('[Purchases] Purchases restored');
      return customerInfo;
    } catch (error) {
      console.error('[Purchases] Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Add listener for customer info changes
   * Useful for real-time subscription status updates
   *
   * Returns an unsubscribe function that removes the native listener.
   * RevenueCat v9: addCustomerInfoUpdateListener returns a remove function.
   */
  addCustomerInfoListener(
    callback: (customerInfo: CustomerInfo) => void
  ): () => void {
    if (!this.isInitialized) {
      return () => {};
    }

    const removeListener = Purchases.addCustomerInfoUpdateListener(callback);

    // RevenueCat v9 returns an unsubscribe function
    return typeof removeListener === 'function' ? removeListener : () => {};
  }

  /**
   * Show Google Play in-app messages (grace period, billing issues, etc.)
   * Call this on app foreground or when entering subscription screens.
   * Google Play renders native UI prompting users to fix payment issues.
   */
  async showInAppMessages(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // RevenueCat v9: showInAppMessages shows pending billing messages
      // from Google Play (e.g., grace period payment fix prompts)
      if (typeof Purchases.showInAppMessages === 'function') {
        await Purchases.showInAppMessages();
      }
    } catch (error) {
      // Non-critical — log and continue
      console.warn('[Purchases] Failed to show in-app messages:', error);
    }
  }

  /**
   * Sync purchases with RevenueCat
   * Call this if you suspect purchases are out of sync
   */
  async syncPurchases(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      await Purchases.syncPurchases();
      console.log('[Purchases] Purchases synced');
    } catch (error) {
      console.error('[Purchases] Failed to sync purchases:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const purchasesService = new PurchasesService();

// Export for direct imports
export default purchasesService;
