import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, RefreshToken } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Token generation helpers
const generateAccessToken = (userId: string, email: string, full_name?: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT_SECRET not configured', 500);
  }
  
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const token = jwt.sign(
    { id: userId, email, full_name },
    jwtSecret as jwt.Secret,
    { expiresIn } as jwt.SignOptions
  );
  return token as string;
};

const generateRefreshToken = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await RefreshToken.create({
    user_id: userId,
    token,
    expires_at: expiresAt
  });

  return token;
};

// Signup controller
export const signup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, full_name } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new AppError('This email is already registered. Please sign in instead.', 409);
  }

  // Create new user (password will be hashed by beforeCreate hook)
  const user = await User.create({
    email,
    password,
    full_name,
    email_verified: false
  });

  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.email, user.full_name);
  const refreshToken = await generateRefreshToken(user.id);

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    user: user.toJSON(),
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900 // 15 minutes in seconds
    }
  });
});

// Signin controller
export const signin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Validate password
  const isValidPassword = await user.validatePassword(password);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.email, user.full_name);
  const refreshToken = await generateRefreshToken(user.id);

  logger.info(`User signed in: ${email}`);

  res.json({
    user: user.toJSON(),
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900 // 15 minutes in seconds
    }
  });
});

// Get current user (requires authentication)
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'email', 'full_name', 'email_verified', 'created_at', 'updated_at']
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: user.toJSON() });
});

// Update user profile
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const { full_name, email } = req.body;

  const user = await User.findByPk(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update fields
  if (full_name) user.full_name = full_name;
  
  // If email is changing, we should verify it doesn't exist
  if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new AppError('Email already in use', 409);
      }
      user.email = email;
      user.email_verified = false; // Require verification again
  }

  await user.save();

  res.json({ 
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      updated_at: user.updated_at
    } 
  });
});

// Refresh access token
export const refreshAccessToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refresh_token } = req.body;

  // Find refresh token in database
  const tokenRecord = await RefreshToken.findOne({
    where: { token: refresh_token, revoked: false },
    include: [{ model: User, as: 'user' }]
  });

  if (!tokenRecord) {
    throw new AppError('Invalid refresh token', 401);
  }

  // Check if token is expired
  if (tokenRecord.isExpired()) {
    await tokenRecord.revoke();
    throw new AppError('Refresh token expired', 401);
  }

  // Get user
  const user = await User.findByPk(tokenRecord.user_id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(user.id, user.email);
  const newRefreshToken = await generateRefreshToken(user.id);

  // Revoke old refresh token (token rotation)
  await tokenRecord.revoke();

  logger.info(`Token refreshed for user: ${user.email}`);

  res.json({
    session: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900 // 15 minutes in seconds
    }
  });
});

// Forgot password
export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ where: { email } });
  
  // Always return success to prevent email enumeration
  if (!user) {
    logger.warn(`Password reset requested for non-existent email: ${email}`);
    res.json({ message: 'If that email exists, a password reset link has been sent.' });
    return;
  }

  // Generate reset token
  const resetToken = await user.generateResetToken();

  // TODO: Send email with reset token
  // For now, log it (in production, use a proper email service)
  logger.info(`Password reset token for ${email}: ${resetToken}`);
  
  // In development, return the token for testing
  if (process.env.NODE_ENV === 'development') {
    res.json({
      message: 'Password reset token generated',
      reset_token: resetToken // Remove in production
    });
  } else {
    res.json({ message: 'If that email exists, a password reset link has been sent.' });
  }
});

// Reset password
export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    where: {
      reset_token: token
    }
  });

  if (!user || !user.reset_token_expiry) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Check if token is expired
  if (user.reset_token_expiry < new Date()) {
    throw new AppError('Reset token has expired', 400);
  }

  // Update password (will be hashed by beforeUpdate hook)
  user.password = password;
  user.reset_token = undefined;
  user.reset_token_expiry = undefined;
  await user.save();

  logger.info(`Password reset successful for user: ${user.email}`);

  res.json({ message: 'Password has been reset successfully' });
});

// Sign out (revoke refresh token)
export const signout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refresh_token } = req.body;

  if (refresh_token) {
    const tokenRecord = await RefreshToken.findOne({ where: { token: refresh_token } });
    if (tokenRecord) {
      await tokenRecord.revoke();
    }
  }

  res.json({ message: 'Signed out successfully' });
});

// Register device for push notifications
export const registerDevice = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const { fcm_token, platform } = req.body;

  if (!fcm_token || !platform) {
    throw new AppError('FCM token and platform are required', 400);
  }

  if (platform !== 'ios' && platform !== 'android') {
    throw new AppError('Platform must be either "ios" or "android"', 400);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DEVICE REGISTER] New device registration request');
  console.log('[DEVICE REGISTER] User:', req.user.email);
  console.log('[DEVICE REGISTER] User ID:', req.user.id);
  console.log('[DEVICE REGISTER] Platform:', platform);
  console.log('[DEVICE REGISTER] Token length:', fcm_token.length);
  console.log('[DEVICE REGISTER] Token preview:', fcm_token.substring(0, 30) + '...');
  
  // Update user's FCM token
  await User.update(
    {
      fcm_token,
      fcm_platform: platform,
      fcm_updated_at: new Date()
    },
    {
      where: { id: req.user.id }
    }
  );

  console.log('[DEVICE REGISTER] ✅ Token saved to database');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`Device registered for user ${req.user.email}: ${platform}`);

  res.json({ message: 'Device registered successfully' });
});
