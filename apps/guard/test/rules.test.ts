import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { DEFAULT_POLICY_PATH } from '../src/policy/load.js';
import { mk, llm, svc } from './helpers.js';

describe('guard rules', () => {
  it('denies an unknown service and unknown agent', async () => {
    const { spend } = await mk();
    expect((await spend(svc('C', 'nope.service'))).decision.reasonCode).toBe('UNKNOWN_SERVICE');
    expect((await spend(llm('C', 'ghost'))).decision.reasonCode).toBe('UNKNOWN_AGENT');
  });

  it('denies a service outside the allow-list (SG-01)', async () => {
    const { spend } = await mk();
    const r = await spend(svc('C', 'fraud-check.enhanced'));
    expect(r.decision).toMatchObject({ outcome: 'deny', reasonCode: 'SERVICE_NOT_ALLOWED', ruleId: 'SG-01' });
  });

  it('denies above the tier ceiling as outside delegated authority', async () => {
    const { spend } = await mk();
    const r = await spend({ caseId: 'C', agentId: 'fraud-agent', kind: 'service', service: 'fraud-check.enhanced', quantity: 2 });
    expect(r.decision).toMatchObject({ outcome: 'deny', reasonCode: 'ABOVE_DELEGATED_AUTHORITY', ruleId: 'SG-03' });
  });

  it('escalates above the signing limit with one approval; wrong role is refused', async () => {
    const { spend, act } = await mk();
    const r = await spend({ caseId: 'C', agentId: 'fraud-agent', kind: 'service', service: 'fraud-check.enhanced' });
    expect(r.decision).toMatchObject({ outcome: 'escalate', reasonCode: 'ABOVE_SIGNING_LIMIT', approvalsRequired: 1 });
    expect((await act(r.requestId, 'approve', 'marco')).status).toBe(403); // head-of-lending is not a T1 approver
    expect((await act(r.requestId, 'approve', 'sofia')).body.status).toBe('approved');
  });

  it('enforces the case budget; pending reserves, reject releases', async () => {
    const { spend, act } = await mk();
    const c = 'CASE-B';
    const a = await spend(svc(c, 'credit-bureau.full-report')); // 28, pending
    expect(a.status).toBe('pending');
    const b = await spend(svc(c, 'credit-bureau.full-report', { params: { n: 2 } })); // 28 more > 40
    expect(b.decision).toMatchObject({ outcome: 'deny', reasonCode: 'CASE_BUDGET', ruleId: 'SG-02' });
    await act(a.requestId, 'reject', 'sofia');
    const d = await spend(svc(c, 'credit-bureau.full-report', { params: { n: 3 } }));
    expect(d.decision.outcome).toBe('escalate'); // budget released
  });

  it('enforces the daily budget', async () => {
    const o = parse(readFileSync(DEFAULT_POLICY_PATH, 'utf8'));
    o.agents['loan-agent'].budgets.perDay = 3;
    const file = join(mkdtempSync(join(tmpdir(), 'sg-')), 'p.yaml');
    writeFileSync(file, stringify(o));
    const { spend } = await mk({ policyPath: file });
    expect((await spend(svc('C1', 'credit-bureau.score-pull'))).decision.outcome).toBe('approve');
    const r = await spend(svc('C2', 'credit-bureau.score-pull'));
    expect(r.decision).toMatchObject({ outcome: 'deny', reasonCode: 'DAY_BUDGET' });
  });

  it('denies a duplicate purchase within 60 s, allows it later or with other params', async () => {
    const { spend, clock } = await mk();
    const c = 'CASE-D';
    expect((await spend(svc(c, 'kyc.id-verify', { params: { id: 1 } }))).decision.outcome).toBe('approve');
    const dup = await spend(svc(c, 'kyc.id-verify', { params: { id: 1 } }));
    expect(dup.decision).toMatchObject({ outcome: 'deny', reasonCode: 'DUPLICATE', ruleId: 'SG-08' });
    expect((await spend(svc(c, 'kyc.id-verify', { params: { id: 2 } }))).decision.outcome).toBe('approve');
    clock.advance(61_000);
    expect((await spend(svc(c, 'kyc.id-verify', { params: { id: 1 } }))).decision.outcome).toBe('approve');
  });

  it('expires pending requests after 15 minutes and releases the budget', async () => {
    const { spend, call, clock, act } = await mk();
    const a = await spend(svc('CASE-E', 'credit-bureau.full-report'));
    clock.advance(16 * 60_000);
    expect((await call('GET', `/api/requests/${a.requestId}`)).body.request.status).toBe('expired');
    expect((await act(a.requestId, 'approve', 'sofia')).status).toBe(409);
    expect((await call('GET', '/api/state')).body.cases[0].byAgent).toEqual([]);
  });

  it('writes one trace span per evaluation with AIGF/CALM attributes', async () => {
    const { spend, call } = await mk();
    await spend(llm('C'));
    const spans = (await call('GET', '/api/traces')).body;
    expect(spans).toHaveLength(1);
    const keys = spans[0].attributes.map((a: { key: string }) => a.key);
    expect(keys).toEqual(expect.arrayContaining(['spendguard.decision', 'aigf.risk_ids', 'calm.control_id', 'gen_ai.usage.input_tokens']));
  });
});
