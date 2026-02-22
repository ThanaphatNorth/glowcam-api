import { app } from './app';

const port = parseInt(process.env.API_PORT ?? '3001', 10);

console.log(`GlowCam API starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
