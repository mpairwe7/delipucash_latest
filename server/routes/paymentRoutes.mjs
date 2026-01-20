import express from 'express';
import {
  initiatePayment,  
  handleCallback,
  getPaymentHistory,
  updatePaymentStatus,
  initiateDisbursement,
  // checkRequestToPayStatus
} from '../controllers/paymentController.mjs';

const router = express.Router();

// Payment routes
router.post('/initiate', initiatePayment);
router.post('/disburse', initiateDisbursement);
//router.get('/status/:transactionId/:provider', checkRequestToPayStatus);
router.post('/callback', handleCallback);
// Get Payment History for a User
router.get("/users/:userId/payments", getPaymentHistory);
// Update Payment Status
router.put("/payments/:paymentId/status", updatePaymentStatus);

export default router;
