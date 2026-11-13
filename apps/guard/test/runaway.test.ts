import { describe, it, expect } from 'vitest';
import { mk } from './helpers.js';

const loop = (extra = {}) => ({
  caseId: 'CASE-1005', agentId: 'loan-agent', kind: 'llm', service: 'llm.premium',
  inputTokens: 8000, outputTokens: 2000, promptHash: 'same-prompt', ...extra,
});

describe('S5 Runaway agent (SG-07)', () => {
  it('cuts off the loop on request 6, keeps the agent frozen, and resume works', async () => {
    const { spend, call, clock } = await mk();
    for (let i = 1; i <= 5; i++) {
      const r = await spend(loop());
      expect(r.decision.outcome, `request ${i}`).toBe('approve');
      clock.advance(250);
    }
    const sixth = await spend(loop());
    expect(sixth.decision).toMatchObject({ outcome: 'deny', reasonCode: 'RUNAWAY', ruleId: 'SG-07' });

    let agent = (await call('GET', '/api/state')).body.agents.find((a: { agentId: string }) => a.agentId === 'loan-agent');
    expect(agent.suspended).toBe(true);
    expect(agent.projectedHourlyBurn).toBeCloseTo(0.27 * 5 * 60, 2); // five $0.27 calls in the last minute

    clock.advance(250);
    const seventh = await spend(loop({ promptHash: 'other' }));
    expect(seventh.decision).toMatchObject({ outcome: 'deny', reasonCode: 'AGENT_SUSPENDED' });

    const bad = await call('POST', '/api/agents/loan-agent/resume', { approverId: 'nobody' });
    expect(bad.status).toBe(403);
    expect((await call('POST', '/api/agents/loan-agent/resume', { approverId: 'sofia' })).status).toBe(200);
    agent = (await call('GET', '/api/state')).body.agents.find((a: { agentId: string }) => a.agentId === 'loan-agent');
    expect(agent.suspended).toBe(false);

    // Same loop request right after resume: must not re-trip on the old identical requests.
    const after = await spend(loop());
    expect(after.decision.outcome).toBe('approve');
  });

  it('records suspend and resume in the audit log', async () => {
    const { spend, call, clock } = await mk();
    for (let i = 0; i < 6; i++) { await spend(loop()); clock.advance(250); }
    await call('POST', '/api/agents/loan-agent/resume', { approverId: 'sofia' });
    const types = (await call('GET', '/api/audit')).body.map((e: { type: string }) => e.type);
    expect(types).toContain('AGENT_SUSPENDED');
    expect(types).toContain('AGENT_RESUMED');
    expect((await call('GET', '/api/audit/verify')).body.ok).toBe(true);
  });

  it('also trips on too many requests per minute (distinct prompts)', async () => {
    const { spend } = await mk();
    for (let i = 0; i < 30; i++) {
      const r = await spend(loop({ service: 'llm.standard', inputTokens: 100, outputTokens: 10, promptHash: `p${i}`, caseId: `C${i}` }));
      expect(r.decision.outcome, `request ${i}`).toBe('approve');
    }
    const r = await spend(loop({ service: 'llm.standard', inputTokens: 100, outputTokens: 10, promptHash: 'p-last', caseId: 'C-last' }));
    expect(r.decision).toMatchObject({ reasonCode: 'RUNAWAY' });
  });

  it('does not treat different services with empty params as identical', async () => {
    const { spend } = await mk();
    for (let i = 0; i < 4; i++) {
      await spend({ caseId: `K${i}`, agentId: 'loan-agent', kind: 'service', service: 'kyc.id-verify' });
      await spend({ caseId: `K${i}`, agentId: 'loan-agent', kind: 'service', service: 'credit-bureau.score-pull' });
    }
    const r = await spend({ caseId: 'K9', agentId: 'loan-agent', kind: 'service', service: 'property.valuation' });
    expect(r.decision.outcome).toBe('approve');
  });
});
