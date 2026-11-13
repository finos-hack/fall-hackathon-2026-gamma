import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 8080);
const app = await buildApp({ dataDir: fileURLToPath(new URL('../../../data', import.meta.url)) });
await app.listen({ port, host: '0.0.0.0' });
console.log(`Agent Spend Guard listening on :${port}`);
