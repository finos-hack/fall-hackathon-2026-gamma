import type { Clock } from '../clock.js';
import type { SpendPolicy } from '../policy/schema.js';
import type { MemoryStore } from '../store/memory.js';
import type { AuditLog } from '../store/audit.js';
import type { TraceWriter } from '../telemetry/trace.js';
import { matchesAny } from '../policy/glob.js';
import type { Delegation, SseEventType, SpendRequest } from '../types.js';

export const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
export const CALM_CONTROL = 'agent-spend-guard#agent-spend-authority';

export interface Ctx {
  policy: SpendPolicy;
  store: MemoryStore;
  audit: AuditLog;
  traces: TraceWriter;
  clock: Clock;
  emit: (type: SseEventType, data: unknown) => void;
  /** Result of the CALM binding check at startup (undefined when skipped, e.g. a custom test policy). */
  finos?: import('../finos/calm-binding.js').BindingResult;
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

type Tier = SpendPolicy['authorityTiers'][string];

/** Stricter of two tiers: the minimum of every numeric limit, approver roles in common. */
export function stricter(a: Tier, b: Tier): Tier {
  const roles = a.approverRoles.filter((r) => b.approverRoles.includes(r));
  const fe = [a.fourEyesAbove, b.fourEyesAbove].filter((x): x is number => x !== null);
  return {
    label: a.label, autoApproveUpTo: Math.min(a.autoApproveUpTo, b.autoApproveUpTo),
    escalateUpTo: Math.min(a.escalateUpTo, b.escalateUpTo), fourEyesAbove: fe.length ? Math.min(...fe) : null,
    approverRoles: roles.length ? roles : a.approverRoles,
  };
}

/** A grant is usable only while active and unexpired. Expiry is applied lazily. */
export function grantStatus(ctx: Ctx, g: Delegation): Delegation['status'] {
  if ((g.status === 'active' || g.status === 'pending') && Date.parse(g.expiresAt) <= ctx.clock.now().getTime()) g.status = 'expired';
  return g.status;
}

/** Spend under a grant: approved + pending requests that used it (reject/expiry releases). */
export function grantSpent(ctx: Ctx, grantId: string) {
  let sum = 0;
  for (const r of ctx.store.requests.values()) if (holds(r) && r.delegationId === grantId) sum += r.amount;
  return round4(sum);
}

/** Pattern p is covered by q if p == q, or q = "x.*" and p starts with "x.". */
export const covers = (q: string, p: string) => p === q || (q.endsWith('.*') && p.startsWith(q.slice(0, -1)));

export interface Authority {
  rootAgentId: string; tierId: string; tier: Tier;
  /** Allowed for this request: own allow-list, or grant services AND the child's own allow-list. */
  allows: (service: string) => boolean;
  /** Allowed by the acting agent's own role alone (ignores the grant). */
  childAllows: (service: string) => boolean;
  caseRemaining: number; dayRemaining: number; grantRemaining?: number; remaining: number;
  /** Service patterns this authority may pass on in a new grant. */
  servicePatterns: string[];
}

/** Authority of `agentId` on a case: own, or delegated by `grant` (stricter tier, shared root budget). */
export function authorityOf(ctx: Ctx, agentId: string, caseId: string, grant?: Delegation): Authority {
  const agent = ctx.policy.agents[agentId];
  const own = ctx.policy.authorityTiers[agent.tier];
  const childAllows = (s: string) => matchesAny(agent.allowedServices, s);
  const rootId = grant ? grant.rootAgentId : agentId;
  const root = ctx.policy.agents[rootId];
  const caseRemaining = round4(root.budgets.perCase - spentOnCase(ctx, caseId, rootId));
  const dayRemaining = round4(root.budgets.perDay - spentToday(ctx, rootId));
  if (!grant) return { rootAgentId: agentId, tierId: agent.tier, tier: own, allows: childAllows, childAllows, caseRemaining, dayRemaining,
    remaining: Math.min(caseRemaining, dayRemaining), servicePatterns: agent.allowedServices };
  const parentGrant = grant.parentDelegationId ? ctx.store.delegations.get(grant.parentDelegationId) : undefined;
  const parent = authorityOf(ctx, grant.parentAgentId, caseId, parentGrant);
  const grantRemaining = round4(grant.amount - grantSpent(ctx, grant.id));
  return {
    rootAgentId: rootId, tierId: agent.tier, tier: stricter(own, parent.tier),
    allows: (s) => matchesAny(grant.services, s) && childAllows(s), childAllows, caseRemaining, dayRemaining, grantRemaining,
    remaining: Math.min(grantRemaining, caseRemaining, dayRemaining),
    servicePatterns: grant.services.filter((p) => agent.allowedServices.some((q) => covers(q, p))),
  };
}
