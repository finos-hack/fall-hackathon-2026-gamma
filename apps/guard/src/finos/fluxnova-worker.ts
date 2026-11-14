import { GuardClient, type Transport } from '../agents/client.js';

/**
 * Fluxnova external task worker (spec 7.5, route A). Polls the engine REST API for topic `spend-guard`,
 * asks the guard to authorise the spend, then completes the task or raises BPMN error SPEND_DENIED.
 * An escalated request keeps the task locked (extendLock) until a human resolves it or it expires (15 min).
 */
export const TOPIC = 'spend-guard';
export const ERROR_CODE = 'SPEND_DENIED';

export interface WorkerOptions {
  /** Engine REST base, e.g. http://localhost:8080/engine-rest */
  baseUrl: string;
  user?: string; password?: string;
  /** Transport to the guard (in-process inject or network). */
  guard: Transport;
  workerId?: string;
  fetchImpl?: typeof fetch;
  lockMs?: number;          // lock duration requested at fetchAndLock and on every extension
  pollMs?: number;          // wait between polls of the engine
  approvalPollMs?: number;  // wait between checks of a pending request
  extendEveryMs?: number;   // how often to extend the lock while waiting for a human
  sleep?: (ms: number) => Promise<void>;
  onContact?: (iso: string) => void;
  log?: (msg: string) => void;
}

interface EngineTask {
  id: string; processInstanceId: string; businessKey?: string | null;
  variables?: Record<string, { value: unknown }>;
}

export class FluxnovaWorker {
  private o: Required<Omit<WorkerOptions, 'user' | 'password' | 'onContact'>> & Pick<WorkerOptions, 'user' | 'password' | 'onContact'>;
  private client: GuardClient;
  private stopped = false;
  private inFlight = new Set<Promise<void>>();

  constructor(opts: WorkerOptions) {
    this.o = {
      workerId: 'spend-guard-worker', fetchImpl: fetch, lockMs: 60_000, pollMs: 1000, approvalPollMs: 1000, extendEveryMs: 30_000,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log: (m) => console.log(`[fluxnova] ${m}`), ...opts,
    };
    this.client = new GuardClient(opts.guard, 'fluxnova');
  }

  private async engine(path: string, body: unknown) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.o.user) headers.authorization = 'Basic ' + Buffer.from(`${this.o.user}:${this.o.password ?? ''}`).toString('base64');
    const res = await this.o.fetchImpl(this.o.baseUrl + path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    this.o.onContact?.(new Date().toISOString());
    return res.status === 204 ? null : await res.json().catch(() => null);
  }

  /** One fetchAndLock round; handlers run in the background so a waiting escalation never blocks other tasks. */
  async pollOnce(): Promise<number> {
    const tasks = (await this.engine('/external-task/fetchAndLock', {
      workerId: this.o.workerId, maxTasks: 5, usePriority: false,
      topics: [{ topicName: TOPIC, lockDuration: this.o.lockMs, variables: ['spendAgent', 'spendService', 'spendQuantity'] }],
    })) as EngineTask[] | null;
    for (const t of tasks ?? []) {
      const p = this.handle(t).catch((e) => this.o.log(`task ${t.id} failed: ${(e as Error).message}`)).finally(() => this.inFlight.delete(p));
      this.inFlight.add(p);
    }
    return tasks?.length ?? 0;
  }

  async idle() { await Promise.all([...this.inFlight]); }

  async handle(t: EngineTask) {
    const v = (n: string, d: unknown) => { const x = t.variables?.[n]?.value; return x === undefined || x === null || x === '' ? d : x; };
    const caseId = t.businessKey || t.processInstanceId; // business key, else the process instance id
    const service = String(v('spendService', 'fraud-check.basic'));
    const r = await this.client.spend({
      caseId, agentId: String(v('spendAgent', 'loan-agent')), kind: service.startsWith('llm.') ? 'llm' : 'service', service,
      quantity: Number(v('spendQuantity', 1)), purpose: `Fluxnova process ${t.processInstanceId}`,
    });
    if (r.status !== 200) return this.deny(t, `guard error ${r.status}`, r.body?.message ?? '', undefined);
    const requestId: string = r.body.requestId;
    let { status, decision } = r.body as { status: string; decision: { outcome: string; reason: string } };
    if (decision.outcome === 'escalate') {
      this.o.log(`task ${t.id}: ${requestId} escalated, waiting for approval`);
      let lastExtend = Date.now();
      while (status === 'pending' && !this.stopped) {
        await this.o.sleep(this.o.approvalPollMs);
        const cur = await this.client.request(requestId);
        status = cur.body.request.status;
        decision = { ...decision, reason: cur.body.decision?.reason ?? decision.reason };
        if (status === 'pending' && Date.now() - lastExtend >= this.o.extendEveryMs) {
          lastExtend = Date.now();
          await this.engine(`/external-task/${t.id}/extendLock`, { workerId: this.o.workerId, newDuration: this.o.lockMs });
        }
      }
      if (this.stopped && status === 'pending') return; // lock lapses, the task is picked up again after restart
    }
    if (status === 'approved') {
      await this.engine(`/external-task/${t.id}/complete`, {
        workerId: this.o.workerId,
        variables: { spendDecision: { value: 'approve', type: 'String' }, spendRequestId: { value: requestId, type: 'String' }, spendReason: { value: decision.reason, type: 'String' } },
      });
      this.o.log(`task ${t.id}: ${requestId} approved`);
    } else {
      await this.deny(t, `${status}: ${decision.reason}`, decision.reason, requestId);
    }
  }

  private async deny(t: EngineTask, message: string, reason: string, requestId?: string) {
    await this.engine(`/external-task/${t.id}/bpmnError`, {
      workerId: this.o.workerId, errorCode: ERROR_CODE, errorMessage: message.slice(0, 500),
      variables: { spendDecision: { value: 'deny', type: 'String' }, spendRequestId: { value: requestId ?? '', type: 'String' }, spendReason: { value: reason, type: 'String' } },
    });
    this.o.log(`task ${t.id}: ${ERROR_CODE} (${message})`);
  }

  /** Poll forever (until stop()). Engine errors are logged and retried after a pause. */
  async run() {
    while (!this.stopped) {
      try { if ((await this.pollOnce()) === 0) await this.o.sleep(this.o.pollMs); }
      catch (e) { this.o.log(`poll failed: ${(e as Error).message}`); await this.o.sleep(Math.max(this.o.pollMs, 3000)); }
    }
  }
  stop() { this.stopped = true; }
}
