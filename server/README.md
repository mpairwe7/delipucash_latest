# DelipuCash Backend - Vercel Serverless Deployment

This is the optimized backend API for DelipuCash, configured for deployment on Vercel serverless functions.

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/delipucash-backend)

## 📋 Prerequisites

- Node.js 18.x or higher
- MongoDB database (MongoDB Atlas recommended)
- Vercel account
- Environment variables configured

## 🛠️ Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd server
   yarn install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Generate Prisma client:**
   ```bash
   yarn prisma generate
   ```

4. **Run development server:**
   ```bash
   yarn dev
   ```

## 🌐 Vercel Deployment

### Method 1: Automatic Deployment (Recommended)

1. **Connect your repository to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Vercel will auto-detect the configuration

2. **Set environment variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`

3. **Deploy:**
   - Push to your main branch
   - Vercel will automatically deploy

### Method 2: Manual Deployment

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

## 🔧 Configuration

### Environment Variables

Create these environment variables in Vercel Dashboard:

```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your_jwt_secret_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

### Database Setup

1. **MongoDB Atlas (Recommended):**
   - Create a MongoDB Atlas cluster
   - Whitelist Vercel IPs (or use 0.0.0.0/0 for all IPs)
   - Get connection string and add to `DATABASE_URL`

2. **Push database schema:**
   ```bash
   yarn prisma db push
   ```

## 📁 Project Structure

```
server/
├── api/
│   └── index.js          # Main serverless function
├── routes/               # API routes
├── controllers/          # Route handlers
├── lib/
│   └── prisma.mjs       # Database client (optimized for serverless)
├── config/
│   └── db.mjs           # Database configuration
├── utils/               # Utility functions
├── prisma/
│   └── schema.prisma    # Database schema
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies and scripts
```

## 🔍 API Endpoints

### Health Check
- `GET /` - Root endpoint
- `GET /health` - Comprehensive health check
- `GET /ping` - Simple ping endpoint

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Core Features
- `/api/rewards/*` - Reward management
- `/api/questions/*` - Question management
- `/api/surveys/*` - Survey management
- `/api/payments/*` - Payment processing
- `/api/videos/*` - Video management
- `/api/ads/*` - Advertisement management
- `/api/users/*` - User management
- `/api/notifications/*` - Notification system

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Verify `DATABASE_URL` is correct
   - Check MongoDB Atlas IP whitelist
   - Ensure database exists

2. **CORS Errors:**
   - Add your frontend domain to `FRONTEND_URL`
   - Check CORS configuration in `api/index.js`

3. **Cold Start Delays:**
   - First request may be slow (cold start)
   - Subsequent requests will be faster
   - Consider using Vercel Pro for faster cold starts

4. **Function Timeout:**
   - Vercel has a 30-second timeout for serverless functions
   - Optimize long-running queries
   - Consider background processing for heavy tasks

### Monitoring

- **Vercel Dashboard:** Monitor deployments, errors, and performance
- **Health Check:** Use `/health` endpoint to monitor API status
- **Logs:** Check Vercel function logs for debugging

## 🔒 Security Considerations

- All environment variables are secure in Vercel
- CORS is configured for specific origins
- JWT tokens for authentication
- Input validation on all endpoints
- Rate limiting recommended for production

## 📊 Performance Optimization

- **Prisma Client:** Optimized with singleton pattern for serverless
- **Connection Pooling:** Handled by Prisma
- **Cold Start Optimization:** Minimal imports and lazy loading
- **Caching:** Consider Redis for session management
- **CDN:** Static assets served via Vercel CDN

## 🆘 Support

For deployment issues:
1. Check Vercel function logs
2. Test endpoints with health check
3. Verify all environment variables are set
4. Check database connectivity

## 📝 License

MIT License - see LICENSE file for details
