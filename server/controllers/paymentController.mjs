import axios from 'axios';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import { publishEvent } from '../lib/eventBus.mjs';

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

    // Format phone number
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = `256${phoneNumber.substring(1)}`;
    } else if (!phoneNumber.startsWith('256') && !phoneNumber.startsWith('+256')) {
      formattedPhone = `256${phoneNumber}`;
    }
    formattedPhone = formattedPhone.replace('+', '');

    // Convert UGX to EUR for sandbox (MTN sandbox uses EUR)
    const eurAmount = Math.max(1, Math.round(amount / 4000));

    const response = await axios.post(
      'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer',
      {
        amount: eurAmount.toString(),
        currency: 'EUR',
        externalId: referenceId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: formattedPhone,
        },
        payerMessage: reason || 'DelipuCash reward payment',
        payeeNote: 'Your reward from DelipuCash',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[MTN Disbursement] Transfer initiated: ${referenceId}`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status
    const statusResponse = await axios.get(
      `https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY,
        },
      }
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

    // Format phone number (remove leading 0 or +)
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('+256')) {
      formattedPhone = phoneNumber.substring(4);
    } else if (phoneNumber.startsWith('256')) {
      formattedPhone = phoneNumber.substring(3);
    }

    const response = await axios.post(
      'https://openapiuat.airtel.africa/standard/v1/disbursements/',
      {
        payee: {
          msisdn: formattedPhone,
        },
        reference: referenceId,
        pin: process.env.AIRTEL_PIN || '1234', // Sandbox PIN
        transaction: {
          amount: amount,
          id: referenceId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': 'UG',
          'X-Currency': 'UGX',
          'Content-Type': 'application/json',
        },
      }
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

// Environment validation
const validateEnvironmentVariables = () => {
  const requiredVars = {
    MTN: ['MTN_USER_ID', 'MTN_API_KEY', 'MTN_PRIMARY_KEY'],
    AIRTEL: ['AIRTEL_CLIENT_ID', 'AIRTEL_CLIENT_SECRET']
  };

  const missing = [];
  
  // Check MTN variables
  requiredVars.MTN.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check Airtel variables
  requiredVars.AIRTEL.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Initialize environment validation
validateEnvironmentVariables();

// Helper function to generate MTN API token for a specific product
// MTN requires separate tokens per product (Collection vs Disbursement)
const getMtnToken = async (product = 'collection') => {
  const userId = process.env.MTN_USER_ID;
  const apiKey = process.env.MTN_API_KEY;
  const subscriptionKey = product === 'disbursement'
    ? (process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY)
    : process.env.MTN_PRIMARY_KEY;

  if (!userId || !apiKey || !subscriptionKey) {
    throw new Error(`Missing required MTN API credentials for ${product}`);
  }

  try {
    const credentials = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    const response = await axios.post(
      `https://sandbox.momodeveloper.mtn.com/${product}/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    console.log(`MTN ${product} token acquired: ${access_token.substring(0, 50)}...`);
    console.log(`Token expires in: ${expires_in} seconds`);

    return access_token;
  } catch (error) {
    console.error(`MTN ${product} Token Error:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`MTN API Error (${product}): ${error.response?.data?.message || error.message}`);
  }
};

// Helper function to generate Airtel API token
// Airtel Africa OpenAPI requires application/json (not x-www-form-urlencoded)
const getAirtelToken = async () => {
  try {
    const response = await axios.post(
      'https://openapiuat.airtel.africa/auth/oauth2/token',
      {
        client_id: process.env.AIRTEL_CLIENT_ID,
        client_secret: process.env.AIRTEL_CLIENT_SECRET,
        grant_type: 'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
        },
      }
    );
    console.log('Airtel Token Response:', response.data);
    return response.data.access_token;
  } catch (error) {
    console.error('Airtel Token Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`Airtel API Error: ${error.response?.data?.message || error.message}`);
  }
};

// MTN Collection (Request to Pay)
const initiateMtnCollection = async (token, amount, phoneNumber, referenceId) => {
  try {
    console.log(`Initiating MTN collection for ${amount} EUR to ${phoneNumber}`);
    
    // Convert UGX to EUR for sandbox (MTN sandbox requires EUR)
    const eurAmount = Math.max(1, Math.round(amount / 4000));

    const response = await axios.post(
      'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay',
      {
        amount: eurAmount.toString(),
        currency: 'EUR',
        externalId: referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: 'Payment for DelipuCash subscription',
        payeeNote: 'Thank you for your payment',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': process.env.MTN_PRIMARY_KEY,
        },
      }
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
    console.log(`Initiating MTN disbursement of ${amount} EUR to ${phoneNumber}`);
    
    // Convert UGX to EUR for sandbox (MTN sandbox requires EUR)
    const eurAmount = Math.max(1, Math.round(amount / 4000));

    const response = await axios.post(
      'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer',
      {
        amount: eurAmount.toString(),
        currency: 'EUR',
        externalId: referenceId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: 'DelipuCash reward payment',
        payeeNote: 'Your reward payment from DelipuCash',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY,
        },
      }
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
    console.log(`Initiating Airtel collection for ${amount} UGX to ${phoneNumber}`);
    
    const response = await axios.post(
      'https://openapiuat.airtel.africa/merchant/v1/payments/',
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
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': 'UG',
          'X-Currency': 'UGX',
        },
      }
    );

    console.log('Airtel Collection Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Airtel Collection Error:', error.response?.data || error.message);
    throw new Error(`Airtel Collection failed: ${error.response?.data?.message || error.message}`);
  }
};

// Airtel Disbursement (Payout)
// Uses /standard/v1/disbursements/ with payee/pin/reference/transaction format
const initiateAirtelDisbursement = async (token, amount, phoneNumber, referenceId) => {
  try {
    console.log(`Initiating Airtel disbursement of ${amount} UGX to ${phoneNumber}`);

    const response = await axios.post(
      'https://openapiuat.airtel.africa/standard/v1/disbursements/',
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
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': 'UG',
          'X-Currency': 'UGX',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Airtel Disbursement Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Airtel Disbursement Error:', error.response?.data || error.message);
    throw new Error(`Airtel Disbursement failed: ${error.response?.data?.message || error.message}`);
  }
};

// Helper function to check payment status with retry mechanism
const checkPaymentStatusWithRetry = async (referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType = 'collection') => {
  const maxAttempts = 10;
  const delayBetweenAttempts = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`${operationType} status check attempt ${attempt}/${maxAttempts} for reference: ${referenceId}`);
      
      const payment = await checkPaymentStatusAndSave(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType);
      
      if (payment) {
        console.log(`${operationType} successful on attempt ${attempt}`);
        return payment;
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        console.log(`${operationType} still pending, waiting ${delayBetweenAttempts}ms before next check...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    } catch (error) {
      console.error(`${operationType} status check attempt ${attempt} failed:`, error.message);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        headers: error.config?.headers
      });
      
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
const checkPaymentStatusAndSave = async (referenceId, provider, token, phoneNumber, amount, subscriptionType, userId, operationType = 'collection') => {
  let statusResponse;

  if (provider === 'MTN') {
    if (operationType === 'collection') {
      console.log(`Checking MTN collection status for reference: ${referenceId}`);
      console.log(`MTN Collection Status URL: https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`);
      
      statusResponse = await axios.get(
        `https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': 'sandbox',
            'Ocp-Apim-Subscription-Key': process.env.MTN_PRIMARY_KEY,
          },
        }
      );
      
      console.log('MTN Collection Status Response:', statusResponse.data);
    } else if (operationType === 'disbursement') {
      console.log(`Checking MTN disbursement status for reference: ${referenceId}`);
      console.log(`MTN Disbursement Status URL: https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer/${referenceId}`);

      statusResponse = await axios.get(
        `https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': 'sandbox',
            'Ocp-Apim-Subscription-Key': process.env.MTN_DISBURSEMENT_KEY || process.env.MTN_PRIMARY_KEY,
          },
        }
      );

      console.log('MTN Disbursement Status Response:', statusResponse.data);
    }
  } else if (provider === 'AIRTEL') {
    if (operationType === 'collection') {
      statusResponse = await axios.get(
        `https://openapiuat.airtel.africa/standard/v1/payments/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'UG',
            'X-Currency': 'UGX',
          },
        }
      );
    } else if (operationType === 'disbursement') {
      statusResponse = await axios.get(
        `https://openapiuat.airtel.africa/standard/v1/disbursements/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'UG',
            'X-Currency': 'UGX',
          },
        }
      );
    }
  }

  const paymentStatus = statusResponse.data.status || statusResponse.data.data?.status;

  if (paymentStatus === 'SUCCESSFUL' || paymentStatus === 'SUCCESS') {
    const transactionId = provider === 'MTN'
      ? statusResponse.data.financialTransactionId // MTN transaction ID
      : statusResponse.data.transaction?.id || statusResponse.data.data?.transaction?.id; // Airtel transaction ID

    if (!transactionId) {
      throw new Error('Transaction ID not found in the payment response');
    }

    // Calculate startDate and endDate for collection operations
    if (operationType === 'collection') {
      const startDate = new Date(); // Current timestamp
      const endDate = new Date(startDate);

      if (subscriptionType === 'WEEKLY') {
        endDate.setDate(startDate.getDate() + 7); // Add 7 days for WEEKLY
      } else if (subscriptionType === 'MONTHLY') {
        endDate.setMonth(startDate.getMonth() + 1); // Add 1 month for MONTHLY
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
          startDate, // Include startDate
          endDate,   // Include endDate
          userId,    // Include userId
        },
      });
      console.log('Payment saved to database:', payment);

      // SSE: Notify user of payment status change
      publishEvent(userId, 'payment.status', {
        paymentId: payment.id,
        status: paymentStatus,
        amount,
        provider,
      }).catch(() => {});

      return payment;
    } else {
      // For disbursement operations, return success response
      return {
        success: true,
        transactionId,
        status: paymentStatus,
        message: 'Disbursement successful'
      };
    }
  } else {
    console.log(`${operationType} failed with status:`, paymentStatus);
    throw new Error(`${operationType} failed with status: ${paymentStatus}`);
  }
};

// Initiate Payment
export const initiatePayment = asyncHandler(async (req, res) => {
  console.log('Incoming request: POST /api/payments/initiate');
  console.log('Token:', req.headers.authorization);
  console.log('Received Payment Initiation Request:', req.body);

  const { amount, phoneNumber, provider, subscriptionType, userId } = req.body;

  // Validate required fields
  if (!amount || !phoneNumber || !provider || !subscriptionType || !userId) {
    throw new Error('Missing required fields in the request body');
  }

  try {
    let paymentResponse;
    const referenceId = uuidv4();
    
    console.log('Generated reference ID:', referenceId);

    if (provider === 'MTN') {
      const token = await getMtnToken('collection');

      // Convert UGX to EUR for sandbox (MTN sandbox uses EUR)
      const finalAmount = Math.max(1, Math.round(amount / 4000));
      
      console.log(`Using amount: ${finalAmount} EUR (converted from ${amount} UGX)`);

      // Format phone number for MTN (ensure it starts with country code)
      // MTN requires the phone number without the leading 0 and with country code
      let formattedPhoneNumber = phoneNumber;
      if (phoneNumber.startsWith('0')) {
        formattedPhoneNumber = `256${phoneNumber.substring(1)}`;
      } else if (!phoneNumber.startsWith('256')) {
        formattedPhoneNumber = `256${phoneNumber}`;
      }

      const requestBody = {
        amount: finalAmount.toString(),
        currency: 'EUR',
        externalId: referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: formattedPhoneNumber,
        },
        payerMessage: 'Payment for service',
        payeeNote: 'Thank you for your payment',
      };

      const requestHeaders = {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': 'sandbox',
        'Ocp-Apim-Subscription-Key': process.env.MTN_PRIMARY_KEY,
      };

      console.log('MTN Request Details:');
      console.log('URL:', 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay');
      console.log('Headers:', requestHeaders);
      console.log('Body:', requestBody);
      console.log('Formatted phone number:', formattedPhoneNumber);

      // Validate request data
      if (!finalAmount || finalAmount <= 0) {
        throw new Error('Invalid amount: Amount must be greater than 0');
      }
      if (!formattedPhoneNumber || formattedPhoneNumber.length < 10) {
        throw new Error('Invalid phone number format');
      }
      if (!referenceId || referenceId.length < 5) {
        throw new Error('Invalid reference ID');
      }

      paymentResponse = await axios.post(
        'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay',
        requestBody,
        {
          headers: requestHeaders,
        }
      );

      console.log('MTN RequestToPay API Response:', paymentResponse.data);

      // Wait for a short period to allow the payment to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check payment status and save to database
      const payment = await checkPaymentStatusAndSave(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId);
      res.status(200).json({ message: 'Payment initiated and saved successfully', payment });
    } else if (provider === 'AIRTEL') {
      const token = await getAirtelToken();

      paymentResponse = await axios.post(
        'https://openapiuat.airtel.africa/merchant/v1/payments/',
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
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': 'UG',
            'X-Currency': 'UGX',
          },
        }
      );

      console.log('Airtel Payment Response:', paymentResponse.data);

      // Check payment status with retry mechanism
      const payment = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, subscriptionType, userId);
      res.status(200).json({ message: 'Payment initiated and saved successfully', payment });
    } else {
      throw new Error('Invalid payment provider');
    }
  } catch (error) {
    console.error('Error initiating payment:', error.response?.data || error.message);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      requestData: error.config?.data
    });
    res.status(500).json({ message: 'Failed to initiate payment', error: error.response?.data || error.message });
  }
});
// Handle Callback
export const handleCallback = asyncHandler(async (req, res) => {
  const { transactionId, status, provider } = req.body;
  console.log('Received Callback:', req.body);

  // Update payment status in database
  const payment = await prisma.payment.update({
    where: { id: transactionId },
    data: { status },
  });

  // SSE: Notify user of payment callback status
  if (payment.userId) {
    publishEvent(payment.userId, 'payment.status', {
      paymentId: payment.id,
      status,
      amount: payment.amount,
      provider: payment.provider,
    }).catch(() => {});
  }

  res.status(200).json({ message: 'Callback handled', payment });
});

// Initiate Disbursement (Reward Payment)
export const initiateDisbursement = asyncHandler(async (req, res) => {
  console.log('Incoming request: POST /api/payments/disburse');
  console.log('Received Disbursement Request:', req.body);

  const { amount, phoneNumber, provider, userId, reason = 'Reward payment' } = req.body;

  // Validate required fields
  if (!amount || !phoneNumber || !provider || !userId) {
    throw new Error('Missing required fields in the request body');
  }

  try {
    let disbursementResponse;
    const referenceId = uuidv4();

    if (provider === 'MTN') {
      const token = await getMtnToken('disbursement');

      // Use the dedicated disbursement function
      disbursementResponse = await initiateMtnDisbursement(token, amount, phoneNumber, referenceId);

      // Check disbursement status with retry mechanism
      const result = await checkPaymentStatusWithRetry(referenceId, provider, token, phoneNumber, amount, null, userId, 'disbursement');
      res.status(200).json({ message: 'MTN disbursement initiated successfully', result });
    } else if (provider === 'AIRTEL') {
      const token = await getAirtelToken();

      // Use the dedicated disbursement function
      disbursementResponse = await initiateAirtelDisbursement(token, amount, phoneNumber, referenceId);

      // Check disbursement status with retry mechanism
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

    const payments = await prisma.payment.find({ userId }).sort({ createdAt: -1 });

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

    const updatedPayment = await prisma.payment.findByIdAndUpdate(
      paymentId,
      { status },
      { new: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    return res.json({
      message: `Payment status updated to ${status}!`,
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
