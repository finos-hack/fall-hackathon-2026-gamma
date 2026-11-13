import { HttpError, type Delegation, type Outcome } from '../types.js';
import { authorityOf, CALM_CONTROL, covers, grantStatus, type Ctx } from './authority.js';

export interface GrantInput {
  parentAgentId: string; childAgentId: string; caseId: string; amount: number;
  services: string[]; ttlMinutes?: number; parentDelegationId?: string;
}
export interface GrantResult { delegation: Delegation; outcome: Outcome; reasonCode: string; reason: string; ruleId: 'SG-06' }

const usd = (n: number) => `$${n.toFixed(2)}`;

function audit(ctx: Ctx, type: 'DELEGATION_GRANTED' | 'DELEGATION_DENIED', actor: string, d: Delegation, extra: Record<string, unknown>) {
  const c = ctx.policy.controls.find((x) => x.id === 'SG-06');
  ctx.audit.append(type, actor, {
    delegationId: d.id, caseId: d.caseId, agentId: d.parentAgentId, childAgentId: d.childAgentId, onBehalfOf: d.rootAgentId,
    amount: d.amount, services: d.services, depth: d.depth, status: d.status, ruleId: 'SG-06',
    aigfRisks: c?.aigf.risks, cccControl: c?.ccc, calmControl: CALM_CONTROL, ...extra,
  }, ctx.clock.now().toISOString());
}

/** SG-06: create a grant (D1-D5). Denied grants are stored too, so they show up in the audit and the UI. */
export function createGrant(ctx: Ctx, input: GrantInput): GrantResult {
  const { policy, store, clock } = ctx;
  const parent = policy.agents[input.parentAgentId];
  const child = policy.agents[input.childAgentId];
  if (!parent) throw new HttpError(404, 'UNKNOWN_AGENT', `Unknown agent "${input.parentAgentId}"`);
  if (!child) throw new HttpError(404, 'UNKNOWN_AGENT', `Unknown agent "${input.childAgentId}"`);

  const now = clock.now();
  const pg = input.parentDelegationId ? store.delegations.get(input.parentDelegationId) : undefined;
  const d: Delegation = {
    id: store.nextDelegationId(), parentAgentId: input.parentAgentId, childAgentId: input.childAgentId,
    rootAgentId: pg?.rootAgentId ?? input.parentAgentId, caseId: input.caseId, amount: input.amount, spent: 0,
    services: input.services, depth: (pg?.depth ?? 0) + 1, status: 'denied', createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input.ttlMinutes ?? policy.delegation.defaultTtlMinutes) * 60_000).toISOString(),
    parentDelegationId: input.parentDelegationId,
  };
  store.delegations.set(d.id, d);
  const result = (outcome: Outcome, reasonCode: string, reason: string): GrantResult => {
    d.status = outcome === 'approve' ? 'active' : outcome === 'escalate' ? 'pending' : 'denied';
    audit(ctx, d.status === 'denied' ? 'DELEGATION_DENIED' : 'DELEGATION_GRANTED', 'spend-guard', d, { outcome, reasonCode, reason });
    ctx.emit('delegation', d);
    return { delegation: d, outcome, reasonCode, reason, ruleId: 'SG-06' };
  };
  const deny = (code: string, reason: string) => result('deny', code, reason);

  if (input.parentDelegationId && (!pg || grantStatus(ctx, pg) !== 'active' || pg.childAgentId !== input.parentAgentId || pg.caseId !== input.caseId))
    return deny('DELEGATION_INVALID', `Parent delegation "${input.parentDelegationId}" is not valid for ${input.parentAgentId} on ${input.caseId}.`);
  const frozen = [input.parentAgentId, d.rootAgentId].find((a) => store.suspended(a));
  if (frozen) return deny('AGENT_SUSPENDED', `${frozen} is frozen by the kill switch: it cannot delegate authority.`);

  // D1 the policy must allow this hand-over
  if (!parent.canDelegateTo.includes(input.childAgentId))
    return deny('DELEGATION_NOT_PERMITTED', `${input.parentAgentId} is not permitted to delegate to ${input.childAgentId}.`);
  // D2 depth and cycles
  const chain = new Set<string>([input.parentAgentId]);
  for (let g = pg; g; g = g.parentDelegationId ? store.delegations.get(g.parentDelegationId) : undefined) chain.add(g.parentAgentId);
  if (d.depth > policy.delegation.maxDepth || chain.has(input.childAgentId))
    return deny('DELEGATION_DEPTH', `Delegation chain would be ${d.depth} deep (maximum ${policy.delegation.maxDepth}) or loops back to a delegator.`);
  // D3 scope: no service the parent could not buy itself
  const auth = authorityOf(ctx, input.parentAgentId, input.caseId, pg);
  const outside = input.services.find((p) => !auth.servicePatterns.some((q) => covers(q, p)));
  if (outside) return deny('DELEGATION_SCOPE', `${input.parentAgentId} cannot pass on "${outside}": it is outside its own authority.`);
  // D4 amount within what the parent still has
  if (input.amount > auth.remaining)
    return deny('GRANT_EXCEEDS_PARENT', `Grant of ${usd(input.amount)} exceeds what ${input.parentAgentId} has left (${usd(Math.max(auth.remaining, 0))}).`);
  // D5 above the parent's signing limit a human must approve the grant
  d.approverRoles = auth.tier.approverRoles;
  if (input.amount > auth.tier.autoApproveUpTo)
    return result('escalate', 'GRANT_ABOVE_SIGNING_LIMIT',
      `Grant of ${usd(input.amount)} is above ${input.parentAgentId}'s signing limit of ${usd(auth.tier.autoApproveUpTo)}: a human must approve it.`);
  return result('approve', 'GRANTED', `${input.parentAgentId} delegated ${usd(input.amount)} to ${input.childAgentId} for ${input.services.join(', ')}.`);
}

/** Single approval (or rejection) of a pending grant by an approver whose role the parent's tier allows. */
export function actOnGrant(ctx: Ctx, id: string, approverId: string, action: 'approve' | 'reject', comment?: string) {
  const d = ctx.store.delegations.get(id);
  if (!d) throw new HttpError(404, 'NOT_FOUND', `Delegation ${id} not found`);
  if (grantStatus(ctx, d) !== 'pending') throw new HttpError(409, 'NOT_PENDING', `Delegation ${id} is ${d.status}`);
  const approver = ctx.policy.approvers.find((a) => a.id === approverId);
  if (!approver) throw new HttpError(403, 'UNKNOWN_APPROVER', `Unknown approver "${approverId}"`);
  const roles = d.approverRoles ?? [];
  if (!roles.includes(approver.role))
    throw new HttpError(403, 'ROLE_NOT_ALLOWED', `Role "${approver.role}" may not approve this delegation (allowed: ${roles.join(', ')})`);
  d.status = action === 'approve' ? 'active' : 'denied';
  audit(ctx, action === 'approve' ? 'DELEGATION_GRANTED' : 'DELEGATION_DENIED', approverId, d,
    { approver: approverId, role: approver.role, comment, outcome: action === 'approve' ? 'approve' : 'deny',
      reasonCode: action === 'approve' ? 'GRANT_APPROVED' : 'GRANT_REJECTED' });
  ctx.emit('delegation', d);
  return d;
}
