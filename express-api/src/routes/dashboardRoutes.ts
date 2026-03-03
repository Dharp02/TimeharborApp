
import { Router } from 'express';
import { getDashboardStats, getRecentActivity, getMemberActivity, addReply, getTimesheetTotals } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/stats', authenticateToken, getDashboardStats);
router.get('/activity', authenticateToken, getRecentActivity);
router.post('/activity/reply', authenticateToken, addReply);
router.get('/member/:memberId', authenticateToken, getMemberActivity);
router.get('/timesheet', authenticateToken, getTimesheetTotals);

export default router;
