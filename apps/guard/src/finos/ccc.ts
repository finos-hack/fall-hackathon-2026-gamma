import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const DEFAULT_CCC_PATH = fileURLToPath(new URL('../../../../finos/ccc/agent-spend-controls.yaml', import.meta.url));

export interface CccCatalog { id: string; controls: { id: string; title: string }[] }

export function loadCcc(path = DEFAULT_CCC_PATH): CccCatalog {
  const y = parse(readFileSync(path, 'utf8')) as { metadata?: { id?: string }; controls?: { id: string; title: string }[] };
  if (!y?.metadata?.id || !Array.isArray(y.controls)) throw new Error(`${path} is not a CCC control catalog`);
  return { id: y.metadata.id, controls: y.controls.map((c) => ({ id: c.id, title: c.title })) };
}
