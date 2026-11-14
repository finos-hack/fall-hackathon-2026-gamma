import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { DEFAULT_POLICY_PATH } from '../policy/load.js';
import { verifyCalmBinding } from './calm-binding.js';
import { DEFAULT_CCC_PATH, loadCcc } from './ccc.js';

export interface Line { ok: boolean; name: string; detail: string }

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
export const FINOS_FILES = {
  ccc: DEFAULT_CCC_PATH,
  aigfRisk: root('finos/aigf/proposed-risk-agent-spend-authority.md'),
  aigfMitigation: root('finos/aigf/proposed-mitigation-delegated-spend-controls.md'),
};

/**
 * Offline FINOS checks (no CALM CLI): CALM binding + policy vs requirement schema, CCC catalog covering
 * SG-01..SG-09, and every AIGF id used by the policy being referenced in the CCC catalog or the proposed AIGF files.
 */
export function offlineChecks(): Line[] {
  const out: Line[] = [];
  const b = verifyCalmBinding();
  for (const c of b.checks) out.push({ ok: c.ok, name: `CALM binding: ${c.name}`, detail: c.detail });

  const policy = parse(readFileSync(DEFAULT_POLICY_PATH, 'utf8')) as { controls: { id: string; ccc?: string; aigf: { risks: string[]; mitigations: string[] } }[] };
  try {
    const cat = loadCcc();
    const missing = policy.controls.filter((c) => !c.ccc || !cat.controls.some((x) => x.id === c.ccc)).map((c) => c.id);
    out.push({ ok: !missing.length && policy.controls.length === 9 && cat.controls.length >= 9, name: 'CCC catalog parses and covers SG-01..SG-09',
      detail: missing.length ? `no CCC control for ${missing.join(', ')}` : `${cat.controls.length} controls in ${cat.id}` });
  } catch (e) { out.push({ ok: false, name: 'CCC catalog parses', detail: (e as Error).message }); }

  const corpus = [FINOS_FILES.ccc, FINOS_FILES.aigfRisk, FINOS_FILES.aigfMitigation].map((f) => readFileSync(f, 'utf8')).join('\n');
  const ids = [...new Set(policy.controls.flatMap((c) => [...c.aigf.risks, ...c.aigf.mitigations]))].sort();
  const unmapped = ids.filter((id) => !corpus.includes(id));
  out.push({ ok: !unmapped.length, name: 'AIGF ids in the policy are mapped (CCC catalog / proposed AIGF files)',
    detail: unmapped.length ? `not referenced: ${unmapped.join(', ')}` : `${ids.length} ids mapped` });
  return out;
}
