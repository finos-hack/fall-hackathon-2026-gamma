import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { loadPolicy, parsePolicy, DEFAULT_POLICY_PATH } from '../src/policy/load.js';
import { computeAmount } from '../src/policy/pricing.js';
import { matches } from '../src/policy/glob.js';
import { buildApp } from '../src/app.js';

const raw = () => parse(readFileSync(DEFAULT_POLICY_PATH, 'utf8'));
const tryParse = (o: unknown) => () => parsePolicy(stringify(o));

describe('policy', () => {
  it('loads the demo policy', () => {
    const p = loadPolicy();
    expect(p.metadata.version).toBe('1.0.0');
    expect(p.controls).toHaveLength(9);
  });
  it('rejects a bad tier reference', () => {
    const o = raw(); o.agents['loan-agent'].tier = 'T9';
    expect(tryParse(o)).toThrow(/unknown tier/);
  });
  it('rejects bad threshold order', () => {
    const o = raw(); o.authorityTiers.T1.autoApproveUpTo = 9;
    expect(tryParse(o)).toThrow(/less than escalateUpTo/);
  });
  it('rejects an unknown control type', () => {
    const o = raw(); o.controls[0].type = 'magic';
    expect(tryParse(o)).toThrow();
  });
  it('computes prices', () => {
    const p = loadPolicy();
    expect(computeAmount(p, { kind: 'llm', service: 'llm.standard', inputTokens: 3000, outputTokens: 800 })).toBe(0.021);
    expect(computeAmount(p, { kind: 'llm', service: 'llm.premium', inputTokens: 8000, outputTokens: 2000 })).toBe(0.27);
    expect(computeAmount(p, { kind: 'service', service: 'property.valuation', quantity: 2 })).toBe(3);
    expect(computeAmount(p, { kind: 'service', service: 'kyc.id-verify' })).toBe(1.2);
    expect(computeAmount(p, { kind: 'service', service: 'nope' })).toBeNull();
  });
  it('matches globs', () => {
    expect(matches('llm.*', 'llm.standard')).toBe(true);
    expect(matches('llm.*', 'llmx.a')).toBe(false);
    expect(matches('kyc.id-verify', 'kyc.id-verify')).toBe(true);
    expect(matches('kyc.id-verify', 'kyc.other')).toBe(false);
  });
  it('GET /api/policy returns the policy', async () => {
    const res = await (await buildApp()).inject({ method: 'GET', url: '/api/policy' });
    expect(res.statusCode).toBe(200);
    expect(res.json().metadata.name).toBe('loan-approval-agent-spend');
  });
});
