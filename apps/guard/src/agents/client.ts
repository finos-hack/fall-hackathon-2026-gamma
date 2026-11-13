/** Thin client for the guard's HTTP API. Scripted agents only ever talk to the guard through this. */
export interface Reply { status: number; body: any }
export type Transport = (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<Reply>;

/** Real network transport (for agents running outside the guard process). */
export const fetchTransport = (baseUrl: string): Transport => async (method, path, body) => {
  const res = await fetch(baseUrl + path, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

export interface SpendBody {
  caseId: string; agentId: string; delegationId?: string; kind: 'llm' | 'service'; service: string;
  inputTokens?: number; outputTokens?: number; promptHash?: string; quantity?: number;
  params?: Record<string, unknown>; purpose?: string;
}
export interface GrantBody {
  parentAgentId: string; childAgentId: string; caseId: string; amount: number; services: string[];
  ttlMinutes?: number; parentDelegationId?: string;
}

export class GuardClient {
  constructor(private t: Transport, private source: 'scripted' | 'live-llm' | 'fluxnova' = 'scripted') {}
  spend(b: SpendBody) { return this.t('POST', '/api/spend', { ...b, source: this.source }); }
  grant(b: GrantBody) { return this.t('POST', '/api/delegations', b); }
  request(id: string) { return this.t('GET', `/api/requests/${id}`); }
  state() { return this.t('GET', '/api/state'); }
}
