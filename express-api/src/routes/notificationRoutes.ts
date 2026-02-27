import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteNotifications } from '../controllers/notificationController';
import { validateRequest } from '../middleware/validateRequest';
import { param, body } from 'express-validator';

const router = Router();

// Protect all routes with authentication
router.use(authenticateToken);

// Validation rules
const notificationIdValidation = [
  param('id').isUUID().withMessage('Invalid Notification ID'),
];

const deleteNotificationsValidation = [
  body('ids').isArray().withMessage('IDs must be an array'),
  body('ids.*').isUUID().withMessage('Each ID must be a valid UUID'),
];

// Routes
router.get('/', getNotifications);
router.patch('/:id/read', notificationIdValidation, validateRequest, markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', notificationIdValidation, validateRequest, deleteNotification);
router.delete('/', deleteNotificationsValidation, validateRequest, deleteNotifications);

export default router;
