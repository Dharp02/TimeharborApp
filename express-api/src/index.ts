import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDatabase } from './config/sequelize';
import authRoutes from './routes/authRoutes';
import teamRoutes from './routes/teamRoutes';
import timeRoutes from './routes/timeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger, { morganStream } from './utils/logger';
import { startCleanupJob } from './jobs/cleanupTokens';
import { initializeFirebase, initializeAPNs } from './services/notificationService';
import { initializeSocket } from './socket/socketManager';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = Number(process.env.PORT) || 3001;

// Security middleware
app.use(helmet());

// CORS configuration - Allow all origins (for development)
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', { stream: morganStream }));

// Routes
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/time', timeRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/notifications', notificationRoutes);

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

    // Initialize Firebase for push notifications (Android and iOS fallback)
    initializeFirebase();
    
    // Initialize APNs for iOS push notifications (direct APNs)
    initializeAPNs();

    // Start token cleanup job
    startCleanupJob();

    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Start server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📍 Port: ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔍 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`💾 Database: Connected`);
      console.log('═══════════════════════════════════════════════════════════\n');
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
