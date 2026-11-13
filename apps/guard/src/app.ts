import Fastify from 'fastify';
import cors from '@fastify/cors';

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors);
  app.get('/api/health', async () => ({ status: 'ok', service: 'agent-spend-guard' }));
  return app;
}
