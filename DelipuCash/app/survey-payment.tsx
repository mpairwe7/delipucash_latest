/**
 * Survey Payment Screen — DEPRECATED
 *
 * This screen previously handled direct mobile money payments for survey subscriptions.
 * All subscription purchases are now handled through Google Play Billing via RevenueCat
 * (see /subscription screen). This file redirects to the new subscription screen.
 *
 * Google Play policy requires digital goods to be purchased through Google Play Billing.
 * In Uganda, users can pay with MTN/Airtel Mobile Money through Google Play's
 * carrier billing integration.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function SurveyPaymentRedirect() {
  return <Redirect href="/(tabs)/surveys-new" />;
}

