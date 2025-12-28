import express from 'express';
import { syncTimeData, syncTimeEvents } from '../controllers/timeController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

router.post('/sync', syncTimeData);
router.post('/sync-events', syncTimeEvents);

export default router;
