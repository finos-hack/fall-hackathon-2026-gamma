import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildApp } from '../src/app.js';
import { DEFAULT_CALM_PATH, verifyCalmBinding } from '../src/finos/calm-binding.js';
import { offlineChecks } from '../src/finos/validate.js';
import { mk, llm } from './helpers.js';

const calmDir = dirname(DEFAULT_CALM_PATH);

/** Copies finos/calm to a temp folder so the mapping's relative paths still resolve to the real files, then lets `edit` break it. */
function brokenCalm(edit: (calm: any, mapping: Record<string, string>) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'sg-calm-'));
  mkdirSync(join(dir, 'finos', 'calm'), { recursive: true });
  const calm = JSON.parse(readFileSync(DEFAULT_CALM_PATH, 'utf8'));
  const mapping = JSON.parse(readFileSync(join(calmDir, 'url-to-local-file-mapping.json'), 'utf8')) as Record<string, string>;
  // make mapping paths absolute-from-here by walking back to the repo
  for (const k of Object.keys(mapping)) mapping[k] = join(calmDir, mapping[k]);
  edit(calm, mapping);
  const file = join(dir, 'finos', 'calm', 'arch.calm.json');
  writeFileSync(file, JSON.stringify(calm));
  writeFileSync(join(dir, 'finos', 'calm', 'url-to-local-file-mapping.json'), JSON.stringify(mapping));
  return file;
}
const ctrl = (calm: any) => calm.nodes.find((n: any) => n['unique-id'] === 'agent-spend-guard').controls;

describe('CALM binding at startup', () => {
  it('starts with the correct binding and audits CALM_BINDING_VERIFIED', async () => {
    const { ctx } = await mk();
    expect(ctx.finos?.ok).toBe(true);
    const e = ctx.audit.entries.find((x) => x.type === 'CALM_BINDING_VERIFIED');
    expect(e?.payload.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to start when the control is missing from the CALM file', async () => {
    const calmFile = brokenCalm((c) => { delete ctrl(c)['agent-spend-authority']; });
    await expect(buildApp({ calmFile })).rejects.toThrow(/CALM binding failed[\s\S]*agent-spend-authority missing/);
  });

  it('refuses to start when a URL is missing from the mapping', async () => {
    const calmFile = brokenCalm((_c, m) => { delete m[Object.keys(m).find((k) => k.endsWith('.policy.yaml'))!]; });
    await expect(buildApp({ calmFile })).rejects.toThrow(/config-url mapped/);
  });

  it('refuses to start when the CALM config is not the loaded policy', async () => {
    const calmFile = brokenCalm((_c, m) => { const k = Object.keys(m).find((x) => x.endsWith('.policy.yaml'))!; m[k] = join(calmDir, 'controls', 'agent-spend-authority.requirement.json'); });
    await expect(buildApp({ calmFile })).rejects.toThrow(/config is the loaded policy/);
  });

  it('SPENDGUARD_STRICT=0 downgrades a broken binding to a warning', async () => {
    const calmFile = brokenCalm((c) => { delete ctrl(c)['agent-spend-authority']; });
    process.env.SPENDGUARD_STRICT = '0';
    try {
      const app = await buildApp({ calmFile });
      expect((app as any).ctx.finos.ok).toBe(false);
    } finally { delete process.env.SPENDGUARD_STRICT; }
  });

  it('a policy control without a CCC id fails the check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sg-pol-'));
    const src = readFileSync(join(calmDir, '..', '..', 'policies', 'loan-approval.policy.yaml'), 'utf8').replace('ccc: CCC.AgentSpend.CN01', 'ccc: CCC.Nope.CN99');
    const policyPath = join(dir, 'p.yaml');
    writeFileSync(policyPath, src);
    copyFileSync(DEFAULT_CALM_PATH, join(dir, 'a.json'));
    const r = verifyCalmBinding({ policyPath });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => !c.ok && c.name.includes('CCC id'))?.detail).toContain('SG-01');
  });
});

describe('FINOS status and evidence', () => {
  it('GET /api/finos/status reports the chain', async () => {
    const { call, spend } = await mk();
    let s = (await call('GET', '/api/finos/status')).body;
    expect(s.calm.ok && s.ccc.ok && s.aigf.ok).toBe(true);
    expect(s.ccc.controls).toContain('CCC.AgentSpend.CN07');
    expect(s.aigf.ids).toContain('AIR-SEC-024');
    expect(s.fluxnova.connected).toBe(false);
    await spend({ ...llm('CASE-F'), source: 'fluxnova' });
    s = (await call('GET', '/api/finos/status')).body;
    expect(s.fluxnova.connected).toBe(true);
  });

  it('evidence report lists AIGF, CCC and CALM refs (json and md)', async () => {
    const { call, spend } = await mk();
    await spend(llm('CASE-E'));
    const ev = (await call('GET', '/api/evidence/CASE-E')).body;
    expect(ev.calm.ref).toBe('agent-spend-guard#agent-spend-authority');
    expect(ev.aigfRisks).toContain('AIR-SEC-024');
    expect(ev.cccControls).toContain('CCC.AgentSpend.CN01');
    expect(ev.chain.ok).toBe(true);
    expect(ev.items[0].auditHash).toMatch(/^[0-9a-f]{64}$/);
    const md = (await call('GET', '/api/evidence/CASE-E?format=md')).body as string;
    expect(md).toContain('# Evidence report: CASE-E');
    expect(md).toContain('CCC.AgentSpend.CN01');
    expect((await call('GET', '/api/evidence/NOPE')).status).toBe(404);
  });
});

describe('offline finos:validate checks', () => {
  it('all pass', () => {
    const bad = offlineChecks().filter((l) => !l.ok);
    expect(bad).toEqual([]);
  });
});
