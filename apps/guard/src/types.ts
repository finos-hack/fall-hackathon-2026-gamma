export type Outcome = 'approve' | 'deny' | 'escalate';
export type Status = 'approved' | 'denied' | 'pending' | 'rejected' | 'expired';

export interface SpendRequest {
  id: string; ts: string;
  caseId: string; agentId: string;
  delegationId?: string; rootAgentId: string;
  kind: 'llm' | 'service'; service: string;
  inputTokens?: number; outputTokens?: number; promptHash?: string;
  quantity?: number; params?: Record<string, unknown>; paramsHash?: string;
  amount: number; currency: 'USD'; purpose: string;
  source?: 'scripted' | 'live-llm' | 'fluxnova';
  status: Status; traceId: string; spanId: string;
}
export interface RuleResult {
  ruleId: string; result: 'pass' | 'fail' | 'skip'; detail?: string;
  aigf?: { risks: string[]; mitigations: string[] }; ccc?: string;
}
export interface Decision {
  requestId: string; outcome: Outcome; reasonCode: string; reason: string;
  ruleId?: string; ruleTrace: RuleResult[]; linkedRequestIds?: string[];
  approvalsRequired?: 0 | 1 | 2; policyVersion: string; evaluatedAt: string;
  calmControl: string;
  limitsSnapshot: { tier: string; autoApproveUpTo: number; remaining: number };
}
export interface Approval {
  requestId: string; approverId: string; role: string;
  action: 'approve' | 'reject'; comment?: string; ts: string;
}
export interface Delegation {
  id: string; parentAgentId: string; childAgentId: string; rootAgentId: string; caseId: string;
  amount: number; spent: number; services: string[]; depth: number;
  status: 'active' | 'pending' | 'denied' | 'expired'; createdAt: string; expiresAt: string;
}
export interface AgentState {
  agentId: string; suspended: boolean; suspendedReason?: string; projectedHourlyBurn?: number;
  /** Store sequence at the last resume: runaway counting ignores requests up to this point. */
  resumedAtSeq?: number;
}
export type AuditType =
  | 'POLICY_LOADED' | 'CALM_BINDING_VERIFIED' | 'SPEND_REQUESTED' | 'DECISION' | 'APPROVAL_GIVEN'
  | 'APPROVAL_REJECTED' | 'REQUEST_EXPIRED' | 'STRUCTURING_LINKED' | 'DELEGATION_GRANTED'
  | 'DELEGATION_DENIED' | 'AGENT_SUSPENDED' | 'AGENT_RESUMED';
export interface AuditEntry {
  seq: number; ts: string; type: AuditType; actor: string;
  payload: Record<string, unknown>; prevHash: string; hash: string;
}
export type SseEventType = 'request' | 'decision' | 'approval' | 'delegation' | 'agent' | 'audit' | 'reset';

/** Input of POST /api/spend. */
export interface SpendInput {
  caseId: string; agentId: string; delegationId?: string;
  kind: 'llm' | 'service'; service: string;
  inputTokens?: number; outputTokens?: number; promptHash?: string;
  quantity?: number; params?: Record<string, unknown>;
  purpose?: string; source?: SpendRequest['source'];
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
