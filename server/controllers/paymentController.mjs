import crypto from 'crypto';
import axios from 'axios';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import { publishEvent } from '../lib/eventBus.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import { createPaymentLogger, maskPhone } from '../lib/paymentLogger.mjs';
import { validateCollectionAmount, validateDisbursementAmount } from '../lib/amountLimits.mjs';

// MTN config
import {
  getMtnToken,
  MTN_BASE_URL,
  MTN_CURRENCY,
  convertAmount,
  formatMtnPhone,
  getMtnHeaders,
} from '../lib/mtnConfig.mjs';

// Airtel config
import {
  getAirtelToken,
  AIRTEL_BASE_URL,
  formatAirtelPhone,
  getAirtelHeaders,
  classifyAirtelStatus,
  pollAirtelStatus,
} from '../lib/airtelConfig.mjs';

const log = createPaymentLogger('payment');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Provider API request timeout (30 seconds — generous enough for slow networks)
const PROVIDER_TIMEOUT_MS = 30_000;

// Terminal MTN/Airtel statuses that should NOT be retried
const TERMINAL_FAILURE_STATUSES = new Set(['FAILED', 'REJECTED', 'TIMEOUT']);

// ============================================================================
// INTERNAL INITIATION HELPERS
// ============================================================================

// MTN Collection (Request to Pay)
const initiateMtnCollection = async (token, amount, phoneNumber, referenceId) => {
  try {
    const apiAmount = convertAmount(amount);
    log.info('Initiating MTN collection', { amount: apiAmount, currency: MTN_CURRENCY, phone: maskPhone(phoneNumber) });

    const response = await axios.post(
      `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: apiAmount.toString(),
        currency: MTN_CURRENCY,
        externalId: referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: 'Payment for DelipuCash subscription',
        payeeNote: 'Thank you for your payment',
      },
      { headers: getMtnHeaders(token, referenceId, 'collection'), timeout: PROVIDER_TIMEOUT_MS }
    );

    log.debug('MTN collection response', { data: response.data });
    return response.data;
  } catch (error) {
    log.error('MTN collection error', { status: error.response?.status, message: error.message });
    throw new Error(`MTN Collection failed: ${error.response?.data?.message || error.message}`);
  }
};

// MTN Disbursement (Transfer)
const initiateMtnDisbursement = async (token, amount, phoneNumber, referenceId) => {
  try {
    const apiAmount = convertAmount(amount);
    log.info('Initiating MTN disbursement', { amount: apiAmount, currency: MTN_CURRENCY, phone: maskPhone(phoneNumber) });

    const response = await axios.post(
      `${MTN_BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount: apiAmount.toString(),
        currency: MTN_CURRENCY,
        externalId: referenceId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: 'DelipuCash reward payment',
        payeeNote: 'Your reward payment from DelipuCash',
      },
      { headers: getMtnHeaders(token, referenceId, 'disbursement'), timeout: PROVIDER_TIMEOUT_MS }
    );

    log.debug('MTN disbursement response', { data: response.data });
    return response.data;
  } catch (error) {
    log.error('MTN disbursement error', { status: error.response?.status, message: error.message });
    throw new Error(`MTN Disbursement failed: ${error.response?.data?.message || error.message}`);
  }
};

const AIRTEL_CALLBACK_URL = process.env.AIRTEL_CALLBACK_URL || '';

// Airtel Collection (Payment)
const initiateAirtelCollection = async (token, amount, phoneNumber, referenceId) => {
  try {
    const formattedPhone = formatAirtelPhone(phoneNumber);
    log.info('Initiating Airtel collection', { amount, phone: maskPhone(formattedPhone) });

    const body = {
      reference: referenceId,
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: formattedPhone,
      },
      transaction: {
        amount: String(amount),
        country: 'UG',
        currency: 'UGX',
        id: referenceId,
      },
    };

    // Include callback URL when configured (production)
    if (AIRTEL_CALLBACK_URL) {
      body.transaction.callback_url = AIRTEL_CALLBACK_URL;
    }

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
      body,
      { headers: getAirtelHeaders(token), timeout: PROVIDER_TIMEOUT_MS }
    );

    return response.data;
  } catch (error) {
    log.error('Airtel collection error', { status: error.response?.status, message: error.message });
    throw new Error(`Airtel Collection failed: ${error.response?.data?.message || error.message}`);
  }
};

// Airtel Disbursement (Payout)
const initiateAirtelDisbursement = async (token, amount, phoneNumber, referenceId) => {
  try {
    const formattedPhone = formatAirtelPhone(phoneNumber);
    log.info('Initiating Airtel disbursement', { amount, phone: maskPhone(formattedPhone) });

    if (!process.env.AIRTEL_PIN) {
      throw new Error('AIRTEL_PIN environment variable is required for disbursements');
    }

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/standard/v1/disbursements/`,
      {
        payee: {
          msisdn: formattedPhone,
          country: 'UG',
          currency: 'UGX',
        },
        reference: referenceId,
        pin: process.env.AIRTEL_PIN,
        transaction: {
          amount: String(amount),
          country: 'UG',
          currency: 'UGX',
          id: referenceId,
        },
      },
      { headers: getAirtelHeaders(token), timeout: PROVIDER_TIMEOUT_MS }
    );

    log.debug('Airtel disbursement response', { data: response.data });
    return response.data;
  } catch (error) {
    log.error('Airtel disbursement error', { status: error.response?.status, message: error.message });
    throw new Error(`Airtel Disbursement failed: ${error.response?.data?.message || error.message}`);
  }
};

// ============================================================================
// EXPORTED PAYMENT PROCESSING FUNCTIONS FOR AUTOMATIC DISBURSEMENTS
// These are called from rewardQuestionController for instant reward payouts
// ============================================================================

/**
 * Process MTN Mobile Money disbursement
 * Used for automatic reward payouts to winners
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in UGX
 * @param {string} params.phoneNumber - Recipient phone number
 * @param {string} params.userId - User ID or email
 * @param {string} params.reason - Payment reason/description
 * @returns {Promise<{success: boolean, reference: string|null}>}
 */
export const processMtnPayment = async ({ amount, phoneNumber, userId, reason }) => {
  try {
    validateDisbursementAmount(amount, 'MTN');
    log.info('Processing MTN disbursement', { amount, phone: maskPhone(phoneNumber), userId });

    const token = await getMtnToken('disbursement');
    const referenceId = uuidv4();
    const formattedPhone = formatMtnPhone(phoneNumber);
    const apiAmount = convertAmount(amount);

    await axios.post(
      `${MTN_BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount: apiAmount.toString(),
        currency: MTN_CURRENCY,
        externalId: referenceId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone,
        },
        payerMessage: reason || 'DelipuCash reward payment',
        payeeNote: 'Your reward from DelipuCash',
      },
      { headers: getMtnHeaders(token, referenceId, 'disbursement'), timeout: PROVIDER_TIMEOUT_MS }
    );

    log.info('MTN disbursement transfer initiated', { referenceId });

    // Poll status with retries (max 10 attempts, 3s apart)
    await wait(3000);

    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const statusResponse = await axios.get(
          `${MTN_BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
          { headers: getMtnHeaders(token, null, 'disbursement'), timeout: PROVIDER_TIMEOUT_MS }
        );

        const status = statusResponse.data.status;
        log.info('MTN disbursement poll', { attempt, status, referenceId });

        if (status === 'SUCCESSFUL') {
          return { success: true, reference: referenceId };
        }
        if (TERMINAL_FAILURE_STATUSES.has(status)) {
          return { success: false, reference: referenceId };
        }
      } catch (err) {
        log.error('MTN disbursement status check failed', { attempt, message: err.message });
      }

      if (attempt < 10) await wait(3000);
    }

    // Exhausted retries — still pending
    return { success: false, reference: referenceId, pending: true };
  } catch (error) {
    log.error('MTN disbursement error', { status: error.response?.status, message: error.message });
    return { success: false, reference: null };
  }
};

/**
 * Process Airtel Money disbursement
 * Used for automatic reward payouts to winners
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in UGX
 * @param {string} params.phoneNumber - Recipient phone number
 * @param {string} params.userId - User ID or email
 * @param {string} params.reason - Payment reason/description
 * @returns {Promise<{success: boolean, reference: string|null}>}
 */
export const processAirtelPayment = async ({ amount, phoneNumber, userId, reason }) => {
  try {
    validateDisbursementAmount(amount, 'AIRTEL');
    log.info('Processing Airtel disbursement', { amount, phone: maskPhone(phoneNumber), userId });

    const token = await getAirtelToken();
    const referenceId = uuidv4();

    // initiateAirtelDisbursement calls formatAirtelPhone internally — skip double format
    await initiateAirtelDisbursement(token, amount, phoneNumber, referenceId);
    await wait(3000);

    const result = await pollAirtelStatus({
      token,
      referenceId,
      operationType: 'disbursement',
      maxAttempts: 15,
      delayMs: 3000,
    });

    if (result.state === 'SUCCESSFUL') return { success: true, reference: referenceId };
    if (result.state === 'FAILED') return { success: false, reference: referenceId };
    return { success: false, reference: referenceId, pending: true };
  } catch (error) {
    log.error('Airtel disbursement error', { status: error.response?.status, message: error.message });
    return { success: false, reference: null };
  }
};

// ============================================================================
// EXPORTED COLLECTION FUNCTIONS FOR SUBSCRIPTION PAYMENTS
// These are called from surveyPaymentController for mobile money subscriptions
// ============================================================================

/**
 * Process MTN Mobile Money collection (Request to Pay)
 * Used for subscription payments — collects money FROM users
 * @param {Object} params - Collection parameters
 * @param {number} params.amount - Amount in UGX
 * @param {string} params.phoneNumber - Payer phone number (will be formatted to 256XXXXXXXXX)
 * @param {string} params.referenceId - Unique reference ID (UUID)
 * @returns {Promise<{success: boolean, pending?: boolean, referenceId: string}>}
 */
export const processMtnCollection = async ({ amount, phoneNumber, referenceId }) => {
  try {
    validateCollectionAmount(amount, 'MTN');
    log.info('Processing MTN collection', { amount, phone: maskPhone(phoneNumber), referenceId });

    const formattedPhone = formatMtnPhone(phoneNumber);
    const refId = referenceId || uuidv4();
    const token = await getMtnToken('collection');

    await initiateMtnCollection(token, amount, formattedPhone, refId);

    // Wait for initial processing
    await wait(3000);

    // Check status with retries (max 10 attempts, 3s apart)
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const statusResponse = await axios.get(
          `${MTN_BASE_URL}/collection/v1_0/requesttopay/${refId}`,
          { headers: getMtnHeaders(token, null, 'collection'), timeout: PROVIDER_TIMEOUT_MS }
        );

        const status = statusResponse.data.status;
        log.info('MTN collection poll', { attempt, status, referenceId: refId });

        if (status === 'SUCCESSFUL') {
          return { success: true, referenceId: refId };
        } else if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT') {
          return { success: false, referenceId: refId };
        }
        // Still PENDING — wait and retry
        if (attempt < 10) {
          await wait(3000);
        }
      } catch (err) {
        log.error('MTN collection status check failed', { attempt, message: err.message });
        if (attempt < 10) {
          await wait(3000);
        }
      }
    }

    // Timed out — keep as pending so frontend polling can continue.
    return { success: false, pending: true, referenceId: refId };
  } catch (error) {
    log.error('MTN collection error', { message: error.message });
    return { success: false, referenceId: referenceId || null };
  }
};

/**
 * Process Airtel Money collection (Payment)
 * Used for subscription payments — collects money FROM users
 * @param {Object} params - Collection parameters
 * @param {number} params.amount - Amount in UGX
 * @param {string} params.phoneNumber - Payer phone number
 * @param {string} params.referenceId - Unique reference ID (UUID)
 * @returns {Promise<{success: boolean, pending?: boolean, referenceId: string}>}
 */
export const processAirtelCollection = async ({ amount, phoneNumber, referenceId }) => {
  try {
    validateCollectionAmount(amount, 'AIRTEL');
    log.info('Processing Airtel collection', { amount, phone: maskPhone(phoneNumber), referenceId });

    const formattedPhone = formatAirtelPhone(phoneNumber);
    const refId = referenceId || uuidv4();
    const token = await getAirtelToken();

    await initiateAirtelCollection(token, amount, formattedPhone, refId);
    await wait(3000);

    const result = await pollAirtelStatus({
      token,
      referenceId: refId,
      operationType: 'collection',
      maxAttempts: 15,
      delayMs: 3000,
    });

    if (result.state === 'SUCCESSFUL') return { success: true, referenceId: refId };
    if (result.state === 'FAILED') return { success: false, referenceId: refId };
    return { success: false, pending: true, referenceId: refId };
  } catch (error) {
    log.error('Airtel collection error', { message: error.message });
    return { success: false, referenceId: referenceId || null };
  }
};

/**
 * Check MTN collection status (single query, no retries)
 * Used to re-check a PENDING payment against the provider API.
 * @param {string} referenceId - The MTN reference/transaction ID
 * @returns {Promise<'PENDING'|'SUCCESSFUL'|'FAILED'>}
 */
export const checkMtnCollectionStatus = async (referenceId) => {
  try {
    const token = await getMtnToken('collection');
    const response = await axios.get(
      `${MTN_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      { headers: getMtnHeaders(token, null, 'collection'), timeout: PROVIDER_TIMEOUT_MS }
    );
    const status = response.data.status;
    if (status === 'SUCCESSFUL') return 'SUCCESSFUL';
    if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT') return 'FAILED';
    return 'PENDING';
  } catch (error) {
    log.error('MTN collection status check error', { message: error.message });
    return 'PENDING'; // Can't determine — treat as still pending
  }
};

/**
 * Check Airtel collection status (single query, no retries)
 * @param {string} referenceId - The Airtel reference/transaction ID
 * @returns {Promise<'PENDING'|'SUCCESSFUL'|'FAILED'>}
 */
export const checkAirtelCollectionStatus = async (referenceId) => {
  try {
    const token = await getAirtelToken();
    const response = await axios.get(
      `${AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`,
      { headers: getAirtelHeaders(token), timeout: PROVIDER_TIMEOUT_MS }
    );
    const parsed = classifyAirtelStatus(response.data);
    if (parsed.state === 'SUCCESSFUL') return 'SUCCESSFUL';
    if (parsed.state === 'FAILED') return 'FAILED';
    return 'PENDING';
  } catch (error) {
    log.error('Airtel collection status check error', { message: error.message });
    return 'PENDING';
  }
};

// ============================================================================
// INTERNAL STATUS CHECK HELPERS (used by legacy route handlers below)
// ============================================================================

// Helper function to check payment status with retry mechanism
const checkPaymentStatusWithRetry = async (referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType = 'collection') => {
  const maxAttempts = 10;
  const delayBetweenAttempts = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.info(`${operationType} status check`, { attempt, maxAttempts, referenceId });

      const payment = await checkPaymentStatusAndSave(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType);

      if (payment) {
        // Terminal failure — stop retrying immediately
        if (payment._terminalFailure) {
          log.warn(`${operationType} terminal failure`, { attempt, status: payment.status, referenceId });
          throw new Error(`${operationType} failed: ${payment.status}`);
        }
        log.info(`${operationType} successful`, { attempt, referenceId });
        return payment;
      }

      // null = still PENDING, wait before next attempt
      if (attempt < maxAttempts) {
        log.debug(`${operationType} still pending, retrying`, { attempt, delayMs: delayBetweenAttempts });
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    } catch (error) {
      log.error(`${operationType} status check attempt failed`, { attempt, message: error.message });

      if (attempt === maxAttempts) {
        throw new Error(`${operationType} failed after ${maxAttempts} attempts: ${error.message}`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
    }
  }

  throw new Error(`${operationType} timeout after ${maxAttempts} attempts`);
};

// Helper function to check payment status and save to database
// Returns: payment object on SUCCESS, null on PENDING, { _terminalFailure } on FAILED/REJECTED/TIMEOUT
const checkPaymentStatusAndSave = async (referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType = 'collection') => {
  let statusResponse;

  if (provider === 'MTN') {
    const product = operationType === 'disbursement' ? 'disbursement' : 'collection';
    const endpoint = operationType === 'disbursement'
      ? `${MTN_BASE_URL}/disbursement/v1_0/transfer/${referenceId}`
      : `${MTN_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`;

    log.info(`Checking MTN ${operationType} status`, { referenceId });

    statusResponse = await axios.get(endpoint, {
      headers: getMtnHeaders(token, null, product),
      timeout: PROVIDER_TIMEOUT_MS,
    });

    log.debug(`MTN ${operationType} status response`, { data: statusResponse.data });
  } else if (provider === 'AIRTEL') {
    const endpoint = operationType === 'disbursement'
      ? `${AIRTEL_BASE_URL}/standard/v1/disbursements/${referenceId}`
      : `${AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`;

    statusResponse = await axios.get(endpoint, {
      headers: getAirtelHeaders(token),
      timeout: PROVIDER_TIMEOUT_MS,
    });
  }

  let paymentStatus;
  let airtelMeta = null;
  if (provider === 'AIRTEL') {
    const parsed = classifyAirtelStatus(statusResponse.data);
    paymentStatus = parsed.state;
    airtelMeta = parsed.meta;
  } else {
    paymentStatus = statusResponse.data.status;
  }

  // --- SUCCESS ---
  if (paymentStatus === 'SUCCESSFUL' || paymentStatus === 'SUCCESS') {
    const transactionId = provider === 'MTN'
      ? statusResponse.data.financialTransactionId
      : airtelMeta?.transactionId || statusResponse.data.transaction?.id || statusResponse.data.data?.transaction?.id || referenceId;

    if (!transactionId) {
      throw new Error('Transaction ID not found in the payment response');
    }

    if (operationType === 'collection') {
      const startDate = new Date();
      const endDate = new Date(startDate);

      if (subscriptionType === 'WEEKLY') {
        endDate.setDate(startDate.getDate() + 7);
      } else if (subscriptionType === 'MONTHLY') {
        endDate.setMonth(startDate.getMonth() + 1);
      } else {
        throw new Error('Invalid subscriptionType');
      }

      const payment = await prisma.payment.create({
        data: {
          phoneNumber,
          amount,
          status: paymentStatus,
          provider,
          TransactionId: transactionId,
          subscriptionType,
          startDate,
          endDate,
          userId,
        },
      });
      log.info('Payment saved to database', { paymentId: payment.id, status: paymentStatus });

      publishEvent(userId, 'payment.status', {
        paymentId: payment.id,
        status: paymentStatus,
        amount,
        provider,
      }).catch(() => {});

      return payment;
    } else {
      return {
        success: true,
        transactionId,
        status: paymentStatus,
        message: 'Disbursement successful',
      };
    }
  }

  // --- TERMINAL FAILURE (FAILED / REJECTED / TIMEOUT) ---
  if (TERMINAL_FAILURE_STATUSES.has(paymentStatus)) {
    log.warn(`${operationType} terminal failure`, { status: paymentStatus, referenceId });

    // Save failed record for audit trail (collection only)
    if (operationType === 'collection' && subscriptionType) {
      try {
        await prisma.payment.create({
          data: {
            phoneNumber,
            amount,
            status: 'FAILED',
            provider,
            TransactionId: referenceId,
            subscriptionType,
            startDate: new Date(),
            endDate: new Date(),
            userId,
          },
        });
      } catch (saveErr) {
        log.error('Failed to save FAILED payment record', { message: saveErr.message });
      }
    }

    // Notify user of failure via SSE
    publishEvent(userId, 'payment.status', {
      paymentId: referenceId,
      status: 'FAILED',
      amount,
      provider,
    }).catch(() => {});

    return { _terminalFailure: true, status: paymentStatus };
  }

  // --- PENDING / UNKNOWN — signal "keep polling" ---
  log.debug(`${operationType} still pending`, { status: paymentStatus, referenceId });
  return null;
};

// ============================================================================
// ROUTE HANDLERS (legacy — used by paymentRoutes.mjs)
// ============================================================================

// Initiate Payment
export const initiatePayment = asyncHandler(async (req, res) => {
  const { amount, phoneNumber, provider, subscriptionType } = req.body;
  // Use authenticated user ID — never trust client-supplied userId
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!amount || !phoneNumber || !provider || !subscriptionType) {
    return res.status(400).json({ message: 'Missing required fields: amount, phoneNumber, provider, subscriptionType' });
  }

  log.info('Initiating collection via route', { provider, userId, subscriptionType });

  try {
    const referenceId = uuidv4();

    if (provider === 'MTN') {
      const token = await getMtnToken('collection');
      const finalAmount = convertAmount(amount);
      const formattedPhoneNumber = formatMtnPhone(phoneNumber);

      const requestBody = {
        amount: finalAmount.toString(),
        currency: MTN_CURRENCY,
        externalId: referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: formattedPhoneNumber,
        },
        payerMessage: 'Payment for service',
        payeeNote: 'Thank you for your payment',
      };

      const requestHeaders = getMtnHeaders(token, referenceId, 'collection');

      if (!finalAmount || finalAmount <= 0) {
        throw new Error('Invalid amount: Amount must be greater than 0');
      }
      if (!formattedPhoneNumber || formattedPhoneNumber.length < 10) {
        throw new Error('Invalid phone number format');
      }

      await axios.post(
        `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
        requestBody,
        { headers: requestHeaders, timeout: PROVIDER_TIMEOUT_MS }
      );

      log.info('MTN RequestToPay initiated', { referenceId });

      // Wait for a short period to allow the payment to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const payment = await checkPaymentStatusAndSave(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId);

      if (payment?._terminalFailure) {
        return res.status(400).json({ message: `Payment failed: ${payment.status}` });
      }
      if (!payment) {
        return res.status(202).json({ message: 'Payment still pending', referenceId });
      }

      res.status(200).json({ message: 'Payment initiated and saved successfully', payment });
    } else if (provider === 'AIRTEL') {
      const token = await getAirtelToken();
      const formattedPhoneNumber = formatAirtelPhone(phoneNumber);

      await axios.post(
        `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
        {
          reference: referenceId,
          subscriber: {
            country: 'UG',
            currency: 'UGX',
            msisdn: formattedPhoneNumber,
          },
          transaction: {
            amount: String(amount),
            country: 'UG',
            currency: 'UGX',
            id: referenceId,
          },
        },
        { headers: getAirtelHeaders(token), timeout: PROVIDER_TIMEOUT_MS }
      );

      log.info('Airtel Payment initiated', { referenceId });

      const payment = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId);
      res.status(200).json({ message: 'Payment initiated and saved successfully', payment });
    } else {
      throw new Error('Invalid payment provider');
    }
  } catch (error) {
    log.error('Error initiating payment', { status: error.response?.status, message: error.message });
    res.status(500).json({ message: 'Failed to initiate payment', error: error.response?.data || error.message });
  }
});

// ---------------------------------------------------------------------------
// Callback signature verification
// ---------------------------------------------------------------------------

const CALLBACK_SECRET = process.env.CALLBACK_SECRET || '';

/**
 * Verify HMAC-SHA256 signature on provider callback requests.
 * Expects `x-callback-signature` and `x-callback-timestamp` headers.
 * Rejects replays older than 5 minutes.
 */
const verifyCallbackSignature = (req) => {
  if (!CALLBACK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      log.error('CALLBACK_SECRET not configured in production — rejecting callback');
      return false;
    }
    log.warn('CALLBACK_SECRET not configured — skipping signature verification (dev only)');
    return true;
  }

  const signature = req.headers['x-callback-signature'];
  const timestamp = req.headers['x-callback-timestamp'];

  if (!signature || !timestamp) return false;

  // Reject replays older than 5 minutes
  const age = Math.abs(Date.now() - Number(timestamp));
  if (age > 5 * 60 * 1000) return false;

  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expected = crypto
    .createHmac('sha256', CALLBACK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
};

// Handle Callback (from MTN/Airtel provider webhooks)
export const handleCallback = asyncHandler(async (req, res) => {
  // Verify callback authenticity
  if (!verifyCallbackSignature(req)) {
    log.warn('Callback rejected — invalid or missing signature');
    return res.status(401).json({ error: 'Invalid callback signature' });
  }

  const { transactionId, status, provider } = req.body;
  log.info('Callback received', { transactionId, status, provider });

  // Validate status is an allowed value (prevent injection of arbitrary statuses)
  const ALLOWED_STATUSES = ['PENDING', 'SUCCESSFUL', 'FAILED'];
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid payment status' });
  }

  // Look up the existing payment by provider transaction reference (not PK)
  const existing = await prisma.payment.findUnique({ where: { TransactionId: transactionId } });
  if (!existing) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Prevent invalid state transitions (e.g., SUCCESSFUL → PENDING)
  if (existing.status === 'SUCCESSFUL' || existing.status === 'FAILED') {
    log.info('Callback ignored — payment already terminal', { paymentId: existing.id, status: existing.status });
    return res.status(200).json({ message: 'Already resolved', payment: existing });
  }

  // Re-query provider API to verify the callback claim before updating DB
  let verifiedStatus = status;
  try {
    if (provider === 'MTN' && existing.TransactionId) {
      verifiedStatus = await checkMtnCollectionStatus(existing.TransactionId);
    } else if (provider === 'AIRTEL' && existing.TransactionId) {
      verifiedStatus = await checkAirtelCollectionStatus(existing.TransactionId);
    }
  } catch (err) {
    log.error('Provider re-query failed', { paymentId: existing.id, message: err.message });
    // Fall through with callback-reported status if re-query fails
  }

  const payment = await prisma.payment.update({
    where: { id: existing.id },
    data: { status: verifiedStatus },
  });

  if (payment.userId) {
    publishEvent(payment.userId, 'payment.status', {
      paymentId: payment.id,
      status: verifiedStatus,
      amount: payment.amount,
      provider: payment.provider,
    }).catch(() => {});

    const tpl = verifiedStatus === 'SUCCESSFUL' ? 'PAYMENT_SUCCESS' : verifiedStatus === 'FAILED' ? 'PAYMENT_FAILED' : 'PAYMENT_PENDING';
    createNotificationFromTemplateHelper(payment.userId, tpl, { amount: payment.amount }).catch(() => {});
  }

  res.status(200).json({ message: 'Callback handled', payment });
});

// Initiate Disbursement (Reward Payment) — Admin-only
export const initiateDisbursement = asyncHandler(async (req, res) => {
  const { amount, phoneNumber, provider, reason = 'Reward payment' } = req.body;
  // Use authenticated user ID from JWT — admin-only route
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (!amount || !phoneNumber || !provider) {
    return res.status(400).json({ message: 'Missing required fields: amount, phoneNumber, provider' });
  }

  log.info('Admin initiating disbursement', { userId, provider });

  try {
    const referenceId = uuidv4();

    if (provider === 'MTN') {
      const formattedPhone = formatMtnPhone(phoneNumber);
      const token = await getMtnToken('disbursement');
      await initiateMtnDisbursement(token, amount, formattedPhone, referenceId);
      const result = await checkPaymentStatusWithRetry(referenceId, provider, token, formattedPhone, amount, null, userId, 'disbursement');
      res.status(200).json({ message: 'MTN disbursement initiated successfully', result });
    } else if (provider === 'AIRTEL') {
      const formattedPhone = formatAirtelPhone(phoneNumber);
      const token = await getAirtelToken();
      // initiateAirtelDisbursement calls formatAirtelPhone internally — skip double format
    await initiateAirtelDisbursement(token, amount, phoneNumber, referenceId);
      const result = await checkPaymentStatusWithRetry(referenceId, provider, token, formattedPhone, amount, null, userId, 'disbursement');
      res.status(200).json({ message: 'Airtel disbursement initiated successfully', result });
    } else {
      throw new Error('Invalid payment provider');
    }
  } catch (error) {
    log.error('Error initiating disbursement', { status: error.response?.status, message: error.message });
    res.status(500).json({ message: 'Failed to initiate disbursement', error: error.response?.data || error.message });
  }
});

export const getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Authorization: users can only view their own history; admins can view any
    if (userId !== req.user?.id) {
      const requestingUser = await prisma.appUser.findUnique({
        where: { id: req.user?.id },
        select: { role: true },
      });
      if (!requestingUser || !['ADMIN', 'MODERATOR'].includes(requestingUser.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ payments });
  } catch (error) {
    log.error('Error fetching payment history', { message: error.message });
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Update Payment Status — Admin-only
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'SUCCESSFUL', 'FAILED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid payment status. Allowed: PENDING, SUCCESSFUL, FAILED' });
    }

    const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    // Prevent invalid state transitions
    if (existing.status === 'SUCCESSFUL' && status !== 'SUCCESSFUL') {
      return res.status(409).json({ message: 'Cannot modify a SUCCESSFUL payment.' });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });

    log.info('Admin updated payment status', { adminId: req.user?.id, paymentId, status });

    return res.json({
      message: `Payment status updated to ${status}!`,
      payment: updatedPayment,
    });
  } catch (error) {
    log.error('Error updating payment status', { message: error.message });
    res.status(500).json({ message: 'Internal server error.' });
  }
};
