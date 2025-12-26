import { Router } from 'express';
import { 
  signup, 
  signin, 
  getMe, 
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  signout
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  signupValidation,
  signinValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  refreshTokenValidation
} from '../middleware/validators/authValidators';

const router = Router();

// Public routes
router.post('/signup', signupValidation, validateRequest, signup);
router.post('/signin', signinValidation, validateRequest, signin);
router.post('/refresh', refreshTokenValidation, validateRequest, refreshAccessToken);
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);
router.post('/reset-password', resetPasswordValidation, validateRequest, resetPassword);

// Protected routes (require authentication)
router.get('/me', authenticateToken, getMe);
router.post('/signout', signout);

export default router;
