import { GuardClient, type Reply, type SpendBody } from './client.js';

export const SCENARIO_IDS = ['S1', 'S2', 'S3', 'S4', 'S5'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface RunEnv {
  client: GuardClient;
  /** Narration and "time passes" delays. Demo: real timers. Tests: advance the injected clock. */
  sleep: (ms: number) => Promise<void>;
  /** Real-time wait between polls for a human (spec: 1 s). */
  pollMs: number;
  /** Pause before each step so the audience can follow (spec: ~700 ms demo, 0 in tests). */
  narrationMs: number;
  /** Gap between the split purchases of S3 (spec: ~20 s). */
  gapMs: number;
  signal?: AbortSignal;
}

export interface Step {
  label: string; agentId?: string; service?: string; amount?: number;
  outcome?: string; reasonCode?: string; ruleId?: string; requestId?: string; status?: string; note?: string;
}
export interface RunLog { caseId: string; steps: Step[] }

const aborted = () => Object.assign(new Error('scenario cancelled'), { name: 'AbortError' });
const realWait = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  if (signal?.aborted) return rej(aborted());
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(aborted()); }, { once: true });
});

class Runner {
  constructor(private env: RunEnv, readonly caseId: string, public steps: Step[]) {}
  private async pause(ms: number) { if (this.env.signal?.aborted) throw aborted(); if (ms > 0) await this.env.sleep(ms); }
  narrate() { return this.pause(this.env.narrationMs); }
  gap(ms: number) { return this.pause(ms); }
  note(label: string, note: string) { this.steps.push({ label, note }); }

  async spend(label: string, b: Omit<SpendBody, 'caseId'>, wait = false): Promise<Step> {
    await this.narrate();
    const r = await this.env.client.spend({ caseId: this.caseId, ...b });
    const d = r.body.decision;
    const step: Step = {
      label, agentId: b.agentId, service: b.service, requestId: r.body.requestId, status: r.body.status,
      outcome: d?.outcome, reasonCode: d?.reasonCode ?? r.body.error, ruleId: d?.ruleId,
    };
    this.steps.push(step);
    if (wait && r.body.status === 'pending') {
      step.note = 'waiting for human approval';
      step.status = await this.untilResolved(r.body.requestId);
      step.note = `resolved: ${step.status}`;
    }
    return step;
  }

  /** Poll GET /api/requests/:id until a human (or the 15-minute expiry) resolves it. */
  async untilResolved(id: string): Promise<string> {
    for (;;) {
      const s = (await this.env.client.request(id)).body.request.status as string;
      if (s !== 'pending') return s;
      await realWait(this.env.pollMs, this.env.signal);
    }
  }

  async untilResumed(agentId: string) {
    for (;;) {
      const st = (await this.env.client.state()).body.agents.find((a: { agentId: string; suspended: boolean }) => a.agentId === agentId);
      if (!st?.suspended) return;
      await realWait(this.env.pollMs, this.env.signal);
    }
  }

  async grant(label: string, g: Parameters<GuardClient['grant']>[0]): Promise<Reply> {
    await this.narrate();
    const r = await this.env.client.grant(g);
    this.steps.push({
      label, agentId: g.parentAgentId, amount: g.amount,
      outcome: r.body.outcome, reasonCode: r.body.reasonCode ?? r.body.error, ruleId: r.body.ruleId, status: r.body.status,
      note: `delegation ${r.body.delegationId ?? ''}`.trim(),
    });
    return r;
  }
}

const L = 'loan-agent';
const std = { kind: 'llm', service: 'llm.standard', inputTokens: 3000, outputTokens: 800 } as const;

type Script = (r: Runner, env: RunEnv) => Promise<void>;
const SCRIPTS: Record<ScenarioId, { base: string; title: string; run: Script }> = {
  S1: { base: 'CASE-1001', title: 'Normal loan case', run: async (r) => {
    await r.spend('Assess application', { agentId: L, ...std, purpose: 'Assess application' });
    await r.spend('Verify identity', { agentId: L, kind: 'service', service: 'kyc.id-verify', purpose: 'KYC' });
    await r.spend('Credit score', { agentId: L, kind: 'service', service: 'credit-bureau.score-pull', purpose: 'Credit score' });
    await r.spend('Write summary', { agentId: L, ...std, purpose: 'Summary' });
  } },
  S2: { base: 'CASE-1002', title: 'Four-eyes on a high-value check', run: async (r) => {
    await r.spend('Assess application', { agentId: L, ...std, purpose: 'Assess application' });
    await r.spend('Verify identity', { agentId: L, kind: 'service', service: 'kyc.id-verify', purpose: 'KYC' });
    await r.spend('Full credit report', { agentId: L, kind: 'service', service: 'credit-bureau.full-report', purpose: 'Large mortgage' }, true);
    await r.spend('Write summary', { agentId: L, ...std, purpose: 'Summary' });
  } },
  S3: { base: 'CASE-1003', title: 'Split purchase (structuring)', run: async (r, env) => {
    for (const i of [1, 2, 3]) {
      if (i > 1) await r.gap(env.gapMs);
      await r.spend(`Valuation part ${i} of 3`, {
        agentId: L, kind: 'service', service: 'property.valuation', quantity: 2,
        params: { comparable: `property-${i}` }, purpose: `Valuation batch ${i}/3`,
      }, i === 3);
    }
  } },
  S4: { base: 'CASE-1004', title: 'Delegation to a helper agent', run: async (r) => {
    const g = await r.grant('Delegate $3.00 to fraud-agent', {
      parentAgentId: L, childAgentId: 'fraud-agent', caseId: r.caseId, amount: 3, services: ['fraud-check.basic', 'llm.*'],
    });
    const delegationId = g.body.delegationId as string | undefined;
    const F = 'fraud-agent';
    await r.spend('Helper reasons about fraud', { agentId: F, delegationId, ...std, purpose: 'Fraud analysis' });
    await r.spend('Basic fraud check', { agentId: F, delegationId, kind: 'service', service: 'fraud-check.basic', purpose: 'Fraud check' });
    await r.spend('Enhanced check (outside grant)', { agentId: F, delegationId, kind: 'service', service: 'fraud-check.enhanced', purpose: 'Fraud check' });
    await r.grant('Helper tries to sub-delegate', {
      parentAgentId: F, childAgentId: L, caseId: r.caseId, amount: 1, services: ['fraud-check.basic'],
    });
  } },
  S5: { base: 'CASE-1005', title: 'Runaway agent', run: async (r) => {
    const loop = { agentId: L, kind: 'llm', service: 'llm.premium', inputTokens: 8000, outputTokens: 2000, promptHash: 'loop-prompt', purpose: 'Retry loop' } as const;
    for (let i = 1; i <= 10; i++) {
      const s = await r.spend(`Loop iteration ${i}`, loop);
      if (s.reasonCode === 'RUNAWAY') break;
      await r.gap(250);
    }
    await r.spend('Request while frozen', loop);
    r.note('Waiting for resume', 'loan-agent is suspended; waiting for a human to resume it');
    await r.untilResumed(L);
    r.note('Resumed', 'loan-agent resumed by a human');
  } },
};

export function isScenarioId(id: string): id is ScenarioId { return (SCENARIO_IDS as readonly string[]).includes(id); }
export const scenarioTitle = (id: ScenarioId) => SCRIPTS[id].title;

/** Each run uses a fresh case: CASE-1001 first, then CASE-1001-r2, -r3 ... */
export async function freshCaseId(client: GuardClient, id: ScenarioId): Promise<string> {
  const used = new Set<string>((await client.state()).body.cases.map((c: { caseId: string }) => c.caseId));
  const base = SCRIPTS[id].base;
  let c = base;
  for (let n = 2; used.has(c); n++) c = `${base}-r${n}`;
  return c;
}

/** Runs one scenario. Steps are appended to `log.steps` as they happen, so callers can watch progress. */
export async function runScenario(id: ScenarioId, env: RunEnv, caseId: string, log: RunLog = { caseId, steps: [] }): Promise<RunLog> {
  await SCRIPTS[id].run(new Runner(env, caseId, log.steps), env);
  return log;
}
