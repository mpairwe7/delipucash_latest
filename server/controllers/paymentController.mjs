import axios from 'axios';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import { publishEvent } from '../lib/eventBus.mjs';
import { createNotificationFromTemplateHelper } from './notificationController.mjs';
import {
  getMtnToken,
  getAirtelToken,
  MTN_BASE_URL,
  AIRTEL_BASE_URL,
  MTN_CURRENCY,
  convertAmount,
  formatMtnPhone,
  formatAirtelPhone,
  getMtnHeaders,
  getAirtelHeaders,
} from '../lib/mtnConfig.mjs';

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
    console.log(`[MTN Disbursement] Processing payment: ${amount} UGX to ${phoneNumber}`);

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
      { headers: getMtnHeaders(token, referenceId, 'disbursement') }
    );

    console.log(`[MTN Disbursement] Transfer initiated: ${referenceId}`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status
    const statusResponse = await axios.get(
      `${MTN_BASE_URL}/disbursement/v1_0/transfer/${referenceId}`,
      { headers: getMtnHeaders(token, null, 'disbursement') }
    );

    const status = statusResponse.data.status;
    console.log(`[MTN Disbursement] Status: ${status}`);

    if (status === 'SUCCESSFUL') {
      return { success: true, reference: referenceId };
    } else {
      return { success: false, reference: referenceId };
    }
  } catch (error) {
    console.error('[MTN Disbursement] Error:', error.response?.data || error.message);
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
    console.log(`[Airtel Disbursement] Processing payment: ${amount} UGX to ${phoneNumber}`);

    const token = await getAirtelToken();
    const referenceId = uuidv4();
    const formattedPhone = formatAirtelPhone(phoneNumber);

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/standard/v1/disbursements/`,
      {
        payee: {
          msisdn: formattedPhone,
        },
        reference: referenceId,
        pin: process.env.AIRTEL_PIN || '1234',
        transaction: {
          amount: amount,
          id: referenceId,
        },
      },
      { headers: getAirtelHeaders(token) }
    );

    console.log(`[Airtel Disbursement] Response:`, response.data);

    const status = response.data.status?.response_code || response.data.data?.transaction?.status;

    if (status === 'DP00800001001' || status === 'SUCCESS' || status === 'SUCCESSFUL') {
      return { success: true, reference: referenceId };
    } else {
      return { success: false, reference: referenceId };
    }
  } catch (error) {
    console.error('[Airtel Disbursement] Error:', error.response?.data || error.message);
    return { success: false, reference: null };
  }
};

// MTN Collection (Request to Pay)
const initiateMtnCollection = async (token, amount, phoneNumber, referenceId) => {
  try {
    const apiAmount = convertAmount(amount);
    console.log(`Initiating MTN collection for ${apiAmount} ${MTN_CURRENCY} from ${phoneNumber}`);

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
      { headers: getMtnHeaders(token, referenceId, 'collection') }
    );

    console.log('MTN Collection Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('MTN Collection Error:', error.response?.data || error.message);
    throw new Error(`MTN Collection failed: ${error.response?.data?.message || error.message}`);
  }
};

// MTN Disbursement (Transfer)
const initiateMtnDisbursement = async (token, amount, phoneNumber, referenceId) => {
  try {
    const apiAmount = convertAmount(amount);
    console.log(`Initiating MTN disbursement of ${apiAmount} ${MTN_CURRENCY} to ${phoneNumber}`);

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
      { headers: getMtnHeaders(token, referenceId, 'disbursement') }
    );

    console.log('MTN Disbursement Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('MTN Disbursement Error:', error.response?.data || error.message);
    throw new Error(`MTN Disbursement failed: ${error.response?.data?.message || error.message}`);
  }
};

// Airtel Collection (Payment)
const initiateAirtelCollection = async (token, amount, phoneNumber, referenceId) => {
  try {
    console.log(`Initiating Airtel collection for ${amount} UGX from ${phoneNumber}`);

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
      {
        reference: referenceId,
        subscriber: {
          country: 'UG',
          currency: 'UGX',
          msisdn: phoneNumber,
        },
        transaction: {
          amount: amount,
          country: 'UG',
          currency: 'UGX',
          id: referenceId,
        },
      },
      { headers: getAirtelHeaders(token) }
    );

    console.log('Airtel Collection Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Airtel Collection Error:', error.response?.data || error.message);
    throw new Error(`Airtel Collection failed: ${error.response?.data?.message || error.message}`);
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
 * @returns {Promise<{success: boolean, referenceId: string}>}
 */
export const processMtnCollection = async ({ amount, phoneNumber, referenceId }) => {
  try {
    console.log(`[MTN Collection] Processing request-to-pay: ${amount} UGX from ${phoneNumber}`);

    const formattedPhone = formatMtnPhone(phoneNumber);
    const refId = referenceId || uuidv4();
    const token = await getMtnToken('collection');

    await initiateMtnCollection(token, amount, formattedPhone, refId);

    // Wait for initial processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status with retries (max 10 attempts, 3s apart)
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const statusResponse = await axios.get(
          `${MTN_BASE_URL}/collection/v1_0/requesttopay/${refId}`,
          { headers: getMtnHeaders(token, null, 'collection') }
        );

        const status = statusResponse.data.status;
        console.log(`[MTN Collection] Attempt ${attempt}: status = ${status}`);

        if (status === 'SUCCESSFUL') {
          return { success: true, referenceId: refId };
        } else if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT') {
          return { success: false, referenceId: refId };
        }
        // Still PENDING — wait and retry
        if (attempt < 10) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        console.error(`[MTN Collection] Status check attempt ${attempt} failed:`, err.message);
        if (attempt < 10) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // Timed out
    return { success: false, referenceId: refId };
  } catch (error) {
    console.error('[MTN Collection] Error:', error.message);
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
 * @returns {Promise<{success: boolean, referenceId: string}>}
 */
export const processAirtelCollection = async ({ amount, phoneNumber, referenceId }) => {
  try {
    console.log(`[Airtel Collection] Processing payment: ${amount} UGX from ${phoneNumber}`);

    const formattedPhone = formatAirtelPhone(phoneNumber);
    const refId = referenceId || uuidv4();
    const token = await getAirtelToken();

    await initiateAirtelCollection(token, amount, formattedPhone, refId);

    // Wait for initial processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status with retries
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const statusResponse = await axios.get(
          `${AIRTEL_BASE_URL}/standard/v1/payments/${refId}`,
          { headers: getAirtelHeaders(token) }
        );

        const status = statusResponse.data.status || statusResponse.data.data?.status;
        console.log(`[Airtel Collection] Attempt ${attempt}: status = ${status}`);

        if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
          return { success: true, referenceId: refId };
        } else if (status === 'FAILED') {
          return { success: false, referenceId: refId };
        }
        if (attempt < 10) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        console.error(`[Airtel Collection] Status check attempt ${attempt} failed:`, err.message);
        if (attempt < 10) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    return { success: false, referenceId: refId };
  } catch (error) {
    console.error('[Airtel Collection] Error:', error.message);
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
      { headers: getMtnHeaders(token, null, 'collection') }
    );
    const status = response.data.status;
    if (status === 'SUCCESSFUL') return 'SUCCESSFUL';
    if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT') return 'FAILED';
    return 'PENDING';
  } catch (error) {
    console.error('[MTN Collection] Status check error:', error.message);
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
      { headers: getAirtelHeaders(token) }
    );
    const status = response.data.status || response.data.data?.status;
    if (status === 'SUCCESSFUL' || status === 'SUCCESS') return 'SUCCESSFUL';
    if (status === 'FAILED') return 'FAILED';
    return 'PENDING';
  } catch (error) {
    console.error('[Airtel Collection] Status check error:', error.message);
    return 'PENDING';
  }
};

// Airtel Disbursement (Payout)
const initiateAirtelDisbursement = async (token, amount, phoneNumber, referenceId) => {
  try {
    console.log(`Initiating Airtel disbursement of ${amount} UGX to ${phoneNumber}`);

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/standard/v1/disbursements/`,
      {
        payee: {
          msisdn: phoneNumber,
        },
        reference: referenceId,
        pin: process.env.AIRTEL_PIN || '1234',
        transaction: {
          amount: amount,
          id: referenceId,
        },
      },
      { headers: getAirtelHeaders(token) }
    );

    console.log('Airtel Disbursement Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Airtel Disbursement Error:', error.response?.data || error.message);
    throw new Error(`Airtel Disbursement failed: ${error.response?.data?.message || error.message}`);
  }
};

// Terminal MTN/Airtel statuses that should NOT be retried
const TERMINAL_FAILURE_STATUSES = new Set(['FAILED', 'REJECTED', 'TIMEOUT']);

// Helper function to check payment status with retry mechanism
const checkPaymentStatusWithRetry = async (referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType = 'collection') => {
  const maxAttempts = 10;
  const delayBetweenAttempts = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`${operationType} status check attempt ${attempt}/${maxAttempts} for reference: ${referenceId}`);

      const payment = await checkPaymentStatusAndSave(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType);

      if (payment) {
        // Terminal failure — stop retrying immediately
        if (payment._terminalFailure) {
          console.log(`${operationType} terminal failure on attempt ${attempt}: ${payment.status}`);
          throw new Error(`${operationType} failed: ${payment.status}`);
        }
        console.log(`${operationType} successful on attempt ${attempt}`);
        return payment;
      }

      // null = still PENDING, wait before next attempt
      if (attempt < maxAttempts) {
        console.log(`${operationType} still pending, waiting ${delayBetweenAttempts}ms before next check...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    } catch (error) {
      console.error(`${operationType} status check attempt ${attempt} failed:`, error.message);

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

    console.log(`Checking MTN ${operationType} status for reference: ${referenceId}`);

    statusResponse = await axios.get(endpoint, {
      headers: getMtnHeaders(token, null, product),
    });

    console.log(`MTN ${operationType} Status Response:`, statusResponse.data);
  } else if (provider === 'AIRTEL') {
    const endpoint = operationType === 'disbursement'
      ? `${AIRTEL_BASE_URL}/standard/v1/disbursements/${referenceId}`
      : `${AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`;

    statusResponse = await axios.get(endpoint, {
      headers: getAirtelHeaders(token),
    });
  }

  const paymentStatus = statusResponse.data.status || statusResponse.data.data?.status;

  // --- SUCCESS ---
  if (paymentStatus === 'SUCCESSFUL' || paymentStatus === 'SUCCESS') {
    const transactionId = provider === 'MTN'
      ? statusResponse.data.financialTransactionId
      : statusResponse.data.transaction?.id || statusResponse.data.data?.transaction?.id;

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
      console.log('Payment saved to database:', payment);

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
    console.log(`${operationType} terminal failure with status: ${paymentStatus}`);

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
        console.error('Failed to save FAILED payment record:', saveErr.message);
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
  console.log(`${operationType} still pending with status: ${paymentStatus}`);
  return null;
};

// Initiate Payment
export const initiatePayment = asyncHandler(async (req, res) => {
  console.log('Incoming request: POST /api/payments/initiate');
  console.log('Received Payment Initiation Request:', req.body);

  const { amount, phoneNumber, provider, subscriptionType, userId } = req.body;

  if (!amount || !phoneNumber || !provider || !subscriptionType || !userId) {
    throw new Error('Missing required fields in the request body');
  }

  try {
    const referenceId = uuidv4();
    console.log('Generated reference ID:', referenceId);

    if (provider === 'MTN') {
      const token = await getMtnToken('collection');
      const finalAmount = convertAmount(amount);
      const formattedPhoneNumber = formatMtnPhone(phoneNumber);

      console.log(`Using amount: ${finalAmount} ${MTN_CURRENCY} (converted from ${amount} UGX)`);

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

      console.log('MTN Request Details:');
      console.log('URL:', `${MTN_BASE_URL}/collection/v1_0/requesttopay`);
      console.log('Body:', requestBody);
      console.log('Formatted phone number:', formattedPhoneNumber);

      if (!finalAmount || finalAmount <= 0) {
        throw new Error('Invalid amount: Amount must be greater than 0');
      }
      if (!formattedPhoneNumber || formattedPhoneNumber.length < 10) {
        throw new Error('Invalid phone number format');
      }

      await axios.post(
        `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
        requestBody,
        { headers: requestHeaders }
      );

      console.log('MTN RequestToPay initiated');

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

      await axios.post(
        `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
        {
          reference: referenceId,
          subscriber: {
            country: 'UG',
            currency: 'UGX',
            msisdn: phoneNumber,
          },
          transaction: {
            amount: amount,
            country: 'UG',
            currency: 'UGX',
            id: referenceId,
          },
        },
        { headers: getAirtelHeaders(token) }
      );

      console.log('Airtel Payment initiated');

      const payment = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId);
      res.status(200).json({ message: 'Payment initiated and saved successfully', payment });
    } else {
      throw new Error('Invalid payment provider');
    }
  } catch (error) {
    console.error('Error initiating payment:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to initiate payment', error: error.response?.data || error.message });
  }
});

// Handle Callback
export const handleCallback = asyncHandler(async (req, res) => {
  const { transactionId, status, provider } = req.body;
  console.log('Received Callback:', req.body);

  const payment = await prisma.payment.update({
    where: { id: transactionId },
    data: { status },
  });

  if (payment.userId) {
    publishEvent(payment.userId, 'payment.status', {
      paymentId: payment.id,
      status,
      amount: payment.amount,
      provider: payment.provider,
    }).catch(() => {});

    const tpl = status === 'SUCCESSFUL' ? 'PAYMENT_SUCCESS' : status === 'FAILED' ? 'PAYMENT_FAILED' : 'PAYMENT_PENDING';
    createNotificationFromTemplateHelper(payment.userId, tpl, { amount: payment.amount }).catch(() => {});
  }

  res.status(200).json({ message: 'Callback handled', payment });
});

// Initiate Disbursement (Reward Payment)
export const initiateDisbursement = asyncHandler(async (req, res) => {
  console.log('Incoming request: POST /api/payments/disburse');
  console.log('Received Disbursement Request:', req.body);

  const { amount, phoneNumber, provider, userId, reason = 'Reward payment' } = req.body;

  if (!amount || !phoneNumber || !provider || !userId) {
    throw new Error('Missing required fields in the request body');
  }

  try {
    const referenceId = uuidv4();

    if (provider === 'MTN') {
      const token = await getMtnToken('disbursement');
      await initiateMtnDisbursement(token, amount, phoneNumber, referenceId);
      const result = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, null, userId, 'disbursement');
      res.status(200).json({ message: 'MTN disbursement initiated successfully', result });
    } else if (provider === 'AIRTEL') {
      const token = await getAirtelToken();
      await initiateAirtelDisbursement(token, amount, phoneNumber, referenceId);
      const result = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, null, userId, 'disbursement');
      res.status(200).json({ message: 'Airtel disbursement initiated successfully', result });
    } else {
      throw new Error('Invalid payment provider');
    }
  } catch (error) {
    console.error('Error initiating disbursement:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to initiate disbursement', error: error.response?.data || error.message });
  }
});

export const getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Received Payment History Request:', req.params);

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ payments });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update Payment Status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;
    console.log('Received Update Payment Status Request:', req.params, req.body);

    if (!["PENDING", "SUCCESS", "FAILED"].includes(status)) {
      return res.status(400).json({ message: "Invalid payment status." });
    }

    const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) {
      return res.status(404).json({ message: "Payment not found." });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });

    return res.json({
      message: `Payment status updated to ${status}!`,
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
