import { createHash } from 'node:crypto';
import { computeAmount } from '../policy/pricing.js';
import { matchesAny } from '../policy/glob.js';
import { canonical } from '../store/audit.js';
import type { Decision, Outcome, RuleResult, SpendInput, SpendRequest } from '../types.js';
import { CALM_CONTROL, ownAuthority, round4, type Ctx } from './authority.js';

const hash16 = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex').slice(0, 16);
const usd = (n: number) => `$${n.toFixed(2)}`;

export function evaluate(ctx: Ctx, input: SpendInput): { request: SpendRequest; decision: Decision } {
  const { policy, store, clock } = ctx;
  const ts = clock.now().toISOString();
  const ids = ctx.traces.newIds();
  const control = (id: string) => policy.controls.find((c) => c.id === id);
  const enabled = (id: string) => control(id)?.enabled !== false;

  const priced = computeAmount(policy, input);
  const agent = policy.agents[input.agentId];
  const request: SpendRequest = {
    id: store.nextId(), ts, caseId: input.caseId, agentId: input.agentId,
    delegationId: input.delegationId, rootAgentId: input.agentId,
    kind: input.kind, service: input.service,
    inputTokens: input.inputTokens, outputTokens: input.outputTokens, promptHash: input.promptHash,
    quantity: input.quantity, params: input.params, paramsHash: hash16(input.params ?? {}),
    amount: priced ?? 0, currency: 'USD', purpose: input.purpose ?? '', source: input.source ?? 'scripted',
    status: 'denied', ...ids,
  };
  ctx.audit.append('SPEND_REQUESTED', input.agentId, { ...refsFor(ctx, request, undefined), requestId: request.id }, ts);
  ctx.emit('request', request);

  const trace: RuleResult[] = [];
  const step = (ruleId: string, result: RuleResult['result'], detail?: string) => {
    const c = control(ruleId);
    trace.push({ ruleId, result, detail, aigf: c?.aigf, ccc: c?.ccc });
  };
  const auth = agent ? ownAuthority(ctx, input.agentId, input.caseId) : undefined;
  const snapshot = { tier: agent?.tier ?? '-', autoApproveUpTo: auth?.tier.autoApproveUpTo ?? 0, remaining: auth?.remaining ?? 0 };

  const finish = (outcome: Outcome, reasonCode: string, reason: string, ruleId?: string, approvalsRequired?: 0 | 1 | 2) => {
    const decision: Decision = {
      requestId: request.id, outcome, reasonCode, reason, ruleId, ruleTrace: trace, approvalsRequired,
      policyVersion: policy.metadata.version, evaluatedAt: ts, calmControl: CALM_CONTROL, limitsSnapshot: snapshot,
    };
    request.status = outcome === 'approve' ? 'approved' : outcome === 'deny' ? 'denied' : 'pending';
    store.requests.set(request.id, request);
    store.decisions.set(request.id, decision);
    ctx.audit.append('DECISION', 'spend-guard', { ...refsFor(ctx, request, decision), requestId: request.id }, ts);
    recordSpan(ctx, request, decision);
    ctx.emit('decision', { request, decision });
    return { request, decision };
  };
  const deny = (code: string, reason: string, ruleId?: string) => finish('deny', code, reason, ruleId);

  // 0 unknown agent / service
  if (!agent || !auth) return deny('UNKNOWN_AGENT', `Agent "${input.agentId}" is not registered in the delegation-of-authority policy.`);
  if (priced === null) return deny('UNKNOWN_SERVICE', `"${input.service}" is not a priced service in the policy.`);

  // 1 suspended
  if (store.suspended(input.agentId)) {
    step('SG-07', 'fail', 'agent suspended');
    return deny('AGENT_SUSPENDED', `${input.agentId} is frozen by the kill switch. Only a human can resume it.`, 'SG-07');
  }
  step('SG-07', 'pass', 'agent active');

  // 2 delegation (grants arrive in task 2.3: any delegationId is unknown for now)
  if (input.delegationId) {
    step('SG-06', 'fail', `delegation ${input.delegationId} not found`);
    return deny('DELEGATION_INVALID', `Delegation "${input.delegationId}" is not valid.`, 'SG-06');
  }
  step('SG-06', 'skip', 'no delegation');

  // 3 service allow-list
  if (enabled('SG-01')) {
    if (!matchesAny(agent.allowedServices, input.service)) {
      step('SG-01', 'fail', `${input.service} not in allow-list`);
      return deny('SERVICE_NOT_ALLOWED', `${input.agentId} is not permitted to buy "${input.service}" (outside its allowed services).`, 'SG-01');
    }
    step('SG-01', 'pass');
  } else step('SG-01', 'skip', 'disabled');

  // 4 runaway circuit breaker (requests before the last resume are ignored)
  if (enabled('SG-07')) {
    const p = control('SG-07')?.params ?? {};
    const maxSame = Number(p.maxIdenticalRequests ?? 5);
    const maxPerMin = Number(p.maxRequestsPerMinute ?? 30);
    const windowMs = Number(p.windowSeconds ?? 60) * 1000;
    const nowMs = Date.parse(ts);
    const resumedAt = store.agents.get(input.agentId)?.resumedAtSeq ?? 0;
    const mine = [...store.requests.values()].filter((r) => r.agentId === input.agentId && Number(r.id.slice(4)) > resumedAt);
    const lastMinute = mine.filter((r) => Date.parse(r.ts) >= nowMs - 60_000);
    const identical = mine.filter((r) => Date.parse(r.ts) >= nowMs - windowMs && r.service === input.service &&
      (input.kind === 'llm' ? input.promptHash !== undefined && r.promptHash === input.promptHash : r.paramsHash === request.paramsHash));
    if (identical.length >= maxSame || lastMinute.length >= maxPerMin) {
      const why = identical.length >= maxSame
        ? `${identical.length} identical requests in ${windowMs / 1000}s` : `${lastMinute.length} requests in the last minute`;
      const burn = round4(lastMinute.filter((r) => r.status === 'approved' || r.status === 'pending')
        .reduce((s, r) => s + r.amount, 0) * 60);
      step('SG-07', 'fail', why);
      const state = { agentId: input.agentId, suspended: true, suspendedReason: why, projectedHourlyBurn: burn,
        resumedAtSeq: store.agents.get(input.agentId)?.resumedAtSeq };
      store.agents.set(input.agentId, state);
      ctx.audit.append('AGENT_SUSPENDED', 'spend-guard', { agentId: input.agentId, caseId: input.caseId, reason: why, projectedHourlyBurn: burn,
        ruleId: 'SG-07', requestId: request.id }, ts);
      ctx.emit('agent', state);
      return deny('RUNAWAY', `${input.agentId} looks like a runaway loop (${why}, projected ${usd(burn)}/hour) and has been frozen. Only a human can resume it.`, 'SG-07');
    }
    step('SG-07', 'pass', `${identical.length} identical, ${lastMinute.length}/min`);
  } else step('SG-07', 'skip', 'disabled');

  // 5 duplicate (service kind only)
  if (input.kind === 'service' && enabled('SG-08')) {
    const windowMs = Number(control('SG-08')?.params?.windowSeconds ?? 60) * 1000;
    const dup = [...store.requests.values()].find((r) =>
      (r.status === 'approved' || r.status === 'pending') && r.agentId === request.agentId && r.caseId === request.caseId &&
      r.service === request.service && r.paramsHash === request.paramsHash && Date.parse(r.ts) >= Date.parse(ts) - windowMs);
    if (dup) {
      step('SG-08', 'fail', `same as ${dup.id}`);
      return deny('DUPLICATE', `Duplicate purchase of "${input.service}" with the same parameters within a minute (see ${dup.id}).`, 'SG-08');
    }
    step('SG-08', 'pass');
  } else step('SG-08', 'skip', input.kind === 'llm' ? 'llm request' : 'disabled');

  // 6 budgets
  if (enabled('SG-02')) {
    if (request.amount > auth.remaining) {
      const caseBinds = auth.caseRemaining <= auth.dayRemaining;
      step('SG-02', 'fail', `${usd(request.amount)} > ${usd(auth.remaining)} remaining`);
      return deny(caseBinds ? 'CASE_BUDGET' : 'DAY_BUDGET',
        `Would exceed the ${caseBinds ? 'case' : 'daily'} budget: ${usd(request.amount)} requested, ${usd(Math.max(auth.remaining, 0))} left.`, 'SG-02');
    }
    step('SG-02', 'pass', `${usd(auth.remaining)} remaining`);
  } else step('SG-02', 'skip', 'disabled');

  // 7 delegation-of-authority thresholds, four-eyes
  const t = auth.tier;
  if (enabled('SG-03')) {
    if (request.amount > t.escalateUpTo) {
      step('SG-03', 'fail', `${usd(request.amount)} > ceiling ${usd(t.escalateUpTo)}`);
      return deny('ABOVE_DELEGATED_AUTHORITY',
        `${usd(request.amount)} is outside ${input.agentId}'s delegated authority (ceiling ${usd(t.escalateUpTo)}).`, 'SG-03');
    }
    if (request.amount > t.autoApproveUpTo) {
      step('SG-03', 'fail', `${usd(request.amount)} > signing limit ${usd(t.autoApproveUpTo)}`);
      if (enabled('SG-04') && t.fourEyesAbove !== null && request.amount > t.fourEyesAbove) {
        step('SG-04', 'fail', `${usd(request.amount)} > ${usd(t.fourEyesAbove)}`);
        return finish('escalate', 'FOUR_EYES',
          `${usd(request.amount)} is above ${usd(t.fourEyesAbove)}: two distinct approvers are required (four-eyes).`, 'SG-04', 2);
      }
      return finish('escalate', 'ABOVE_SIGNING_LIMIT',
        `${usd(request.amount)} is above the signing limit of ${usd(t.autoApproveUpTo)}: a human approver must sign off.`, 'SG-03', 1);
    }
    step('SG-03', 'pass', `within signing limit ${usd(t.autoApproveUpTo)}`);
  } else step('SG-03', 'skip', 'disabled');
  step('SG-04', 'pass');

  // 8 structuring (task 2.2)
  step('SG-05', 'skip', 'structuring check not enabled yet');

  // 9 approve
  return finish('approve', 'APPROVED', `Within ${input.agentId}'s signing limit (${usd(t.autoApproveUpTo)}) and budget.`);
}

/** Flat payload used by audit entries and the CSV export. */
export function refsFor(ctx: Ctx, r: SpendRequest, d?: Decision) {
  const fired = d?.ruleId ? ctx.policy.controls.find((c) => c.id === d.ruleId) : undefined;
  const risks = fired?.aigf.risks ?? [...new Set((d?.ruleTrace ?? []).flatMap((x) => x.aigf?.risks ?? []))];
  const audit = ctx.policy.controls.find((c) => c.id === 'SG-09');
  return {
    caseId: r.caseId, agentId: r.agentId, onBehalfOf: r.rootAgentId !== r.agentId ? r.rootAgentId : undefined,
    service: r.service, amount: r.amount, outcome: d?.outcome, reasonCode: d?.reasonCode, ruleId: d?.ruleId, reason: d?.reason,
    aigfRisks: risks, cccControl: fired?.ccc ?? audit?.ccc, calmControl: CALM_CONTROL, source: r.source, traceId: r.traceId,
  };
}

export function recordSpan(ctx: Ctx, r: SpendRequest, d: Decision) {
  const refs = refsFor(ctx, r, d);
  const mitigations = [...new Set(d.ruleTrace.flatMap((x) => x.aigf?.mitigations ?? []))];
  ctx.traces.record({ traceId: r.traceId, spanId: r.spanId }, r.ts, {
    'gen_ai.agent.id': r.agentId,
    'gen_ai.request.model': r.kind === 'llm' ? r.service : undefined,
    'gen_ai.usage.input_tokens': r.inputTokens, 'gen_ai.usage.output_tokens': r.outputTokens,
    'spendguard.case_id': r.caseId, 'spendguard.service': r.service, 'spendguard.amount': round4(r.amount),
    'spendguard.currency': r.currency, 'spendguard.decision': d.outcome, 'spendguard.reason_code': d.reasonCode,
    'spendguard.rule_id': d.ruleId, 'spendguard.source': r.source,
    'spendguard.delegation.parent_agent_id': undefined, 'spendguard.delegation.root_agent_id': r.rootAgentId,
    'spendguard.policy.version': d.policyVersion,
    'aigf.risk_ids': refs.aigfRisks.join(','), 'aigf.mitigation_ids': mitigations.join(','),
    'ccc.control_id': refs.cccControl, 'calm.node_id': 'agent-spend-guard', 'calm.control_id': 'agent-spend-authority',
  }, d.outcome === 'deny', d.outcome === 'escalate' ? [{ name: 'escalated', attrs: { approvals_required: d.approvalsRequired } }] : []);
}
