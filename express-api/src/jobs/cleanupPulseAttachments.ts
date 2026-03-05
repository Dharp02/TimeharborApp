import cron from 'node-cron';
import { Op } from 'sequelize';
import PulseAttachment from '../models/PulseAttachment';
import logger from '../utils/logger';

/**
 * Job 1 — Expire orphaned pending rows (runs daily at 01:00).
 *
 * When a user taps "Record a Short" but never actually records,
 * the row stays pending until its expiresAt passes. This job marks
 * those rows as 'expired' so the UI stops showing a spinner.
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
 * Job 2 — Fallback: export for future webhook support.
 *
 * When Pulse Vault adds an outbound webhook, the webhook handler will call
 * the same update logic as this cron, and this cron becomes a safety net
 * running less frequently. Keeping it here means zero refactoring needed
 * when the webhook lands.
 *
 * For now: log that the primary update path is the webhook (once built).
 * The cron runs every 15 minutes and is a no-op stub — ready to be filled
 * with a Pulse Vault status poll when that API endpoint is confirmed.
 */
const startFallbackPollJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    // TODO: Once Pulse Vault exposes GET /api/shorts?draftId=<uuid>,
    // fetch each pending (non-expired) row and update to 'uploaded' if the
    // video is ready. This replaces the need for the webhook in cases where
    // webhook delivery fails.
    //
    // const pending = await PulseAttachment.findAll({
    //   where: { status: 'pending', expiresAt: { [Op.gt]: new Date() } },
    // });
    // for (const row of pending) {
    //   const short = await fetchShortByDraftId(row.draftId);
    //   if (short?.watchUrl) {
    //     await row.update({ status: 'uploaded', watchUrl: short.watchUrl,
    //       thumbnailUrl: short.thumbnailUrl, title: short.title,
    //       uploadedAt: new Date() });
    //   }
    // }
  });

  logger.info('Pulse fallback poll job scheduled (every 15 min — stub until Pulse Vault status API confirmed).');
};

export const startPulseCleanupJobs = () => {
  startExpiryJob();
  startFallbackPollJob();
};
