// ---------------------------------------------------------------------------
// Auth Validators (Zod Schemas)
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---- Shared field schemas ----

const emailField = z
  .string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be at most 255 characters')
  .transform((v) => v.toLowerCase().trim());

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const nameField = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .trim();

const phoneField = z
  .string()
  .regex(
    /^\+[1-9]\d{6,14}$/,
    'Phone must be in E.164 format (e.g. +66812345678)',
  );

// ---- Registration ----

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  name: nameField,
  locale: z
    .string()
    .min(2)
    .max(10)
    .default('en'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---- Login ----

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---- Social Login ----

export const socialLoginSchema = z.object({
  provider: z.enum(['apple', 'google'], {
    errorMap: () => ({ message: 'Provider must be apple or google' }),
  }),
  idToken: z.string().min(1, 'ID token is required'),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  locale: z
    .string()
    .min(2)
    .max(10)
    .default('en'),
});

export type SocialLoginInput = z.infer<typeof socialLoginSchema>;

// ---- OTP Request ----

export const otpRequestSchema = z.object({
  phone: phoneField,
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

// ---- OTP Verify ----

export const otpVerifySchema = z.object({
  phone: phoneField,
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must only contain digits'),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

// ---- Refresh Token ----

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// ---- Forgot Password ----

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ---- Reset Password ----

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordField,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---- Change Password ----

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
  confirmNewPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must differ from current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
