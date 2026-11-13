import { HttpError, type Approval, type Decision, type SpendRequest } from '../types.js';
import { refsFor } from './evaluate.js';
import type { Ctx } from './authority.js';

export const APPROVAL_TTL_MS = 15 * 60 * 1000;

/** Pending requests older than 15 minutes expire (counted as denied, budget released). */
export function sweepExpired(ctx: Ctx) {
  const now = ctx.clock.now();
  for (const r of ctx.store.requests.values()) {
    if (r.status !== 'pending' || Date.parse(r.ts) + APPROVAL_TTL_MS > now.getTime()) continue;
    r.status = 'expired';
    const d = ctx.store.decisions.get(r.id);
    ctx.audit.append('REQUEST_EXPIRED', 'spend-guard', { ...refsFor(ctx, r, d), requestId: r.id }, now.toISOString());
    ctx.traces.addEvent(r.spanId, now.toISOString(), 'expired', {});
    ctx.emit('approval', { request: r, decision: d, approvals: ctx.store.approvalsFor(r.id) });
  }
}

function pendingOrThrow(ctx: Ctx, id: string): { request: SpendRequest; decision: Decision } {
  sweepExpired(ctx);
  const request = ctx.store.requests.get(id);
  const decision = ctx.store.decisions.get(id);
  if (!request || !decision) throw new HttpError(404, 'NOT_FOUND', `Request ${id} not found`);
  if (request.status !== 'pending') throw new HttpError(409, 'NOT_PENDING', `Request ${id} is ${request.status}`);
  return { request, decision };
}

function approverFor(ctx: Ctx, approverId: string, decision: Decision) {
  const approver = ctx.policy.approvers.find((a) => a.id === approverId);
  if (!approver) throw new HttpError(403, 'UNKNOWN_APPROVER', `Unknown approver "${approverId}"`);
  const roles = ctx.policy.authorityTiers[decision.limitsSnapshot.tier]?.approverRoles ?? [];
  if (!roles.includes(approver.role))
    throw new HttpError(403, 'ROLE_NOT_ALLOWED', `Role "${approver.role}" may not approve this request (allowed: ${roles.join(', ')})`);
  return approver;
}

function act(ctx: Ctx, id: string, approverId: string, action: 'approve' | 'reject', comment?: string) {
  const { request, decision } = pendingOrThrow(ctx, id);
  const approver = approverFor(ctx, approverId, decision);
  const prior = ctx.store.approvalsFor(id);
  if (action === 'approve' && prior.some((a) => a.approverId === approverId))
    throw new HttpError(409, 'FOUR_EYES_SAME_APPROVER', `${approver.name} already approved this request; a second, different approver is required`);

  const ts = ctx.clock.now().toISOString();
  const rec: Approval = { requestId: id, approverId, role: approver.role, action, comment, ts };
  ctx.store.approvals.push(rec);
  const given = prior.length + 1;
  const required = decision.approvalsRequired ?? 1;
  if (action === 'reject') request.status = 'rejected';
  else if (given >= required) request.status = 'approved';

  ctx.audit.append(action === 'approve' ? 'APPROVAL_GIVEN' : 'APPROVAL_REJECTED', approverId,
    { ...refsFor(ctx, request, decision), requestId: id, approver: approverId, role: approver.role, comment,
      approvalsGiven: given, approvalsRequired: required, status: request.status }, ts);
  ctx.traces.addEvent(request.spanId, ts, action === 'approve' ? 'approved_by' : 'rejected_by', { approver: approverId, role: approver.role });
  const out = { request, decision, approvals: ctx.store.approvalsFor(id) };
  ctx.emit('approval', out);
  return out;
}

export const approve = (ctx: Ctx, id: string, approverId: string, comment?: string) => act(ctx, id, approverId, 'approve', comment);
export const reject = (ctx: Ctx, id: string, approverId: string, comment?: string) => act(ctx, id, approverId, 'reject', comment);

export function resumeAgent(ctx: Ctx, agentId: string, approverId: string) {
  if (!ctx.policy.agents[agentId]) throw new HttpError(404, 'UNKNOWN_AGENT', `Unknown agent "${agentId}"`);
  if (!ctx.policy.approvers.some((a) => a.id === approverId)) throw new HttpError(403, 'UNKNOWN_APPROVER', `Unknown approver "${approverId}"`);
  const state = { agentId, suspended: false, resumedAtSeq: ctx.store.seq };
  ctx.store.agents.set(agentId, state);
  ctx.audit.append('AGENT_RESUMED', approverId, { agentId, approver: approverId }, ctx.clock.now().toISOString());
  ctx.emit('agent', state);
  return state;
}
