import type { AgentState, Approval, Decision, Delegation, SpendRequest } from '../types.js';

export class MemoryStore {
  requests = new Map<string, SpendRequest>();
  decisions = new Map<string, Decision>();
  approvals: Approval[] = [];
  agents = new Map<string, AgentState>();
  delegations = new Map<string, Delegation>();
  seq = 0;
  dseq = 0;

  nextDelegationId() { return `dlg-${String(++this.dseq).padStart(4, '0')}`; }
  nextId() { return `req-${String(++this.seq).padStart(4, '0')}`; }
  approvalsFor(requestId: string) { return this.approvals.filter((a) => a.requestId === requestId); }
  suspended(agentId: string) { return this.agents.get(agentId)?.suspended === true; }
  reset() { this.requests.clear(); this.decisions.clear(); this.approvals = []; this.agents.clear(); this.delegations.clear(); this.seq = 0; this.dseq = 0; }
}
