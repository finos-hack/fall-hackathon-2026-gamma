import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../types.js';
import { approve, reject, resumeAgent, sweepExpired } from '../engine/approvals.js';
import { spentOnCase, spentToday, type Ctx } from '../engine/authority.js';
import { evaluate } from '../engine/evaluate.js';
import { loadPolicy } from '../policy/load.js';
import { openStream, type Bus } from './sse.js';

const SpendBody = z.object({
  caseId: z.string().min(1), agentId: z.string().min(1), delegationId: z.string().optional(),
  kind: z.enum(['llm', 'service']), service: z.string().min(1),
  inputTokens: z.number().min(0).optional(), outputTokens: z.number().min(0).optional(), promptHash: z.string().optional(),
  quantity: z.number().positive().optional(), params: z.record(z.string(), z.unknown()).optional(),
  purpose: z.string().optional(), source: z.enum(['scripted', 'live-llm', 'fluxnova']).optional(),
});
const ActBody = z.object({ approverId: z.string().min(1), comment: z.string().optional() });

export function registerRoutes(app: FastifyInstance, ctx: Ctx, bus: Bus, policyPath?: string) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: 'BAD_REQUEST', message: z.prettifyError(err) });
    return reply.status(500).send({ error: 'INTERNAL', message: String((err as Error).message ?? err) });
  });

  const view = (id: string) => {
    const request = ctx.store.requests.get(id);
    if (!request) throw new HttpError(404, 'NOT_FOUND', `Request ${id} not found`);
    return { request, decision: ctx.store.decisions.get(id), approvals: ctx.store.approvalsFor(id) };
  };

  app.get('/api/policy', async () => ctx.policy);
  app.post('/api/policy/reload', async () => {
    ctx.policy = loadPolicy(policyPath);
    ctx.audit.append('POLICY_LOADED', 'spend-guard', { policyName: ctx.policy.metadata.name, version: ctx.policy.metadata.version }, ctx.clock.now().toISOString());
    return { name: ctx.policy.metadata.name, version: ctx.policy.metadata.version };
  });

  app.post('/api/spend', async (req) => {
    sweepExpired(ctx);
    const { request, decision } = evaluate(ctx, SpendBody.parse(req.body));
    return { requestId: request.id, status: request.status, decision };
  });
  app.get('/api/requests/:id', async (req) => {
    sweepExpired(ctx);
    return view((req.params as { id: string }).id);
  });
  for (const [name, fn] of [['approve', approve], ['reject', reject]] as const) {
    app.post(`/api/requests/:id/${name}`, async (req) => {
      const body = ActBody.parse(req.body);
      const out = fn(ctx, (req.params as { id: string }).id, body.approverId, body.comment);
      return { requestId: out.request.id, status: out.request.status, approvals: out.approvals };
    });
  }
  app.post('/api/agents/:id/resume', async (req) =>
    resumeAgent(ctx, (req.params as { id: string }).id, z.object({ approverId: z.string() }).parse(req.body).approverId));

  app.get('/api/state', async () => {
    sweepExpired(ctx);
    const all = [...ctx.store.requests.values()];
    const caseIds = [...new Set(all.map((r) => r.caseId))];
    return {
      policy: { name: ctx.policy.metadata.name, version: ctx.policy.metadata.version },
      agents: Object.entries(ctx.policy.agents).map(([agentId, a]) => ({
        agentId, tier: a.tier, budgets: a.budgets, spentToday: spentToday(ctx, agentId),
        suspended: ctx.store.suspended(agentId), ...ctx.store.agents.get(agentId),
      })),
      cases: caseIds.map((caseId) => ({
        caseId, byAgent: Object.keys(ctx.policy.agents)
          .map((agentId) => ({ agentId, spent: spentOnCase(ctx, caseId, agentId) })).filter((x) => x.spent > 0),
      })),
      queue: all.filter((r) => r.status === 'pending').map((r) => view(r.id)),
      requests: all.slice(-200).map((r) => view(r.id)),
    };
  });

  app.get('/api/audit', async (req, reply) => {
    if ((req.query as { format?: string }).format === 'csv') {
      return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="audit.csv"').send(ctx.audit.toCsv());
    }
    return ctx.audit.entries;
  });
  app.get('/api/audit/verify', async () => ctx.audit.verify());
  app.get('/api/traces', async () => ctx.traces.all());
  app.get('/api/stream', async (_req, reply) => openStream(bus, reply));

  app.post('/api/reset', async () => {
    ctx.store.reset(); ctx.audit.reset(); ctx.traces.reset();
    ctx.audit.append('POLICY_LOADED', 'spend-guard', { policyName: ctx.policy.metadata.name, version: ctx.policy.metadata.version }, ctx.clock.now().toISOString());
    ctx.emit('reset', {});
    return { ok: true };
  });
}
