import cron from 'node-cron';
import { Op } from 'sequelize';
import RefreshToken from '../models/RefreshToken';
import logger from '../utils/logger';

/**
 * Schedule a job to clean up expired refresh tokens
 * Runs every day at midnight (00:00)
 */
export const startCleanupJob = () => {
  logger.info('Initializing token cleanup job...');
  
  // Schedule task to run at 00:00 every day
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running scheduled cleanup of expired refresh tokens...');
    
    try {
      const result = await RefreshToken.destroy({
        where: {
          expires_at: {
            [Op.lt]: new Date()
          }
        }
      });
      
      if (result > 0) {
        logger.info(`Cleanup complete. Removed ${result} expired refresh tokens.`);
      } else {
        logger.info('Cleanup complete. No expired tokens found.');
      }
    } catch (error) {
      logger.error('Error running token cleanup job:', error);
    }
  });
  
  logger.info('Token cleanup job scheduled (runs daily at 00:00).');
};
