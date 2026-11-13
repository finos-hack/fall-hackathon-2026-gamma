import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SpendPolicySchema } from './src/policy/schema.js';

const out = fileURLToPath(new URL('../../policies/spend-policy.schema.json', import.meta.url));
writeFileSync(out, JSON.stringify(z.toJSONSchema(SpendPolicySchema), null, 2) + '\n');
console.log('wrote', out);
