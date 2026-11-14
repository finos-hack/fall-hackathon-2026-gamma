import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FluxnovaWorker } from '../src/finos/fluxnova-worker.js';
import { mk } from './helpers.js';

/** Minimal mock of the Fluxnova engine REST API: serves queued external tasks and records every call. */
function mockEngine() {
  const queue: any[] = [];
  const calls: { path: string; body: any; auth?: string }[] = [];
  const server: Server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const body = data ? JSON.parse(data) : {};
      calls.push({ path: req.url!, body, auth: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/engine-rest/external-task/fetchAndLock') return res.end(JSON.stringify(queue.splice(0)));
      res.statusCode = 204; res.end();
    });
  });
  return new Promise<{ url: string; queue: any[]; calls: typeof calls; close: () => void }>((ok) =>
    server.listen(0, () => ok({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/engine-rest`, queue, calls, close: () => server.close() })));
}
const vars = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, value]) => [k, { value, type: 'String' }]));
const task = (id: string, businessKey: string | null, v: Record<string, unknown> = {}) =>
  ({ id, processInstanceId: `pi-${id}`, businessKey, variables: vars(v) });

let engine: Awaited<ReturnType<typeof mockEngine>>;
afterEach(() => engine?.close());

async function setup() {
  engine = await mockEngine();
  const g = await mk();
  g.ctx.fluxnova = {};
  const worker = new FluxnovaWorker({
    baseUrl: engine.url, user: 'demo', password: 'demo',
    guard: async (method, path, body) => { const r = await g.app.inject({ method, url: path, payload: body as object }); return { status: r.statusCode, body: r.json() }; },
    pollMs: 5, approvalPollMs: 5, extendEveryMs: 20, lockMs: 1000, log: () => {},
    onContact: (iso) => { g.ctx.fluxnova!.lastCallAt = iso; },
  });
  const run = async () => { await worker.pollOnce(); await worker.idle(); };
  const sent = (suffix: string) => engine.calls.filter((c) => c.path.endsWith(suffix));
  return { ...g, worker, run, sent };
}

describe('Fluxnova external task worker (mock engine)', () => {
  it('approves a normal run: completes the task, source fluxnova, case id = business key', async () => {
    const { run, sent, ctx, call } = await setup();
    engine.queue.push(task('t1', 'CASE-9001')); // BPMN defaults apply: loan-agent, fraud-check.basic, quantity 1
    await run();
    const done = sent('/external-task/t1/complete');
    expect(done).toHaveLength(1);
    expect(done[0].body.variables.spendDecision.value).toBe('approve');
    expect(done[0].body.workerId).toBe('spend-guard-worker');
    expect(engine.calls[0].auth).toBe('Basic ' + Buffer.from('demo:demo').toString('base64'));
    const r = [...ctx.store.requests.values()][0];
    expect(r).toMatchObject({ caseId: 'CASE-9001', agentId: 'loan-agent', service: 'fraud-check.basic', source: 'fluxnova', status: 'approved' });
    const st = (await call('GET', '/api/finos/status')).body;
    expect(st.fluxnova.connected).toBe(true);
    expect(st.fluxnova.lastCallAt).toBeTruthy();
  });

  it('falls back to the process instance id when the business key is empty', async () => {
    const { run, ctx } = await setup();
    engine.queue.push(task('t2', ''));
    await run();
    expect([...ctx.store.requests.values()][0].caseId).toBe('pi-t2');
  });

  it('a successful poll alone marks Fluxnova connected', async () => {
    const { run, call } = await setup();
    expect((await call('GET', '/api/finos/status')).body.fluxnova.connected).toBe(false);
    await run();
    expect((await call('GET', '/api/finos/status')).body.fluxnova.connected).toBe(true);
  });

  it('raises BPMN error SPEND_DENIED when the guard denies', async () => {
    const { run, sent } = await setup();
    engine.queue.push(task('t3', 'CASE-9003', { spendAgent: 'fraud-agent', spendService: 'credit-bureau.score-pull' })); // not on its allow-list
    await run();
    const err = sent('/external-task/t3/bpmnError');
    expect(err).toHaveLength(1);
    expect(err[0].body.errorCode).toBe('SPEND_DENIED');
    expect(err[0].body.variables.spendDecision.value).toBe('deny');
    expect(sent('/external-task/t3/complete')).toHaveLength(0);
  });

  it('escalation: keeps extending the lock until a human approves, then completes', async () => {
    const { run, sent, act } = await setup();
    engine.queue.push(task('t4', 'CASE-9004', { spendService: 'credit-bureau.score-pull', spendQuantity: 3 })); // $7.50 > $5 signing limit
    const p = run();
    await new Promise((r) => setTimeout(r, 250));
    expect(sent('/external-task/t4/extendLock').length).toBeGreaterThanOrEqual(2);
    expect(sent('/external-task/t4/complete')).toHaveLength(0);
    const id = 'req-0001';
    expect((await act(id, 'approve', 'sofia')).status).toBe(200);
    await p;
    expect(sent('/external-task/t4/complete')).toHaveLength(1);
    expect(sent('/external-task/t4/bpmnError')).toHaveLength(0);
  });

  it('escalation rejected by a human raises SPEND_DENIED', async () => {
    const { run, sent, act } = await setup();
    engine.queue.push(task('t5', 'CASE-9005', { spendService: 'credit-bureau.score-pull', spendQuantity: 3 }));
    const p = run();
    await new Promise((r) => setTimeout(r, 40));
    await act('req-0001', 'reject', 'sofia');
    await p;
    expect(sent('/external-task/t5/bpmnError')[0].body.errorCode).toBe('SPEND_DENIED');
  });

  it('escalation that expires (15 min) raises SPEND_DENIED', async () => {
    const { run, sent, clock } = await setup();
    engine.queue.push(task('t6', 'CASE-9006', { spendService: 'credit-bureau.score-pull', spendQuantity: 3 }));
    const p = run();
    await new Promise((r) => setTimeout(r, 40));
    clock.advance(16 * 60 * 1000);
    await p;
    expect(sent('/external-task/t6/bpmnError')).toHaveLength(1);
  });
});

describe('patched BPMN', () => {
  const bpmn = readFileSync(fileURLToPath(new URL('../../../finos/fluxnova/LoanApprovalProcess_AI.spend-guard.bpmn', import.meta.url)), 'utf8');
  it('has the spend-guard task, its defaults, and the SPEND_DENIED boundary error', () => {
    expect(bpmn).toContain('camunda:topic="spend-guard"');
    expect(bpmn).toContain('<camunda:inputParameter name="spendAgent">loan-agent</camunda:inputParameter>');
    expect(bpmn).toContain('<camunda:inputParameter name="spendService">fraud-check.basic</camunda:inputParameter>');
    expect(bpmn).toContain('<camunda:inputParameter name="spendQuantity">1</camunda:inputParameter>');
    expect(bpmn).toContain('errorCode="SPEND_DENIED"');
    expect(bpmn).toContain('attachedToRef="ServiceTask_AuthoriseSpend"');
  });
});
