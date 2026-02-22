import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse } from '../types/api';
import { rateLimit } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { RATE_LIMIT_PRESETS } from '../config/constants';
import * as authService from '../services/auth.service';
import {
  registerSchema,
  loginSchema,
  socialLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.schema';

const auth = new Hono<AppEnv>();

// POST /register
auth.post(
  '/register',
  validateBody(registerSchema),
  rateLimit({ ...RATE_LIMIT_PRESETS.auth, keyPrefix: 'auth:register' }),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.register(body);
      return c.json(successResponse(result), 201);
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'UNAUTHORIZED', err.message),
          err.statusCode ?? 401,
        );
      }
      throw err;
    }
  },
);

// POST /login
auth.post(
  '/login',
  validateBody(loginSchema),
  rateLimit({ ...RATE_LIMIT_PRESETS.auth, keyPrefix: 'auth:login' }),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.login(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'INVALID_CREDENTIALS', err.message),
          err.statusCode ?? 401,
        );
      }
      throw err;
    }
  },
);

// POST /login/social
auth.post(
  '/login/social',
  validateBody(socialLoginSchema),
  rateLimit({ ...RATE_LIMIT_PRESETS.auth, keyPrefix: 'auth:social' }),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.loginWithSocial(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'SOCIAL_AUTH_FAILED', err.message),
          err.statusCode ?? 401,
        );
      }
      throw err;
    }
  },
);

// POST /otp/request
auth.post(
  '/otp/request',
  validateBody(otpRequestSchema),
  rateLimit({ ...RATE_LIMIT_PRESETS.auth, keyPrefix: 'auth:otp' }),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.requestOtp(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'OTP_RATE_LIMITED', err.message),
          err.statusCode ?? 429,
        );
      }
      throw err;
    }
  },
);

// POST /otp/verify
auth.post(
  '/otp/verify',
  validateBody(otpVerifySchema),
  rateLimit({ ...RATE_LIMIT_PRESETS.auth, keyPrefix: 'auth:otp-verify' }),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.verifyOtp(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'OTP_INVALID', err.message),
          err.statusCode ?? 400,
        );
      }
      throw err;
    }
  },
);

// POST /refresh
auth.post('/refresh', validateBody(refreshTokenSchema), async (c) => {
  try {
    const body = c.req.valid('json' as never);
    const result = await authService.refreshTokenHandler(body);
    return c.json(successResponse(result));
  } catch (err: any) {
    if (err.name === 'AuthError' || err.code) {
      return c.json(
        errorResponse(err.code ?? 'REFRESH_TOKEN_EXPIRED', err.message),
        err.statusCode ?? 401,
      );
    }
    throw err;
  }
});

// POST /logout
auth.post('/logout', validateBody(refreshTokenSchema), async (c) => {
  try {
    const body = c.req.valid('json' as never);
    const result = await authService.logout(body);
    return c.json(successResponse(result));
  } catch (err: any) {
    if (err.name === 'AuthError' || err.code) {
      return c.json(
        errorResponse(err.code ?? 'UNAUTHORIZED', err.message),
        err.statusCode ?? 401,
      );
    }
    throw err;
  }
});

// POST /forgot-password
auth.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.forgotPassword(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'ACCOUNT_NOT_FOUND', err.message),
          err.statusCode ?? 404,
        );
      }
      throw err;
    }
  },
);

// POST /reset-password
auth.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  async (c) => {
    try {
      const body = c.req.valid('json' as never);
      const result = await authService.resetPassword(body);
      return c.json(successResponse(result));
    } catch (err: any) {
      if (err.name === 'AuthError' || err.code) {
        return c.json(
          errorResponse(err.code ?? 'TOKEN_INVALID', err.message),
          err.statusCode ?? 400,
        );
      }
      throw err;
    }
  },
);

export { auth };
