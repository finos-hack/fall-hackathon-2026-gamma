import { describe, it, expect } from 'vitest';
import { mk, llm } from './helpers.js';

describe('audit trail (SG-09)', () => {
  it('chains entries, verifies, exports CSV, and detects tampering', async () => {
    const { spend, call, ctx } = await mk();
    await spend(llm('C'));
    await spend(llm('C'));
    const v = (await call('GET', '/api/audit/verify')).body;
    expect(v.ok).toBe(true);
    expect(v.count).toBe(5); // POLICY_LOADED + 2 x (SPEND_REQUESTED, DECISION)

    const csv = (await call('GET', '/api/audit?format=csv')).body as string;
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('seq,ts,type,actor,caseId,agentId,onBehalfOf,service,amount,outcome,ruleId,reason,approver,aigfRisks,cccControl,calmControl,source,traceId,hash');
    expect(lines).toHaveLength(6);
    const cols = lines[0].split(',');
    const decisionRow = lines[3].split(',');
    expect(decisionRow[cols.indexOf('calmControl')]).toBe('agent-spend-guard#agent-spend-authority');
    expect(decisionRow[cols.indexOf('source')]).toBe('scripted');
    expect(decisionRow[cols.indexOf('cccControl')]).toBe(''); // filled in task 4.1

    (ctx.audit.entries[2].payload as Record<string, unknown>).amount = 0.0001;
    const broken = (await call('GET', '/api/audit/verify')).body;
    expect(broken).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
});
