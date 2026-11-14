import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import type { Ctx } from './engine/authority.js';
import { FluxnovaWorker } from './finos/fluxnova-worker.js';

const port = Number(process.env.PORT ?? 8080);
const app = await buildApp({ dataDir: fileURLToPath(new URL('../../../data', import.meta.url)) });
await app.listen({ port, host: '0.0.0.0' });
console.log(`Agent Spend Guard listening on :${port}`);

// Optional Steel Thread hook (spec 7.5): set FLUXNOVA_URL=http://localhost:8080/engine-rest to start the worker.
if (process.env.FLUXNOVA_URL) {
  const ctx = (app as unknown as { ctx: Ctx }).ctx;
  ctx.fluxnova = {};
  const worker = new FluxnovaWorker({
    baseUrl: process.env.FLUXNOVA_URL, user: process.env.FLUXNOVA_USER ?? 'demo', password: process.env.FLUXNOVA_PASSWORD ?? 'demo',
    guard: async (method, path, body) => {
      const res = await app.inject({ method, url: path, payload: body as object });
      return { status: res.statusCode, body: res.json() };
    },
    onContact: (iso) => { ctx.fluxnova!.lastCallAt = iso; },
  });
  void worker.run();
  console.log(`Fluxnova worker polling ${process.env.FLUXNOVA_URL} (topic spend-guard)`);
}
