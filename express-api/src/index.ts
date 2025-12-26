import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDatabase } from './config/sequelize';
import authRoutes from './routes/authRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger, { morganStream } from './utils/logger';
import { startCleanupJob } from './jobs/cleanupTokens';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting for auth endpoints (more lenient for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 1000, // 1000 in dev, 20 in production
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for /auth/me endpoint in development
    if (process.env.NODE_ENV !== 'production' && req.path === '/me') {
      return true;
    }
    return false;
  }
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', { stream: morganStream }));

// Routes
app.use('/auth', authLimiter, authRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Timeharbor API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start token cleanup job
    startCleanupJob();

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
