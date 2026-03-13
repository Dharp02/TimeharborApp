import cron from 'node-cron';
import { Op } from 'sequelize';
import PulseAttachment from '../models/PulseAttachment';
import logger from '../utils/logger';

/**
 * Job 1 — Expire orphaned pending rows (runs daily at 01:00).
 */
const startExpiryJob = () => {
  cron.schedule('0 1 * * *', async () => {
    logger.info('Running Pulse attachment expiry job...');
    try {
      const [count] = await PulseAttachment.update(
        { status: 'expired' },
        {
          where: {
            status: 'pending',
            expiresAt: { [Op.lt]: new Date() },
          },
        }
      );
      if (count > 0) {
        logger.info(`Pulse expiry job: marked ${count} attachment(s) as expired.`);
      } else {
        logger.info('Pulse expiry job: no expired pending attachments found.');
      }
    } catch (error) {
      logger.error('Pulse expiry job error:', error);
    }
  });

  logger.info('Pulse attachment expiry job scheduled (daily at 01:00).');
};

/**
 * Job 2 — Fallback poll stub for future webhook support.
 */
const startFallbackPollJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    // TODO: Once Pulse Vault exposes GET /api/shorts?draftId=<uuid>,
    // fetch each pending (non-expired) row and update to 'uploaded' if the
    // video is ready.
  });

  logger.info('Pulse fallback poll job scheduled (every 15 min — stub until Pulse Vault status API confirmed).');
};

export const startPulseCleanupJobs = () => {
  startExpiryJob();
  startFallbackPollJob();
};
