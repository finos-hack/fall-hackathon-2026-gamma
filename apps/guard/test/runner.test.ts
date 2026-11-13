import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { ManualClock } from '../src/clock.js';

async function setup() {
  const clock = new ManualClock();
  const app = await buildApp({
    clock,
    scenarios: { narrationMs: 0, pollMs: 5, gapMs: 20_000, sleep: async (ms) => { clock.advance(ms); } },
  });
  const call = async (method: 'GET' | 'POST', url: string, payload?: unknown) => {
    const r = await app.inject({ method, url, payload: payload as object });
    return { status: r.statusCode, body: r.json() };
  };
  const start = async (id: string) => (await call('POST', `/api/scenarios/${id}/run`)).body;
  const until = async (pred: () => Promise<boolean>) => {
    for (let i = 0; i < 400; i++) { if (await pred()) return; await new Promise((r) => setTimeout(r, 5)); }
    throw new Error('timed out');
  };
  const run = (runId: string) => call('GET', `/api/scenarios/runs/${runId}`).then((r) => r.body);
  const pending = async () => (await call('GET', '/api/state')).body.queue as { request: { id: string } }[];
  return { call, start, until, run, pending };
}
const act = (call: Awaited<ReturnType<typeof setup>>['call'], id: string, what: string, approverId: string) =>
  call('POST', `/api/requests/${id}/${what}`, { approverId });

describe('scenario runner (via POST /api/scenarios/:id/run)', () => {
  it('S1 runs to completion on CASE-1001 with source scripted', async () => {
    const { start, until, run, call } = await setup();
    const r = await start('S1');
    expect(r.caseId).toBe('CASE-1001');
    await until(async () => (await run(r.runId)).status === 'done');
    expect((await run(r.runId)).steps.map((s: any) => s.outcome)).toEqual(['approve', 'approve', 'approve', 'approve']);
    const reqs = (await call('GET', '/api/state')).body.requests;
    expect(reqs.every((x: any) => x.request.source === 'scripted')).toBe(true);
    // A second run gets a fresh case.
    expect((await start('S1')).caseId).toBe('CASE-1001-r2');
  });

  it('S2 waits for four-eyes approval, then finishes', async () => {
    const { start, until, run, call, pending } = await setup();
    const r = await start('S2');
    await until(async () => (await pending()).length === 1);
    expect((await run(r.runId)).status).toBe('running');
    const id = (await pending())[0].request.id;
    expect((await act(call, id, 'approve', 'sofia')).status).toBe(200);
    expect((await act(call, id, 'approve', 'sofia')).status).toBe(409);
    expect((await run(r.runId)).status).toBe('running');
    await act(call, id, 'approve', 'marco');
    await until(async () => (await run(r.runId)).status === 'done');
    const steps = (await run(r.runId)).steps;
    expect(steps[2]).toMatchObject({ outcome: 'escalate', reasonCode: 'FOUR_EYES', status: 'approved' });
    expect(steps[3].outcome).toBe('approve');
  });

  it('S3 escalates part 3 as structuring and waits for Sofia to reject', async () => {
    const { start, until, run, call, pending } = await setup();
    const r = await start('S3');
    await until(async () => (await pending()).length === 1);
    const id = (await pending())[0].request.id;
    await act(call, id, 'reject', 'sofia');
    await until(async () => (await run(r.runId)).status === 'done');
    const steps = (await run(r.runId)).steps;
    expect(steps.map((s: any) => s.outcome)).toEqual(['approve', 'approve', 'escalate']);
    expect(steps[2]).toMatchObject({ reasonCode: 'STRUCTURING', ruleId: 'SG-05', status: 'rejected' });
  });

  it('S4 delegation: granted, shared budget, scope denial, no sub-delegation', async () => {
    const { start, until, run, call } = await setup();
    const r = await start('S4');
    await until(async () => (await run(r.runId)).status === 'done');
    const s = (await run(r.runId)).steps;
    expect([s[0].reasonCode, s[3].reasonCode, s[4].reasonCode]).toEqual(['GRANTED', 'DELEGATION_SCOPE', 'DELEGATION_NOT_PERMITTED']);
    expect(s.map((x: any) => x.outcome)).toEqual(['approve', 'approve', 'approve', 'deny', 'deny']);
    const state = (await call('GET', '/api/state')).body;
    expect(state.cases.find((c: any) => c.caseId === r.caseId).byAgent[0]).toMatchObject({ agentId: 'loan-agent' });
  });

  it('S5 trips the breaker on request 6, denies while suspended, and waits for resume', async () => {
    const { start, until, run, call } = await setup();
    const r = await start('S5');
    await until(async () => (await run(r.runId)).steps.some((x: any) => x.label === 'Waiting for resume'));
    const s = (await run(r.runId)).steps;
    expect(s.slice(0, 5).every((x: any) => x.outcome === 'approve')).toBe(true);
    expect(s[5]).toMatchObject({ outcome: 'deny', reasonCode: 'RUNAWAY' });
    expect(s[6]).toMatchObject({ outcome: 'deny', reasonCode: 'AGENT_SUSPENDED' });
    expect((await run(r.runId)).status).toBe('running');
    expect((await call('POST', '/api/agents/loan-agent/resume', { approverId: 'sofia' })).status).toBe(200);
    await until(async () => (await run(r.runId)).status === 'done');
  });

  it('reset cancels a scenario that is waiting on a human; unknown ids and live mode are rejected', async () => {
    const { start, until, run, call, pending } = await setup();
    const r = await start('S2');
    await until(async () => (await pending()).length === 1);
    await call('POST', '/api/reset');
    await until(async () => (await run(r.runId)).status === 'cancelled');
    expect((await call('POST', '/api/scenarios/S9/run')).status).toBe(404);
    expect((await call('POST', '/api/scenarios/S1/run?live=1')).status).toBe(501);
  });
});
