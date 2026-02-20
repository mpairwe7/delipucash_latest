import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import connectDB from './config/db.mjs';
import { ensureDefaultAdminExists } from './utils/adminInit.mjs';

// Import routes
import authRouter from './routes/auth.route.mjs';
import paymentRoutes from './routes/paymentRoutes.mjs';
import rewardRoutes from './routes/rewardRoutes.mjs';
import questionAttemptRoutes from './routes/questionAttemptRoutes.mjs';
import questionRoutes from './routes/questionRoutes.mjs';
import surveyRoutes from './routes/surveyRoutes.mjs';
import videoRoutes from './routes/videoRoutes.mjs';
import AdRoutes from './routes/AdRoutes.mjs';
import exploreRoutes from './routes/exploreRoutes.mjs';
import rewardQuestionRoutes from './routes/rewardQuestionRoutes.mjs';
import notificationRoutes from './routes/notificationRoutes.mjs';
import userRoutes from './routes/userRoutes.mjs';
import responseRoutes from './routes/responseRoutes.mjs';
import quizRoutes from './routes/quizRoutes.mjs';
import surveySubscriptionRoutes from './routes/surveySubscriptionRoutes.mjs';
import surveyPaymentRoutes from './routes/surveyPaymentRoutes.mjs';
import r2UploadRoutes from './routes/r2UploadRoutes.mjs';
import sseRoutes from './routes/sseRoutes.mjs';
import surveyFileRoutes from './routes/surveyFileRoutes.mjs';
import surveyWebhookRoutes from './routes/surveyWebhookRoutes.mjs';
import surveyTemplateRoutes from './routes/surveyTemplateRoutes.mjs';
import surveyCollabRoutes from './routes/surveyCollabRoutes.mjs';
import surveyImportRoutes from './routes/surveyImportRoutes.mjs';
import configRoutes from './routes/configRoutes.mjs';
import followRoutes from './routes/followRoutes.mjs';
import { resetPasswordRedirect, appleAppSiteAssociation, androidAssetLinks } from './controllers/deepLinkController.mjs';
import { videoOgRedirect } from './controllers/ogController.mjs';

dotenv.config();

console.log('Bootstrapping API server...');

const app = express();

// Database health check on cold start (non-blocking)
// connectDB is the postgres tagged-template client — calling it validates the connection
connectDB`SELECT 1`.catch((err) =>
  console.warn('[DB] Initial health check failed:', err.message)
);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure CORS for production and development
const allowedOrigins = [
  'http://localhost:3000',
  
  'http://localhost:8081',
  'exp://192.168.0.117:8081',
  'https://delipucash-latest.vercel.app',
  'https://sensational-semifreddo-166028.netlify.app',
  process.env.NETLIFY_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    if (req.headers.authorization) {
      console.log('Token present (truncated):', req.headers.authorization.substring(0, 20) + '...');
    }
    next();
  });
}

// Serve static assets (logo fallback for OG images, etc.)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  immutable: true,
}));

// =============================================
// Deep Link & Domain Verification Routes
// These must be top-level (not under /api) for
// Android App Links and iOS Universal Links.
// =============================================
app.get('/reset-password', resetPasswordRedirect);
app.get('/video/:id', videoOgRedirect); // OG meta + smart redirect for shared videos
app.get('/.well-known/apple-app-site-association', appleAppSiteAssociation);
app.get('/.well-known/assetlinks.json', androidAssetLinks);

// API Routes
app.use('/api/rewards', rewardRoutes);
app.use('/api/attempts', questionAttemptRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/auth', authRouter);
app.use('/api/ads', AdRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/reward-questions', rewardQuestionRoutes);
app.use('/api/notifications', notificationRoutes); // Changed to more consistent path
app.use('/api/users', userRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/survey-subscriptions', surveySubscriptionRoutes);
app.use('/api/survey-payments', surveyPaymentRoutes);
app.use('/api/r2', r2UploadRoutes); // Cloudflare R2 storage routes
app.use('/api/surveys', surveyFileRoutes); // Survey file upload routes
app.use('/api/surveys', surveyWebhookRoutes); // Survey webhook routes
app.use('/api/surveys', surveyTemplateRoutes); // Survey template routes
app.use('/api/surveys', surveyCollabRoutes); // Survey collaboration routes
app.use('/api/surveys', surveyImportRoutes); // Survey import preview & samples
app.use('/api/sse', sseRoutes); // Server-Sent Events stream
app.use('/api/config', configRoutes); // App configuration (reward rates, etc.)
app.use('/api/follows', followRoutes); // Creator follow graph + user blocks

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  console.error('Error:', err);
  
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Start server for local development (not on Vercel)
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);

    // Ensure default admin user exists
    await ensureDefaultAdminExists();
  });
} else {
  // For Vercel, ensure admin exists on cold start
  ensureDefaultAdminExists().catch(console.error);
}

// Export the app for Vercel serverless functions
export default app;