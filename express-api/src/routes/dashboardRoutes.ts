
import { Router } from 'express';
import { getDashboardStats, getRecentActivity, getMemberActivity } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authenticateToken, getDashboardStats);
router.get('/activity', authenticateToken, getRecentActivity);
router.get('/member/:memberId', authenticateToken, getMemberActivity);

export default router;
