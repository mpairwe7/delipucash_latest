import express from 'express';
import { getTransactions, getTransactionSummary } from '../controllers/transactionController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// GET /api/transactions — paginated, filtered transaction list
router.get('/', verifyToken, getTransactions);

// GET /api/transactions/summary — lightweight wallet summary
router.get('/summary', verifyToken, getTransactionSummary);

export default router;
