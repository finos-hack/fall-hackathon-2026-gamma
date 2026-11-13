import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { GuardClient } from '../agents/client.js';
import { freshCaseId, isScenarioId, runScenario, scenarioTitle, type RunEnv, type RunLog } from '../agents/scenarios.js';
import { HttpError } from '../types.js';
import type { Bus } from './sse.js';

export interface ScenarioRun {
  runId: string; scenario: string; title: string; caseId: string;
  status: 'running' | 'done' | 'cancelled' | 'error'; error?: string; steps: RunLog['steps']; startedAt: string;
}
export type ScenarioEnvOptions = Partial<Omit<RunEnv, 'client' | 'signal'>>;

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Demo defaults: ~700 ms narration, 1 s approval polling, 3 s between split purchases (spec says ~20 s; the window is 10 min so either works). */
const DEMO: Omit<RunEnv, 'client' | 'signal'> = { sleep: realSleep, pollMs: 1000, narrationMs: 700, gapMs: 3000 };

export function registerScenarioRoutes(app: FastifyInstance, bus: Bus, opts: ScenarioEnvOptions = {}) {
  const runs = new Map<string, ScenarioRun>();
  let abort = new AbortController();
  // A guard reset cancels every scenario still waiting on a human.
  bus.subscribe((type) => { if (type === 'reset') { abort.abort(); abort = new AbortController(); } });

  const client = new GuardClient(async (method, path, body) => {
    const res = await app.inject({ method, url: path, payload: body as object });
    return { status: res.statusCode, body: res.json() };
  }, 'scripted');

  app.post('/api/scenarios/:id/run', async (req, reply) => {
    const id = (req.params as { id: string }).id.toUpperCase();
    if (!isScenarioId(id)) throw new HttpError(404, 'NOT_FOUND', `Unknown scenario "${id}" (use S1..S5)`);
    if ((req.query as { live?: string }).live) throw new HttpError(501, 'NOT_IMPLEMENTED', 'Live LLM mode is not built yet (task T2)');
    const caseId = await freshCaseId(client, id);
    const run: ScenarioRun = {
      runId: randomUUID(), scenario: id, title: scenarioTitle(id), caseId, status: 'running', steps: [], startedAt: new Date().toISOString(),
    };
    runs.set(run.runId, run);
    void runScenario(id, { ...DEMO, ...opts, client, signal: abort.signal }, caseId, run)
      .then(() => { run.status = 'done'; })
      .catch((e: Error) => { if (e.name === 'AbortError') run.status = 'cancelled'; else { run.status = 'error'; run.error = e.message; } });
    return reply.status(202).send(run);
  });

  app.get('/api/scenarios/runs/:runId', async (req) => {
    const run = runs.get((req.params as { runId: string }).runId);
    if (!run) throw new HttpError(404, 'NOT_FOUND', 'Unknown run');
    return run;
  });
}
