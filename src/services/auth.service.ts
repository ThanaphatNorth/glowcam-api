/**
 * Auth Service
 *
 * Handles user registration, login (email/social), OTP verification,
 * token management, password reset, and logout flows.
 */

import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';
import * as jose from 'jose';
import { db } from '../db/client';
import { users, refreshTokens } from '../db/schema';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../lib/jwt';
import { getCache, setCache, deleteCache } from '../lib/redis';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../lib/email';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  locale?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SocialLoginInput {
  provider: 'google' | 'apple';
  idToken: string;
  name?: string;
}

export interface RequestOtpInput {
  phone: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface LogoutInput {
  refreshToken: string;
  userId: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SafeUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  avatarUrl: string | null;
  subscriptionTier: string | null;
  locale: string | null;
  authProvider: string;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

// ── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_RATE_LIMIT_SECONDS = 60;
const RESET_TOKEN_EXPIRY_SECONDS = 1800; // 30 minutes
const MAX_OTP_ATTEMPTS = 5;

// ── Custom Error ────────────────────────────────────────────────────────────

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Remove sensitive fields from a user record before returning to client.
 */
export function stripSensitiveFields(user: typeof users.$inferSelect): SafeUser {
  const { passwordHash, authProviderId, ...safe } = user;
  return safe as SafeUser;
}

/**
 * Calculate refresh token expiry date.
 */
function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
}

/**
 * Create a new access/refresh token pair and persist the refresh token.
 */
async function createTokenPair(
  userId: string,
  tier: string,
): Promise<AuthTokens> {
  const accessToken = await generateAccessToken(userId, tier);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

// ── Social Provider Verification ────────────────────────────────────────────

/**
 * Verify a Google ID token via Google's tokeninfo endpoint.
 * Returns the user's email and name from the Google profile.
 */
async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ email: string; name: string; sub: string }> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!response.ok) {
    throw new AuthError(
      'Invalid Google ID token',
      'INVALID_GOOGLE_TOKEN',
      401,
    );
  }

  const payload = (await response.json()) as {
    email?: string;
    name?: string;
    sub?: string;
    aud?: string;
  };

  const allowedClientIds = (process.env.GOOGLE_CLIENT_IDS ?? '').split(',').filter(Boolean);
  if (allowedClientIds.length > 0 && payload.aud && !allowedClientIds.includes(payload.aud)) {
    throw new AuthError(
      'Google token audience mismatch',
      'GOOGLE_AUDIENCE_MISMATCH',
      401,
    );
  }

  if (!payload.email || !payload.sub) {
    throw new AuthError(
      'Google token missing required fields',
      'GOOGLE_TOKEN_INCOMPLETE',
      401,
    );
  }

  return {
    email: payload.email,
    name: payload.name ?? payload.email.split('@')[0] ?? 'User',
    sub: payload.sub,
  };
}

/**
 * Verify an Apple ID token using Apple's public JWKS.
 * Returns the user's email and sub from the token claims.
 */
async function verifyAppleIdToken(
  idToken: string,
): Promise<{ email: string; name: string; sub: string }> {
  const JWKS = jose.createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  try {
    const { payload } = await jose.jwtVerify(idToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID,
    });

    const email = payload.email as string | undefined;
    const sub = payload.sub;

    if (!email || !sub) {
      throw new AuthError(
        'Apple token missing required fields',
        'APPLE_TOKEN_INCOMPLETE',
        401,
      );
    }

    return {
      email,
      name: email.split('@')[0] ?? 'User',
      sub,
    };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      'Invalid Apple ID token',
      'INVALID_APPLE_TOKEN',
      401,
    );
  }
}

// ── Public Functions ────────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { email, password, name, locale } = input;

  // Check if email is already registered
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new AuthError(
      'An account with this email already exists',
      'EMAIL_EXISTS',
      409,
    );
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AuthError(
      'Password must be at least 8 characters',
      'WEAK_PASSWORD',
      400,
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const [newUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      locale: locale ?? 'en',
      authProvider: 'email',
      subscriptionTier: 'free',
    })
    .returning();

  if (!newUser) {
    throw new AuthError(
      'Failed to create user account',
      'CREATE_FAILED',
      500,
    );
  }

  const tokens = await createTokenPair(newUser.id, newUser.subscriptionTier ?? 'free');

  // Send welcome email in background (don't block registration)
  sendWelcomeEmail(newUser.email!, newUser.name).catch((err) => {
    console.error('[Auth] Failed to send welcome email:', err);
  });

  return {
    user: stripSensitiveFields(newUser),
    tokens,
  };
}

/**
 * Login with email and password.
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const { email, password } = input;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.passwordHash) {
    throw new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401,
    );
  }

  if (!user.isActive) {
    throw new AuthError(
      'This account has been deactivated',
      'ACCOUNT_INACTIVE',
      403,
    );
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AuthError(
      'Invalid email or password',
      'INVALID_CREDENTIALS',
      401,
    );
  }

  const tokens = await createTokenPair(user.id, user.subscriptionTier ?? 'free');

  return {
    user: stripSensitiveFields(user),
    tokens,
  };
}

/**
 * Login or register via social provider (Google or Apple).
 */
export async function loginWithSocial(
  input: SocialLoginInput,
): Promise<AuthResponse> {
  const { provider, idToken, name: providedName } = input;

  let profile: { email: string; name: string; sub: string };

  if (provider === 'google') {
    profile = await verifyGoogleIdToken(idToken);
  } else if (provider === 'apple') {
    profile = await verifyAppleIdToken(idToken);
  } else {
    throw new AuthError(
      `Unsupported social provider: ${provider}`,
      'UNSUPPORTED_PROVIDER',
      400,
    );
  }

  // Check if user already exists by provider ID
  let [existingUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.authProvider, provider),
        eq(users.authProviderId, profile.sub),
      ),
    )
    .limit(1);

  // Also check by email (user might have registered with email first)
  if (!existingUser) {
    [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email.toLowerCase()))
      .limit(1);

    // Link the social account to existing email account
    if (existingUser) {
      await db
        .update(users)
        .set({
          authProvider: provider,
          authProviderId: profile.sub,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      // Re-fetch to get updated record
      [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, existingUser.id))
        .limit(1);
    }
  }

  if (existingUser) {
    if (!existingUser.isActive) {
      throw new AuthError(
        'This account has been deactivated',
        'ACCOUNT_INACTIVE',
        403,
      );
    }

    const tokens = await createTokenPair(
      existingUser.id,
      existingUser.subscriptionTier ?? 'free',
    );

    return {
      user: stripSensitiveFields(existingUser),
      tokens,
    };
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      email: profile.email.toLowerCase(),
      name: providedName ?? profile.name,
      authProvider: provider,
      authProviderId: profile.sub,
      subscriptionTier: 'free',
    })
    .returning();

  if (!newUser) {
    throw new AuthError(
      'Failed to create social account',
      'CREATE_FAILED',
      500,
    );
  }

  const tokens = await createTokenPair(newUser.id, newUser.subscriptionTier ?? 'free');

  // Send welcome email in background
  if (newUser.email) {
    sendWelcomeEmail(newUser.email, newUser.name).catch((err) => {
      console.error('[Auth] Failed to send welcome email:', err);
    });
  }

  return {
    user: stripSensitiveFields(newUser),
    tokens,
  };
}

/**
 * Request an OTP code for phone-based authentication.
 * Rate limited to one request per minute per phone number.
 */
export async function requestOtp(input: RequestOtpInput): Promise<{ message: string }> {
  const { phone } = input;

  // Rate limiting check
  const rateLimitKey = `otp:rate:${phone}`;
  const rateLimited = await getCache<string>(rateLimitKey);

  if (rateLimited) {
    throw new AuthError(
      'Please wait before requesting another OTP',
      'OTP_RATE_LIMITED',
      429,
    );
  }

  // Generate OTP
  const otp = String(randomInt(100000, 999999));

  // Store OTP with expiry
  const otpKey = `otp:${phone}`;
  await setCache(
    otpKey,
    JSON.stringify({ code: otp, attempts: 0 }),
    OTP_EXPIRY_SECONDS,
  );

  // Set rate limit
  await setCache(rateLimitKey, '1', OTP_RATE_LIMIT_SECONDS);

  // In production, send SMS here. For now, log in development.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth] OTP for ${phone}: ${otp}`);
  }

  // TODO: Integrate SMS provider (e.g., Twilio, AWS SNS)
  // await sendSms(phone, `Your GlowCam code: ${otp}`);

  return { message: 'OTP sent successfully' };
}

/**
 * Verify an OTP code and authenticate the user.
 * Limited to 5 attempts per OTP.
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<AuthResponse> {
  const { phone, code } = input;

  const otpKey = `otp:${phone}`;
  const stored = await getCache<{ code: string; attempts: number }>(otpKey);

  if (!stored) {
    throw new AuthError(
      'OTP expired or not found. Please request a new one.',
      'OTP_EXPIRED',
      400,
    );
  }

  // Check attempts
  if (stored.attempts >= MAX_OTP_ATTEMPTS) {
    await deleteCache(otpKey);
    throw new AuthError(
      'Too many failed attempts. Please request a new OTP.',
      'OTP_MAX_ATTEMPTS',
      429,
    );
  }

  // Increment attempts
  await setCache(
    otpKey,
    JSON.stringify({ ...stored, attempts: stored.attempts + 1 }),
    OTP_EXPIRY_SECONDS,
  );

  if (stored.code !== code) {
    throw new AuthError(
      'Invalid OTP code',
      'INVALID_OTP',
      400,
    );
  }

  // OTP verified - clear it
  await deleteCache(otpKey);

  // Find or create user by phone
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone,
        name: `User ${phone.slice(-4)}`,
        authProvider: 'phone',
        subscriptionTier: 'free',
      })
      .returning();
  }

  if (!user) {
    throw new AuthError(
      'Failed to create or retrieve user',
      'CREATE_FAILED',
      500,
    );
  }

  if (!user.isActive) {
    throw new AuthError(
      'This account has been deactivated',
      'ACCOUNT_INACTIVE',
      403,
    );
  }

  const tokens = await createTokenPair(user.id, user.subscriptionTier ?? 'free');

  return {
    user: stripSensitiveFields(user),
    tokens,
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Implements reuse detection: if a revoked token is reused, all tokens
 * for that user are revoked (indicating a potential token theft).
 */
export async function refreshTokenHandler(
  input: RefreshTokenInput,
): Promise<AuthTokens> {
  const { refreshToken: rawToken } = input;
  const tokenHash = hashRefreshToken(rawToken);

  // Find the token record
  const [tokenRecord] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!tokenRecord) {
    throw new AuthError(
      'Invalid refresh token',
      'INVALID_REFRESH_TOKEN',
      401,
    );
  }

  // Reuse detection: if the token was already revoked, revoke ALL tokens
  // for this user (security measure against token theft)
  if (tokenRecord.revokedAt) {
    console.warn(
      `[Auth] Refresh token reuse detected for user ${tokenRecord.userId}. Revoking all tokens.`,
    );

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, tokenRecord.userId),
          isNull(refreshTokens.revokedAt),
        ),
      );

    throw new AuthError(
      'Refresh token reuse detected. Please login again.',
      'TOKEN_REUSE_DETECTED',
      401,
    );
  }

  // Check expiry
  if (new Date() > tokenRecord.expiresAt) {
    throw new AuthError(
      'Refresh token expired',
      'REFRESH_TOKEN_EXPIRED',
      401,
    );
  }

  // Revoke the old token
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenRecord.id));

  // Fetch user to get current tier
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRecord.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new AuthError(
      'User account not found or inactive',
      'ACCOUNT_INACTIVE',
      401,
    );
  }

  // Issue new token pair
  return createTokenPair(user.id, user.subscriptionTier ?? 'free');
}

/**
 * Logout by revoking the provided refresh token.
 */
export async function logout(input: LogoutInput): Promise<{ success: boolean }> {
  const { refreshToken: rawToken, userId } = input;
  const tokenHash = hashRefreshToken(rawToken);

  const result = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .returning({ id: refreshTokens.id });

  return { success: result.length > 0 };
}

/**
 * Initiate password reset flow. Sends a reset email if the account exists.
 * Safe against email enumeration (always returns success message).
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<{ message: string }> {
  const { email } = input;

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Always return the same message to prevent email enumeration
  const successMessage = 'If an account with that email exists, a password reset link has been sent.';

  if (!user || !user.email) {
    return { message: successMessage };
  }

  // Generate a secure reset token
  const resetToken = randomBytes(32).toString('hex');
  const resetKey = `pwd_reset:${resetToken}`;

  // Store in Redis with expiry
  await setCache(
    resetKey,
    JSON.stringify({ userId: user.id, email: user.email }),
    RESET_TOKEN_EXPIRY_SECONDS,
  );

  // Send reset email in background
  sendPasswordResetEmail(user.email, resetToken).catch((err) => {
    console.error('[Auth] Failed to send password reset email:', err);
  });

  return { message: successMessage };
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPassword(
  input: ResetPasswordInput,
): Promise<{ success: boolean }> {
  const { token, newPassword } = input;

  if (newPassword.length < 8) {
    throw new AuthError(
      'Password must be at least 8 characters',
      'WEAK_PASSWORD',
      400,
    );
  }

  const resetKey = `pwd_reset:${token}`;
  const stored = await getCache<{ userId: string; email: string }>(resetKey);

  if (!stored) {
    throw new AuthError(
      'Invalid or expired reset token',
      'INVALID_RESET_TOKEN',
      400,
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Update the password
  const [updated] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, stored.userId))
    .returning({ id: users.id });

  if (!updated) {
    throw new AuthError(
      'Failed to update password',
      'UPDATE_FAILED',
      500,
    );
  }

  // Invalidate the reset token
  await deleteCache(resetKey);

  // Revoke all existing refresh tokens for this user (force re-login)
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, stored.userId),
        isNull(refreshTokens.revokedAt),
      ),
    );

  return { success: true };
}
