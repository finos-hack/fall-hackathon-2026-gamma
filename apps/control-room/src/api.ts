export interface Req {
  id: string; ts: string; caseId: string; agentId: string; rootAgentId: string; delegationId?: string;
  kind: 'llm' | 'service'; service: string; amount: number; purpose: string;
  source?: string; status: 'approved' | 'denied' | 'pending' | 'rejected' | 'expired';
  inputTokens?: number; outputTokens?: number;
}
export interface Dec {
  outcome: 'approve' | 'deny' | 'escalate'; reasonCode: string; reason: string; ruleId?: string;
  linkedRequestIds?: string[]; approvalsRequired?: number;
}
export interface Appr { approverId: string; role: string; action: 'approve' | 'reject'; comment?: string }
export interface Row { request: Req; decision?: Dec; approvals: Appr[] }
export interface AgentInfo {
  agentId: string; tier: string; budgets: { perCase: number; perDay: number }; spentToday: number;
  suspended: boolean; suspendedReason?: string; projectedHourlyBurn?: number;
}
export interface State {
  policy: { name: string; version: string }; agents: AgentInfo[]; queue: Row[]; requests: Row[];
  cases: { caseId: string; byAgent: { agentId: string; spent: number }[] }[];
}
export interface Policy { approvers: { id: string; name: string; role: string }[] }

export async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { message?: string }).message ?? `HTTP ${res.status}`);
  return j as T;
}
export const money = (n: number) => `$${n.toFixed(2)}`;
