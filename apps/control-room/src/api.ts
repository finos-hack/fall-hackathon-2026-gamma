export interface Req {
  id: string; ts: string; caseId: string; agentId: string; rootAgentId: string; delegationId?: string;
  kind: 'llm' | 'service'; service: string; amount: number; purpose: string;
  source?: string; status: 'approved' | 'denied' | 'pending' | 'rejected' | 'expired';
  inputTokens?: number; outputTokens?: number; traceId?: string;
}
export interface Dec {
  outcome: 'approve' | 'deny' | 'escalate'; reasonCode: string; reason: string; ruleId?: string;
  linkedRequestIds?: string[]; approvalsRequired?: number;
  ruleTrace?: { ruleId: string; result: 'pass' | 'fail' | 'skip'; detail?: string; aigf?: { risks: string[]; mitigations: string[] }; ccc?: string }[];
  limitsSnapshot?: { tier: string; autoApproveUpTo: number; remaining: number };
  calmControl?: string; policyVersion?: string;
}
export interface Delegation {
  id: string; parentAgentId: string; childAgentId: string; rootAgentId: string; caseId: string;
  amount: number; spent: number; services: string[]; depth: number; status: string; expiresAt: string;
}
export interface AuditEntry { seq: number; ts: string; type: string; actor: string; payload: Record<string, unknown>; hash: string }
export interface Appr { approverId: string; role: string; action: 'approve' | 'reject'; comment?: string }
export interface Row { request: Req; decision?: Dec; approvals: Appr[] }
export interface AgentInfo {
  agentId: string; tier: string; budgets: { perCase: number; perDay: number }; spentToday: number;
  suspended: boolean; suspendedReason?: string; projectedHourlyBurn?: number;
}
export interface State {
  policy: { name: string; version: string }; agents: AgentInfo[]; queue: Row[]; requests: Row[];
  delegations: Delegation[];
  cases: { caseId: string; byAgent: { agentId: string; spent: number }[] }[];
}
export interface Control { id: string; name: string; enabled: boolean; action: string; ccc?: string; aigf: { risks: string[]; mitigations: string[] }; rationale: string }
export interface Policy { approvers: { id: string; name: string; role: string }[]; controls?: Control[] }

export async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { message?: string }).message ?? `HTTP ${res.status}`);
  return j as T;
}
export const money = (n: number) => `$${n.toFixed(2)}`;
