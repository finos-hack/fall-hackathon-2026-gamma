import { buildApp, type AppOptions } from '../src/app.js';
import { ManualClock } from '../src/clock.js';
import type { Ctx } from '../src/engine/authority.js';

export async function mk(opts: AppOptions = {}) {
  const clock = new ManualClock();
  const app = await buildApp({ clock, ...opts });
  const ctx = (app as unknown as { ctx: Ctx }).ctx;
  const call = async (method: 'GET' | 'POST', url: string, payload?: unknown) => {
    const res = await app.inject({ method, url, payload: payload as object });
    return { status: res.statusCode, body: res.headers['content-type']?.toString().includes('json') ? res.json() : res.body };
  };
  const spend = async (b: Record<string, unknown>) => (await call('POST', '/api/spend', b)).body;
  const act = (id: string, what: 'approve' | 'reject', approverId: string) =>
    call('POST', `/api/requests/${id}/${what}`, { approverId, comment: 'ok' });
  return { app, clock, ctx, call, spend, act };
}
export const llm = (caseId: string, agentId = 'loan-agent', extra = {}) =>
  ({ caseId, agentId, kind: 'llm', service: 'llm.standard', inputTokens: 3000, outputTokens: 800, ...extra });
export const svc = (caseId: string, service: string, extra = {}) => ({ caseId, agentId: 'loan-agent', kind: 'service', service, ...extra });
