import type { Clock } from '../clock.js';
import type { SpendPolicy } from '../policy/schema.js';
import type { MemoryStore } from '../store/memory.js';
import type { AuditLog } from '../store/audit.js';
import type { TraceWriter } from '../telemetry/trace.js';
import type { SseEventType, SpendRequest } from '../types.js';

export const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
export const CALM_CONTROL = 'agent-spend-guard#agent-spend-authority';

export interface Ctx {
  policy: SpendPolicy;
  store: MemoryStore;
  audit: AuditLog;
  traces: TraceWriter;
  clock: Clock;
  emit: (type: SseEventType, data: unknown) => void;
}

/** Requests that hold budget: approved + pending (pending reserves, rejected/expired/denied release). */
const holds = (r: SpendRequest) => r.status === 'approved' || r.status === 'pending';

export function spentOnCase(ctx: Ctx, caseId: string, rootAgentId: string) {
  let sum = 0;
  for (const r of ctx.store.requests.values()) if (holds(r) && r.caseId === caseId && r.rootAgentId === rootAgentId) sum += r.amount;
  return round4(sum);
}

export function spentToday(ctx: Ctx, rootAgentId: string) {
  const day = ctx.clock.now().toISOString().slice(0, 10);
  let sum = 0;
  for (const r of ctx.store.requests.values()) if (holds(r) && r.rootAgentId === rootAgentId && r.ts.slice(0, 10) === day) sum += r.amount;
  return round4(sum);
}

/** Own authority (no delegation): tier, budgets and what is left. Delegated context arrives in task 2.3. */
export function ownAuthority(ctx: Ctx, agentId: string, caseId: string) {
  const agent = ctx.policy.agents[agentId];
  const tierId = agent.tier;
  const tier = ctx.policy.authorityTiers[tierId];
  const caseRemaining = round4(agent.budgets.perCase - spentOnCase(ctx, caseId, agentId));
  const dayRemaining = round4(agent.budgets.perDay - spentToday(ctx, agentId));
  return { agent, tierId, tier, caseRemaining, dayRemaining, remaining: Math.min(caseRemaining, dayRemaining) };
}
