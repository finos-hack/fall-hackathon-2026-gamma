import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mk, llm } from './helpers.js';

const grant = (caseId: string, extra = {}) => ({
  parentAgentId: 'loan-agent', childAgentId: 'fraud-agent', caseId, amount: 3, services: ['fraud-check.basic', 'llm.*'], ...extra,
});
const helperSvc = (caseId: string, delegationId: string, service: string, extra = {}) =>
  ({ caseId, agentId: 'fraud-agent', delegationId, kind: 'service', service, ...extra });

describe('S4 Delegation', () => {
  it('helper spends within the grant, from the parent budget; cannot exceed scope or re-delegate', async () => {
    const { spend, call } = await mk();
    const c = 'CASE-1004';
    const g = (await call('POST', '/api/delegations', grant(c))).body;
    expect(g).toMatchObject({ outcome: 'approve', reasonCode: 'GRANTED', status: 'active', ruleId: 'SG-06' });

    const a = await spend(llm(c, 'fraud-agent', { delegationId: g.delegationId }));
    expect(a.decision.outcome).toBe('approve');
    const b = await spend(helperSvc(c, g.delegationId, 'fraud-check.basic', { params: { n: 1 } }));
    expect(b.decision.outcome).toBe('approve');

    const state = (await call('GET', '/api/state')).body;
    const by = state.cases[0].byAgent as { agentId: string; spent: number }[];
    expect(by.some((x) => x.agentId === 'fraud-agent')).toBe(false); // one money owner
    expect(by.find((x) => x.agentId === 'loan-agent')!.spent).toBeCloseTo(0.021 + 0.75, 3);
    expect(state.delegations[0].spent).toBeCloseTo(0.771, 3);

    const enh = await spend(helperSvc(c, g.delegationId, 'fraud-check.enhanced'));
    expect(enh.decision).toMatchObject({ outcome: 'deny', reasonCode: 'DELEGATION_SCOPE', ruleId: 'SG-06' });
    // on its own authority the same purchase is allowed (and escalates above the T1 signing limit)
    const own = await spend({ caseId: c, agentId: 'fraud-agent', kind: 'service', service: 'fraud-check.enhanced' });
    expect(own.decision.outcome).toBe('escalate');

    const sub = await call('POST', '/api/delegations', { ...grant(c), parentAgentId: 'fraud-agent', childAgentId: 'fraud-agent', parentDelegationId: g.delegationId });
    expect(sub.body).toMatchObject({ outcome: 'deny', reasonCode: 'DELEGATION_NOT_PERMITTED' });
  });
});

describe('delegation edge cases', () => {
  it('denies a grant larger than the parent has left', async () => {
    const { call } = await mk();
    const r = (await call('POST', '/api/delegations', grant('CASE-D1', { amount: 45 }))).body;
    expect(r).toMatchObject({ outcome: 'deny', reasonCode: 'GRANT_EXCEEDS_PARENT', status: 'denied' });
  });

  it('denies a service the parent could not buy itself', async () => {
    const { call } = await mk();
    const r = (await call('POST', '/api/delegations', grant('CASE-D2', { services: ['fraud-check.enhanced'] }))).body;
    expect(r).toMatchObject({ outcome: 'deny', reasonCode: 'DELEGATION_SCOPE' });
  });

  it('a grant above the parent signing limit is pending until one approver signs; pending grants cannot be used', async () => {
    const { call, spend } = await mk();
    const c = 'CASE-D3';
    const g = (await call('POST', '/api/delegations', grant(c, { amount: 8 }))).body;
    expect(g).toMatchObject({ outcome: 'escalate', reasonCode: 'GRANT_ABOVE_SIGNING_LIMIT', status: 'pending' });
    const early = await spend(helperSvc(c, g.delegationId, 'fraud-check.basic'));
    expect(early.decision).toMatchObject({ outcome: 'deny', reasonCode: 'DELEGATION_INVALID' });

    expect((await call('POST', `/api/delegations/${g.delegationId}/approve`, { approverId: 'nobody' })).status).toBe(403);
    const ok = await call('POST', `/api/delegations/${g.delegationId}/approve`, { approverId: 'marco' });
    expect(ok.body.status).toBe('active');
    expect((await call('POST', `/api/delegations/${g.delegationId}/approve`, { approverId: 'sofia' })).status).toBe(409);
    expect((await spend(helperSvc(c, g.delegationId, 'fraud-check.basic'))).decision.outcome).toBe('approve');
  });

  it('a rejected pending grant is denied', async () => {
    const { call } = await mk();
    const g = (await call('POST', '/api/delegations', grant('CASE-D4', { amount: 8 }))).body;
    expect((await call('POST', `/api/delegations/${g.delegationId}/reject`, { approverId: 'sofia' })).body.status).toBe('denied');
  });

  it('denies spending beyond the grant (GRANT_EXCEEDED); a rejected pending request releases grant budget', async () => {
    const { call, spend, act } = await mk();
    const c = 'CASE-D5';
    const g = (await call('POST', '/api/delegations', grant(c, { amount: 1.2 }))).body;
    const a = await spend(helperSvc(c, g.delegationId, 'fraud-check.basic', { params: { n: 1 } }));
    expect(a.decision.outcome).toBe('approve'); // 0.75 of 1.20
    const b = await spend(helperSvc(c, g.delegationId, 'fraud-check.basic', { params: { n: 2 } }));
    expect(b.decision).toMatchObject({ outcome: 'deny', reasonCode: 'GRANT_EXCEEDED', ruleId: 'SG-06' });

    const g2 = (await call('POST', '/api/delegations', grant(c, { amount: 4.5 }))).body;
    const big = await spend(helperSvc(c, g2.delegationId, 'fraud-check.basic', { quantity: 4, params: { n: 3 } })); // $3.00 > T1 limit $1
    expect(big.decision).toMatchObject({ outcome: 'escalate', reasonCode: 'ABOVE_SIGNING_LIMIT' });
    expect((await spend(helperSvc(c, g2.delegationId, 'fraud-check.basic', { quantity: 3, params: { n: 4 } }))).decision.reasonCode).toBe('GRANT_EXCEEDED');
    await act(big.requestId, 'reject', 'sofia');
    expect((await spend(helperSvc(c, g2.delegationId, 'fraud-check.basic', { quantity: 3, params: { n: 5 } }))).decision.outcome).toBe('escalate');
  });

  it('rejects a delegation for another case, another agent or an unknown id; expires after the TTL', async () => {
    const { call, spend, clock } = await mk();
    const g = (await call('POST', '/api/delegations', grant('CASE-D6', { ttlMinutes: 5 }))).body;
    expect((await spend(helperSvc('CASE-OTHER', g.delegationId, 'fraud-check.basic'))).decision.reasonCode).toBe('DELEGATION_INVALID');
    expect((await spend({ caseId: 'CASE-D6', agentId: 'loan-agent', delegationId: g.delegationId, kind: 'service', service: 'kyc.id-verify' }))
      .decision.reasonCode).toBe('DELEGATION_INVALID');
    expect((await spend(helperSvc('CASE-D6', 'dlg-9999', 'fraud-check.basic'))).decision.reasonCode).toBe('DELEGATION_INVALID');
    clock.advance(6 * 60_000);
    expect((await spend(helperSvc('CASE-D6', g.delegationId, 'fraud-check.basic'))).decision.reasonCode).toBe('DELEGATION_INVALID');
  });

  it('denies grants and delegated spend when the parent is suspended', async () => {
    const { call, spend } = await mk();
    const c = 'CASE-D7';
    const g = (await call('POST', '/api/delegations', grant(c))).body;
    for (let i = 0; i < 6; i++) await spend(llm(c, 'loan-agent', { promptHash: 'same', inputTokens: 10, outputTokens: 10 }));
    const agents = (await call('GET', '/api/state')).body.agents as { agentId: string; suspended: boolean }[];
    expect(agents.find((a) => a.agentId === 'loan-agent')!.suspended).toBe(true);
    expect((await spend(helperSvc(c, g.delegationId, 'fraud-check.basic'))).decision.reasonCode).toBe('AGENT_SUSPENDED');
    expect((await call('POST', '/api/delegations', grant(c))).body).toMatchObject({ outcome: 'deny', reasonCode: 'AGENT_SUSPENDED' });
  });

  it('audit records grants and the chain still verifies', async () => {
    const { call } = await mk();
    await call('POST', '/api/delegations', grant('CASE-D8'));
    await call('POST', '/api/delegations', grant('CASE-D8', { amount: 99 }));
    const types = ((await call('GET', '/api/audit')).body as { type: string }[]).map((e) => e.type);
    expect(types).toContain('DELEGATION_GRANTED');
    expect(types).toContain('DELEGATION_DENIED');
    expect((await call('GET', '/api/audit/verify')).body.ok).toBe(true);
  });

  it('denies a chain deeper than maxDepth', async () => {
    const src = readFileSync(new URL('../../../policies/loan-approval.policy.yaml', import.meta.url), 'utf8')
      .replace('canDelegateTo: []', 'canDelegateTo: [loan-agent]');
    const policyPath = join(mkdtempSync(join(tmpdir(), 'sg-')), 'p.yaml');
    writeFileSync(policyPath, src);
    const { call } = await mk({ policyPath });
    const g = (await call('POST', '/api/delegations', grant('CASE-D9'))).body;
    const deeper = await call('POST', '/api/delegations', {
      parentAgentId: 'fraud-agent', childAgentId: 'loan-agent', caseId: 'CASE-D9', amount: 1, services: ['llm.*'], parentDelegationId: g.delegationId });
    expect(deeper.body).toMatchObject({ outcome: 'deny', reasonCode: 'DELEGATION_DEPTH' });
  });
});
