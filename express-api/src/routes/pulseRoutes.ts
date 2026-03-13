import { Router } from 'express';
import {
  requestRecording,
  listAttachments,
  listPending,
  deleteAttachment,
} from '../controllers/pulseController';
import { authenticateToken } from '../middleware/authMiddleware';

// Mounted at /teams/:teamId/tickets/:ticketId/pulse
// mergeParams: true so :teamId and :ticketId are visible here
const router = Router({ mergeParams: true });

router.use(authenticateToken);

// Request a new Pulse Cam recording and get back deeplink + QR
router.post('/', requestRecording);

// List uploaded Pulse Shorts attached to this ticket
router.get('/', listAttachments);

// List pending (in-flight) recording sessions
router.get('/pending', listPending);

// Remove an attachment reference (no video deleted in Pulse Vault)
router.delete('/:id', deleteAttachment);

export default router;
