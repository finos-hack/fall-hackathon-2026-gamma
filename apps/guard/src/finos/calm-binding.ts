import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { DEFAULT_POLICY_PATH } from '../policy/load.js';
import { DEFAULT_CCC_PATH, loadCcc } from './ccc.js';

export const DEFAULT_CALM_PATH = fileURLToPath(new URL('../../../../finos/calm/loan-approval-with-spend-guard.calm.json', import.meta.url));
export const CALM_NODE = 'agent-spend-guard';
export const CALM_CONTROL_ID = 'agent-spend-authority';

export interface BindingCheck { name: string; ok: boolean; detail: string }
export interface BindingResult {
  ok: boolean; file: string; sha: string; checks: BindingCheck[];
  aigfIds: string[]; cccControls: string[];
}

interface CalmDoc {
  nodes?: { 'unique-id': string; controls?: Record<string, { requirements?: { 'requirement-url': string; 'config-url': string }[] }> }[];
}

/**
 * CALM binding (spec 7.0.1): the CALM architecture declares control `agent-spend-authority` on node
 * `agent-spend-guard`; its requirement schema and config (the policy) are resolved via the url mapping file
 * (paths relative to that file). The policy actually loaded must be that config, must satisfy the requirement,
 * and every control must carry AIGF refs and a CCC id that exists in the catalog.
 */
export function verifyCalmBinding(o: { calmFile?: string; policyPath?: string; cccPath?: string } = {}): BindingResult {
  const calmFile = o.calmFile ?? DEFAULT_CALM_PATH;
  const policyPath = o.policyPath ?? DEFAULT_POLICY_PATH;
  const checks: BindingCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); return ok; };
  const result = (extra: Partial<BindingResult> = {}): BindingResult => ({
    ok: checks.every((c) => c.ok), file: calmFile, sha: '', checks, aigfIds: [], cccControls: [], ...extra,
  });

  let raw: string;
  try { raw = readFileSync(calmFile, 'utf8'); } catch (e) { add('CALM file readable', false, String((e as Error).message)); return result(); }
  const sha = createHash('sha256').update(raw).digest('hex');
  let calm: CalmDoc;
  try { calm = JSON.parse(raw); } catch (e) { add('CALM file is JSON', false, String((e as Error).message)); return result({ sha }); }

  const node = calm.nodes?.find((n) => n['unique-id'] === CALM_NODE);
  if (!add('CALM node', !!node, node ? `node ${CALM_NODE} found` : `node ${CALM_NODE} missing`)) return result({ sha });
  const req = node!.controls?.[CALM_CONTROL_ID]?.requirements?.[0];
  if (!add('CALM control', !!req, req ? `control ${CALM_CONTROL_ID} found` : `control ${CALM_CONTROL_ID} missing on ${CALM_NODE}`)) return result({ sha });

  // Resolve URLs through the mapping file; a URL missing from the mapping is a failed check.
  const mappingFile = resolve(dirname(calmFile), 'url-to-local-file-mapping.json');
  let mapping: Record<string, string> = {};
  try { mapping = JSON.parse(readFileSync(mappingFile, 'utf8')); } catch { /* reported below as unmapped */ }
  const local = (url: string) => (mapping[url] ? resolve(dirname(mappingFile), mapping[url]) : undefined);
  const reqPath = local(req!['requirement-url']);
  const cfgPath = local(req!['config-url']);
  add('requirement-url mapped', !!reqPath, reqPath ?? `not in url-to-local-file-mapping.json: ${req!['requirement-url']}`);
  add('config-url mapped', !!cfgPath, cfgPath ?? `not in url-to-local-file-mapping.json: ${req!['config-url']}`);
  if (!reqPath || !cfgPath) return result({ sha });
  add('config is the loaded policy', cfgPath === resolve(policyPath), `CALM config ${cfgPath}, loaded ${resolve(policyPath)}`);

  let policy: { controls?: { id: string; ccc?: string; aigf?: { risks?: string[]; mitigations?: string[] } }[] } = {};
  try {
    const schema = JSON.parse(readFileSync(reqPath, 'utf8'));
    policy = parse(readFileSync(resolve(policyPath), 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const valid = ajv.validate(schema, policy);
    add('policy satisfies requirement', !!valid, valid ? 'policy validates against the requirement schema' : ajv.errorsText(ajv.errors, { dataVar: 'policy' }));
  } catch (e) { add('policy satisfies requirement', false, String((e as Error).message)); }

  let catalog: string[] = [];
  try { catalog = loadCcc(o.cccPath ?? DEFAULT_CCC_PATH).controls.map((c) => c.id); } catch (e) { add('CCC catalog', false, String((e as Error).message)); }
  const bad = (policy.controls ?? []).filter((c) => !(c.aigf?.risks?.length) || !c.ccc || !catalog.includes(c.ccc));
  add('every control has AIGF refs and a CCC id in the catalog', bad.length === 0 && (policy.controls ?? []).length > 0,
    bad.length ? `missing or unknown: ${bad.map((c) => c.id).join(', ')}` : `${policy.controls?.length} controls tagged`);

  const aigfIds = [...new Set((policy.controls ?? []).flatMap((c) => [...(c.aigf?.risks ?? []), ...(c.aigf?.mitigations ?? [])]))].sort();
  return result({ sha, aigfIds, cccControls: catalog });
}

export function assertCalmBinding(o: Parameters<typeof verifyCalmBinding>[0] = {}): BindingResult {
  const r = verifyCalmBinding(o);
  if (r.ok) return r;
  const msg = `CALM binding failed (${r.file}):\n` + r.checks.filter((c) => !c.ok).map((c) => `  x ${c.name}: ${c.detail}`).join('\n');
  if (process.env.SPENDGUARD_STRICT === '0') { console.warn('WARNING ' + msg); return r; }
  throw new Error(msg);
}
