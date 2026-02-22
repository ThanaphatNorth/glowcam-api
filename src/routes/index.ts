import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
import { auth } from './auth.routes';
import { userRoutes } from './user.routes';
import { mediaRoutes } from './media.routes';
import { albumRoutes } from './album.routes';
import { editorRoutes } from './editor.routes';
import { contentRoutes } from './content.routes';
import { supportRoutes } from './support.routes';
import { analyticsRoutes } from './analytics.routes';
import { flagsRoutes } from './flags.routes';
import { webhooks } from './webhooks.routes';

const api = new Hono<AppEnv>();

api.route('/auth', auth);
api.route('/users', userRoutes);
api.route('/media', mediaRoutes);
api.route('/albums', albumRoutes);
api.route('/editor', editorRoutes);
api.route('/content', contentRoutes);
api.route('/support/tickets', supportRoutes);
api.route('/analytics', analyticsRoutes);
api.route('/flags', flagsRoutes);
api.route('/webhooks', webhooks);

export { api };
