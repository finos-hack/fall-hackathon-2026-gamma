import { join } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadPolicy } from './policy/load.js';
import { systemClock, type Clock } from './clock.js';
import { MemoryStore } from './store/memory.js';
import { AuditLog } from './store/audit.js';
import { TraceWriter } from './telemetry/trace.js';
import { Bus } from './api/sse.js';
import { registerRoutes } from './api/routes.js';
import type { Ctx } from './engine/authority.js';

export interface AppOptions {
  clock?: Clock;
  /** Folder for audit.jsonl and traces.jsonl. Omit for a purely in-memory guard (tests). */
  dataDir?: string;
  policyPath?: string;
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({ logger: false });
  await app.register(cors);
  const bus = new Bus();
  const policy = loadPolicy(opts.policyPath);
  const audit = new AuditLog(opts.dataDir && join(opts.dataDir, 'audit.jsonl'));
  audit.onAppend = (e) => bus.emit('audit', e);
  const ctx: Ctx = {
    policy, audit, store: new MemoryStore(), clock: opts.clock ?? systemClock,
    traces: new TraceWriter(opts.dataDir && join(opts.dataDir, 'traces.jsonl')),
    emit: (type, data) => bus.emit(type, data),
  };
  audit.append('POLICY_LOADED', 'spend-guard', { policyName: policy.metadata.name, version: policy.metadata.version }, ctx.clock.now().toISOString());
  registerRoutes(app, ctx, bus, opts.policyPath);
  app.get('/api/health', async () => ({ status: 'ok', service: 'agent-spend-guard' }));
  app.decorate('ctx', ctx);
  return app;
}
