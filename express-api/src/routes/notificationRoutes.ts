import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { validateRequest } from '../middleware/validateRequest';
import { param } from 'express-validator';

const router = Router();

// Protect all routes with authentication
router.use(authenticateToken);

// Validation rules
const notificationIdValidation = [
  param('id').isUUID().withMessage('Invalid Notification ID'),
];

// Routes
router.get('/', getNotifications);
router.patch('/:id/read', notificationIdValidation, validateRequest, markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;
