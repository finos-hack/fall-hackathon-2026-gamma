import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { SpendPolicySchema, type SpendPolicy } from './schema.js';

export const DEFAULT_POLICY_PATH = fileURLToPath(
  new URL('../../../../policies/loan-approval.policy.yaml', import.meta.url),
);

export function parsePolicy(yamlText: string): SpendPolicy {
  return SpendPolicySchema.parse(parse(yamlText));
}

export function loadPolicy(path = DEFAULT_POLICY_PATH): SpendPolicy {
  return parsePolicy(readFileSync(path, 'utf8'));
}
