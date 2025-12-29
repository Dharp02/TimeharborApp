
import { Router } from 'express';
import { getDashboardStats, getRecentActivity } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authenticateToken, getDashboardStats);
router.get('/activity', authenticateToken, getRecentActivity);

export default router;
