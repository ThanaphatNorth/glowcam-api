import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { successResponse, errorResponse } from '../types/api';
import { authRequired } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error-handler';
import * as userService from '../services/user.service';
import { updateUserSchema } from '../validators/user.schema';

const userRoutes = new Hono<AppEnv>();

// GET /me - Get current user profile
userRoutes.get('/me', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const user = await userService.getUserById(userId);
  if (!user) {
    throw new AppError('ACCOUNT_NOT_FOUND');
  }
  return c.json(successResponse(user));
});

// PUT /me - Update current user profile
userRoutes.put(
  '/me',
  authRequired,
  validateBody(updateUserSchema),
  async (c) => {
    const { userId } = c.get('auth');
    const body = c.req.valid('json' as never);
    const updated = await userService.updateUser(userId, body);
    return c.json(successResponse(updated));
  },
);

// DELETE /me - Delete current user account
userRoutes.delete('/me', authRequired, async (c) => {
  const { userId } = c.get('auth');
  await userService.deleteUser(userId);
  return c.json(successResponse({ message: 'Account deleted successfully' }));
});

// GET /me/subscription - Get current user subscription
userRoutes.get('/me/subscription', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const subscription = await userService.getUserSubscription(userId);
  return c.json(successResponse(subscription));
});

// GET /me/export - Export user data (GDPR)
userRoutes.get('/me/export', authRequired, async (c) => {
  const { userId } = c.get('auth');
  const exportData = await userService.exportUserData(userId);
  return c.json(successResponse(exportData));
});

export { userRoutes };
