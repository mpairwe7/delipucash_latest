# Google Play Billing Integration with RevenueCat

This document explains how to set up and configure Google Play Billing for DelipuCash using RevenueCat.

## Overview

The app uses **RevenueCat** to manage in-app purchases and subscriptions. RevenueCat abstracts the complexity of Google Play Billing (Android) and App Store (iOS) into a simple API.

### Why RevenueCat?

1. **Cross-platform** - Single API for iOS and Android
2. **Analytics** - Track revenue, conversions, and churn
3. **Webhooks** - Real-time subscription updates to your backend
4. **Receipt validation** - Server-side validation included
5. **Free tier** - Up to $2.5k/month revenue at no cost

### Mobile Money in Uganda

In Uganda, users can pay using **MTN Mobile Money** and **Airtel Money** through Google Play's **carrier billing** integration. This means:

- ✅ Users see MTN/Airtel as payment options in Google Play
- ✅ No need for direct mobile money integration
- ✅ Google handles all payment processing
- ✅ Compliant with Google Play policies

## Setup Steps

### 1. Create RevenueCat Account

1. Go to [https://app.revenuecat.com](https://app.revenuecat.com)
2. Create a free account
3. Create a new project for "DelipuCash"

### 2. Connect Google Play Console

1. In RevenueCat Dashboard → **Project Settings** → **Apps**
2. Click **"Add App"** → Select **Android**
3. Enter your app's **package name**: `com.yourname.delipucash`
4. Follow the guide to create a service account in Google Play Console
5. Upload the service account JSON to RevenueCat

### 3. Create Products in Google Play Console

Go to **Google Play Console** → **Your App** → **Monetize** → **Products** → **Subscriptions**

Create these subscription products:

| Product ID | Name | Price (Uganda) | Period |
|------------|------|----------------|--------|
| `survey_subscription_weekly` | Weekly Survey Access | UGX 2,000 | 1 week |
| `survey_subscription_monthly` | Monthly Survey Access | UGX 5,000 | 1 month |
| `survey_subscription_yearly` | Yearly Survey Access | UGX 40,000 | 1 year |

**Optional:** Create one-time products:

| Product ID | Name | Price (Uganda) |
|------------|------|----------------|
| `survey_single_access` | Single Survey | UGX 500 |
| `survey_lifetime_access` | Lifetime Access | UGX 100,000 |

### 4. Configure RevenueCat Products

1. In RevenueCat Dashboard → **Products**
2. Click **"Import from Store"** to automatically import products
3. Create an **Offering** called "default" (or "survey_plans")
4. Add packages to the offering:
   - Weekly package → `survey_subscription_weekly`
   - Monthly package → `survey_subscription_monthly`
   - Annual package → `survey_subscription_yearly`

### 5. Create Entitlements

1. In RevenueCat Dashboard → **Entitlements**
2. Create an entitlement called `survey_creator`
3. Attach all subscription products to this entitlement

### 6. Get API Keys

1. In RevenueCat Dashboard → **Project Settings** → **API Keys**
2. Copy the **Android SDK Key** (starts with `goog_`)
3. **Never commit this key to git!**

### 7. Configure the App

Add the API key to your environment:

```bash
# In .env file (create if not exists)
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_your_api_key_here
```

Or update directly in [services/purchasesService.ts](../services/purchasesService.ts):

```typescript
const REVENUECAT_API_KEYS = {
  android: 'goog_your_actual_api_key',
  ios: 'appl_your_ios_api_key', // Add later for iOS
};
```

## File Structure

```
services/
├── purchasesService.ts     # RevenueCat SDK wrapper
├── purchasesHooks.ts       # React Query hooks for purchases
├── index.ts                # Exports all services

components/payment/
├── SubscriptionPackageCard.tsx  # RevenueCat package display

app/
├── _layout.tsx             # RevenueCat initialization
├── subscription.tsx        # New subscription screen (Play Billing)
├── survey-payment.tsx      # Old mobile money screen (kept for reference)
```

## Usage in Components

### Check Subscription Status

```tsx
import { useSurveyCreatorAccess } from '@/services/purchasesHooks';

function MyComponent() {
  const { canCreateSurvey, isLoading } = useSurveyCreatorAccess();
  
  if (!canCreateSurvey) {
    return <SubscriptionPrompt />;
  }
  
  return <SurveyCreator />;
}
```

### Display Subscription Options

```tsx
import { useOfferings, usePurchase } from '@/services/purchasesHooks';

function SubscriptionOptions() {
  const { data: offerings } = useOfferings();
  const { mutate: purchase } = usePurchase();
  
  const packages = offerings?.current?.availablePackages ?? [];
  
  return packages.map(pkg => (
    <Button 
      key={pkg.identifier}
      onPress={() => purchase(pkg)}
    >
      {pkg.product.priceString}
    </Button>
  ));
}
```

### Restore Purchases

```tsx
import { useRestorePurchases } from '@/services/purchasesHooks';

function RestoreButton() {
  const { mutate: restore, isPending } = useRestorePurchases();
  
  return (
    <Button onPress={restore} disabled={isPending}>
      Restore Purchases
    </Button>
  );
}
```

### Link User ID (After Login)

```tsx
import { purchasesService } from '@/services/purchasesService';

// After user logs in
async function onLogin(userId: string) {
  await purchasesService.login(userId);
}

// After user logs out
async function onLogout() {
  await purchasesService.logout();
}
```

## Testing

### Test on Android

1. Build a release APK: `eas build --platform android --profile preview`
2. Install on a real device (not emulator)
3. Use test email in Google Play Console → License Testing

### RevenueCat Sandbox

- Use the RevenueCat SDK in debug mode (enabled by default in DEV)
- All purchases in sandbox mode are free
- Subscriptions renew quickly for testing (5 min instead of 1 week)

## Backend Integration (Optional)

RevenueCat can send webhooks to your backend:

1. In RevenueCat Dashboard → **Project Settings** → **Webhooks**
2. Add your backend URL: `https://your-api.com/webhooks/revenuecat`
3. Handle these events:
   - `INITIAL_PURCHASE` - New subscription
   - `RENEWAL` - Subscription renewed
   - `CANCELLATION` - User cancelled
   - `EXPIRATION` - Subscription expired

## Migration Notes

### Old System (Direct Mobile Money)

The old payment system used:
- [app/survey-payment.tsx](../app/survey-payment.tsx) - UI for MTN/Airtel selection
- [services/surveyPaymentApi.ts](../services/surveyPaymentApi.ts) - Direct mobile money API
- [services/surveyPaymentHooks.ts](../services/surveyPaymentHooks.ts) - React Query hooks

**This violates Google Play policy for digital goods.**

### New System (Google Play Billing)

The new system uses:
- [app/subscription.tsx](../app/subscription.tsx) - Google Play Billing UI
- [services/purchasesService.ts](../services/purchasesService.ts) - RevenueCat SDK
- [services/purchasesHooks.ts](../services/purchasesHooks.ts) - React Query hooks

**Compliant with Google Play policies.**

### What to Do

1. Keep both screens during transition
2. Use `subscription.tsx` for production Play Store release
3. Optionally keep `survey-payment.tsx` for:
   - Web version (no Play Store requirement)
   - Sideloaded APKs (direct distribution)

## Support

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [Google Play Billing Guide](https://developer.android.com/google/play/billing)
- [RevenueCat Discord](https://discord.gg/revenuecat)
