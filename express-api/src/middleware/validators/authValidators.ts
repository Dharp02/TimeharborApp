import { body, ValidationChain } from 'express-validator';

export const signupValidation: ValidationChain[] = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters')
];

export const signinValidation: ValidationChain[] = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

export const forgotPasswordValidation: ValidationChain[] = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
];

export const resetPasswordValidation: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

export const refreshTokenValidation: ValidationChain[] = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required')
];
