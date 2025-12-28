import express from 'express';
import { syncTimeData } from '../controllers/timeController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

router.post('/sync', syncTimeData);

export default router;
