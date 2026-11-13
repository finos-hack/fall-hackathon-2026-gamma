import { describe, it, expect } from 'vitest';
import { mk } from './helpers.js';

const val = (caseId: string, quantity: number, n: number, agentId = 'loan-agent') =>
  ({ caseId, agentId, kind: 'service', service: 'property.valuation', quantity, params: { comparable: `prop-${n}` } });

describe('S3 Structuring (SG-05)', () => {
  it('catches three $3 valuations that dodge the $5 signing limit, links the parts, and Sofia rejects', async () => {
    const { spend, call, clock, act } = await mk();
    const c = 'CASE-1003';
    const p1 = await spend(val(c, 2, 1)); clock.advance(20_000);
    const p2 = await spend(val(c, 2, 2)); clock.advance(20_000);
    expect(p1.decision.outcome).toBe('approve');
    expect(p2.decision.outcome).toBe('approve');

    const p3 = await spend(val(c, 2, 3));
    expect(p3.decision).toMatchObject({
      outcome: 'escalate', reasonCode: 'STRUCTURING', ruleId: 'SG-05', approvalsRequired: 1,
      linkedRequestIds: [p1.requestId, p2.requestId],
    });
    expect(p3.status).toBe('pending');

    const rej = await act(p3.requestId, 'reject', 'sofia');
    expect(rej.body.status).toBe('rejected');

    const audit = (await call('GET', '/api/audit')).body as { type: string; payload: Record<string, unknown> }[];
    const linked = audit.filter((e) => e.type === 'STRUCTURING_LINKED');
    expect(linked.map((e) => e.payload.requestId)).toEqual([p1.requestId, p2.requestId]);
    expect(linked.every((e) => e.payload.linkedTo === p3.requestId)).toBe(true);
    // earlier parts are flagged, not reversed
    expect((await call('GET', `/api/requests/${p1.requestId}`)).body.request.status).toBe('approved');
    expect((await call('GET', '/api/audit/verify')).body.ok).toBe(true);
  });

  it('does not trigger for parts below the near-threshold', async () => {
    const { spend } = await mk();
    for (let n = 1; n <= 4; n++) {
      const r = await spend(val('CASE-N', 1, n)); // $1.50 each, near = $2.50
      expect(r.decision.outcome).toBe('approve');
    }
  });

  it('does not trigger with fewer than minParts', async () => {
    const { spend } = await mk();
    expect((await spend(val('CASE-M', 2, 1))).decision.outcome).toBe('approve');
    expect((await spend(val('CASE-M', 2, 2))).decision.outcome).toBe('approve'); // only 2 parts
  });

  it('ignores parts older than the window', async () => {
    const { spend, clock } = await mk();
    await spend(val('CASE-T', 2, 1)); clock.advance(6 * 60_000);
    await spend(val('CASE-T', 2, 2)); clock.advance(6 * 60_000); // part 1 is now 12 min old
    expect((await spend(val('CASE-T', 2, 3))).decision.outcome).toBe('approve');
  });

  it('only groups the same case and the same service', async () => {
    const { spend } = await mk();
    await spend(val('CASE-A', 2, 1));
    await spend(val('CASE-B', 2, 2));
    expect((await spend(val('CASE-A', 2, 3))).decision.outcome).toBe('approve'); // other parts are in CASE-B
  });

  it('catches a purchase split across a helper agent (same root agent)', async () => {
    const { spend, call, clock } = await mk();
    const c = 'CASE-1006';
    const g = (await call('POST', '/api/delegations', { parentAgentId: 'loan-agent', childAgentId: 'fraud-agent', caseId: c, amount: 3, services: ['fraud-check.basic'] })).body;
    // different params on every buy, so SG-08 (duplicate) does not fire first
    const buy = (agentId: string, n: number, delegationId?: string) =>
      spend({ caseId: c, agentId, delegationId, kind: 'service', service: 'fraud-check.basic', params: { subject: n } });
    const p1 = await buy('loan-agent', 1); clock.advance(10_000); // $0.75, a normal buy for the T2 parent
    const p2 = await buy('fraud-agent', 2, g.delegationId); clock.advance(10_000);
    expect([p1, p2].map((x) => x.decision.outcome)).toEqual(['approve', 'approve']);
    const p3 = await buy('fraud-agent', 3, g.delegationId); // helper limit is $1: 3 x $0.75 = $2.25
    expect(p3.decision).toMatchObject({ outcome: 'escalate', reasonCode: 'STRUCTURING', ruleId: 'SG-05', linkedRequestIds: [p1.requestId, p2.requestId] });
  });
});
