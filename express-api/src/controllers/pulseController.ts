import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';
import { Member, Ticket } from '../models';
import PulseAttachment from '../models/PulseAttachment';
import { requestDeeplink } from '../services/pulseVaultService';
import logger from '../utils/logger';

// How long a pending recording session lives before the cron expires it
const PENDING_TTL_HOURS = 24;

/**
 * POST /teams/:teamId/tickets/:ticketId/pulse
 * Generates a draftId, calls Pulse Vault for a deeplink, persists a pending row.
 */
export const requestRecording = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, ticketId } = req.params;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Verify team membership
    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team' });
      return;
    }

    // Verify ticket belongs to this team
    const ticket = await Ticket.findOne({ where: { id: ticketId, teamId } });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    // Resume an existing pending session if one hasn't expired yet.
    // Pulse Vault accepts the same draftId again and issues a fresh token,
    // so the user can continue recording from where they left off.
    const existingPending = await PulseAttachment.findOne({
      where: {
        ticketId,
        teamId,
        status: 'pending',
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    const draftId = existingPending ? existingPending.draftId : uuidv4();
    const resumed = !!existingPending;

    // Call Pulse Vault — works for both new draftIds and existing ones (re-tokenizes)
    let deeplinkResult;
    try {
      deeplinkResult = await requestDeeplink({
        draftId,
        userId,
        externalUserEmail: userEmail,
        expiresIn: PENDING_TTL_HOURS * 3600,
        oneTimeUse: false,
      });
    } catch (err) {
      logger.error('Pulse Vault deeplink request failed:', err);
      res.status(502).json({ message: 'Failed to reach Pulse Vault. Please try again.' });
      return;
    }

    const expiresAt = new Date(Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000);

    let attachment: PulseAttachment;
    if (existingPending) {
      // Extend expiry to match the freshly issued token
      await existingPending.update({ expiresAt });
      attachment = existingPending;
    } else {
      attachment = await PulseAttachment.create({
        ticketId,
        teamId,
        requestedBy: userId,
        draftId,
        status: 'pending',
        expiresAt,
      });
    }

    res.status(200).json({
      id: attachment.id,
      draftId,
      deeplink: deeplinkResult.deeplink,
      qrData: deeplinkResult.qrData,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      resumed,
    });
  } catch (error) {
    logger.error('requestRecording error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /teams/:teamId/tickets/:ticketId/pulse
 * Returns uploaded Pulse Shorts attached to this ticket.
 */
export const listAttachments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, ticketId } = req.params;
    const userId = req.user!.id;

    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team' });
      return;
    }

    const attachments = await PulseAttachment.findAll({
      where: {
        ticketId,
        teamId,
        status: 'uploaded',
      },
      order: [['uploadedAt', 'DESC']],
    });

    res.json(attachments);
  } catch (error) {
    logger.error('listAttachments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /teams/:teamId/tickets/:ticketId/pulse/:id
 * Removes the reference. Does not delete the video from Pulse Vault.
 */
export const deleteAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, ticketId, id } = req.params;
    const userId = req.user!.id;

    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team' });
      return;
    }

    const attachment = await PulseAttachment.findOne({ where: { id, ticketId, teamId } });
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    // Only the requester or a team Leader can remove
    const isRequester = attachment.requestedBy === userId;
    const isLeader = (member.get('role') as string) === 'Leader';
    if (!isRequester && !isLeader) {
      res.status(403).json({ message: 'Only the requester or a team Leader can remove this attachment' });
      return;
    }

    await attachment.destroy();
    res.json({ message: 'Attachment removed' });
  } catch (error) {
    logger.error('deleteAttachment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /teams/:teamId/tickets/:ticketId/pulse/pending
 * Returns pending (in-flight) attachments for this ticket so the UI can
 * show a "waiting for upload" indicator.
 */
export const listPending = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, ticketId } = req.params;
    const userId = req.user!.id;

    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      res.status(403).json({ message: 'You are not a member of this team' });
      return;
    }

    const pending = await PulseAttachment.findAll({
      where: {
        ticketId,
        teamId,
        status: 'pending',
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });

    res.json(pending);
  } catch (error) {
    logger.error('listPending error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
