import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SpendPolicySchema } from './src/policy/schema.js';

const schema = z.toJSONSchema(SpendPolicySchema);
const out = fileURLToPath(new URL('../../policies/spend-policy.schema.json', import.meta.url));
writeFileSync(out, JSON.stringify(schema, null, 2) + '\n');
console.log('wrote', out);

// The same schema, wrapped as the CALM control requirement for `agent-spend-authority` (finos/calm).
const { $schema, ...body } = schema as Record<string, unknown>;
const requirement = {
  $schema,
  $id: 'https://github.com/finos-hack/fall-hackathon-2026-gamma/blob/main/finos/calm/controls/agent-spend-authority.requirement.json',
  title: 'Agent Spend Authority (Agent Spend Guard)',
  description:
    'Requirement for CALM control agent-spend-authority: the configuration is a SpendPolicy (delegation-of-authority matrix, budgets, four-eyes, structuring detection, delegation attenuation, kill switch) that validates against this schema.',
  ...body,
};
const reqOut = fileURLToPath(
  new URL('../../finos/calm/controls/agent-spend-authority.requirement.json', import.meta.url),
);
mkdirSync(fileURLToPath(new URL('../../finos/calm/controls/', import.meta.url)), { recursive: true });
writeFileSync(reqOut, JSON.stringify(requirement, null, 2) + '\n');
console.log('wrote', reqOut);
