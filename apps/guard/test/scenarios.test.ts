import { describe, it, expect } from 'vitest';
import { mk, llm, svc } from './helpers.js';

describe('S1 Normal loan case', () => {
  it('auto-approves every small spend', async () => {
    const { spend, call } = await mk();
    const c = 'CASE-1001';
    for (const b of [llm(c), svc(c, 'kyc.id-verify'), svc(c, 'credit-bureau.score-pull'), llm(c)]) {
      const r = await spend(b);
      expect(r.decision.outcome).toBe('approve');
      expect(r.status).toBe('approved');
    }
    const state = (await call('GET', '/api/state')).body;
    expect(state.cases[0].byAgent[0].spent).toBeCloseTo(3.742, 3);
  });
});

describe('S2 Four-eyes', () => {
  it('escalates the $28 report and needs two distinct approvers', async () => {
    const { spend, act, call } = await mk();
    const c = 'CASE-1002';
    expect((await spend(llm(c))).decision.outcome).toBe('approve');
    expect((await spend(svc(c, 'kyc.id-verify'))).decision.outcome).toBe('approve');
    const big = await spend(svc(c, 'credit-bureau.full-report'));
    expect(big.decision).toMatchObject({ outcome: 'escalate', reasonCode: 'FOUR_EYES', ruleId: 'SG-04', approvalsRequired: 2 });
    expect(big.status).toBe('pending');

    const first = await act(big.requestId, 'approve', 'sofia');
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('pending');
    const again = await act(big.requestId, 'approve', 'sofia');
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('FOUR_EYES_SAME_APPROVER');
    const second = await act(big.requestId, 'approve', 'marco');
    expect(second.body.status).toBe('approved');

    expect((await call('GET', `/api/requests/${big.requestId}`)).body.request.status).toBe('approved');
    expect((await spend(llm(c))).decision.outcome).toBe('approve');
  });
});
