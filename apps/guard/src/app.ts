import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadPolicy } from './policy/load.js';

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors);
  const policy = loadPolicy();
  app.get('/api/policy', async () => policy);
  app.get('/api/health', async () => ({ status: 'ok', service: 'agent-spend-guard' }));
  return app;
}
