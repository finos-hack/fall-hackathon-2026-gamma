import { CALM_CONTROL, type Ctx } from '../engine/authority.js';

const uniq = (a: string[]) => [...new Set(a)];

export function buildEvidence(ctx: Ctx, caseId: string) {
  const rows = [...ctx.store.requests.values()].filter((r) => r.caseId === caseId);
  const entries = ctx.audit.entries;
  const items = rows.map((r) => {
    const d = ctx.store.decisions.get(r.id);
    const hashes = entries.filter((e) => e.payload.requestId === r.id && e.type === 'DECISION').map((e) => e.hash);
    return {
      requestId: r.id, ts: r.ts, agentId: r.agentId, onBehalfOf: r.rootAgentId !== r.agentId ? r.rootAgentId : undefined,
      source: r.source, service: r.service, amount: r.amount, currency: r.currency, status: r.status,
      outcome: d?.outcome, reasonCode: d?.reasonCode, reason: d?.reason, ruleId: d?.ruleId, linkedRequestIds: d?.linkedRequestIds,
      rulesEvaluated: (d?.ruleTrace ?? []).map((t) => ({ ruleId: t.ruleId, result: t.result, detail: t.detail, ccc: t.ccc, aigf: t.aigf })),
      approvals: ctx.store.approvalsFor(r.id).map((a) => ({ approverId: a.approverId, role: a.role, action: a.action, comment: a.comment, ts: a.ts })),
      traceId: r.traceId, auditHash: hashes[hashes.length - 1],
    };
  });
  const fired = items.flatMap((i) => i.rulesEvaluated.filter((t) => t.result !== 'skip'));
  return {
    caseId, generatedAt: ctx.clock.now().toISOString(),
    policy: { name: ctx.policy.metadata.name, version: ctx.policy.metadata.version, approvedBy: ctx.policy.metadata.approvedBy },
    calm: { node: 'agent-spend-guard', control: 'agent-spend-authority', ref: CALM_CONTROL },
    totals: {
      requests: items.length, approved: items.filter((i) => i.status === 'approved').length,
      denied: items.filter((i) => i.status === 'denied' || i.status === 'rejected' || i.status === 'expired').length,
      pending: items.filter((i) => i.status === 'pending').length,
      spend: Math.round(items.filter((i) => i.status === 'approved').reduce((s, i) => s + i.amount, 0) * 1e4) / 1e4,
    },
    aigfRisks: uniq(fired.flatMap((t) => t.aigf?.risks ?? [])),
    aigfMitigations: uniq(fired.flatMap((t) => t.aigf?.mitigations ?? [])),
    cccControls: uniq(fired.map((t) => t.ccc ?? '').filter(Boolean)),
    chain: ctx.audit.verify(),
    items,
  };
}

export type Evidence = ReturnType<typeof buildEvidence>;

export function evidenceMarkdown(e: Evidence): string {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const L: string[] = [
    `# Evidence report: ${e.caseId}`, '',
    `Generated ${e.generatedAt} by Agent Spend Guard. Policy \`${e.policy.name}\` v${e.policy.version} (approved by ${e.policy.approvedBy}).`, '',
    `- **CALM:** node \`${e.calm.node}\`, control \`${e.calm.control}\` (\`${e.calm.ref}\`)`,
    `- **AIGF risks:** ${e.aigfRisks.join(', ') || '-'}`,
    `- **AIGF mitigations:** ${e.aigfMitigations.join(', ') || '-'}`,
    `- **CCC controls:** ${e.cccControls.join(', ') || '-'}`,
    `- **Audit chain:** ${e.chain.ok ? 'intact' : `BROKEN at seq ${e.chain.brokenAtSeq}`} (${e.chain.count} entries)`,
    `- **Totals:** ${e.totals.requests} requests, ${e.totals.approved} approved, ${e.totals.denied} denied or rejected, ${e.totals.pending} pending; approved spend ${usd(e.totals.spend)}`, '',
    '## Requests', '',
  ];
  for (const i of e.items) {
    L.push(`### ${i.requestId}: ${i.agentId}${i.onBehalfOf ? ` (for ${i.onBehalfOf})` : ''} bought ${i.service}, ${usd(i.amount)}`, '',
      `- **Decision:** ${i.outcome} / ${i.status}${i.reasonCode ? ` (${i.reasonCode}${i.ruleId ? `, rule ${i.ruleId}` : ''})` : ''}`,
      `- **Why:** ${i.reason ?? '-'}`, `- **Source:** ${i.source ?? '-'} · **Time:** ${i.ts}`);
    if (i.linkedRequestIds?.length) L.push(`- **Linked split parts:** ${i.linkedRequestIds.join(', ')}`);
    if (i.approvals.length) L.push(`- **Approvals:** ${i.approvals.map((a) => `${a.action} by ${a.approverId} (${a.role})`).join('; ')}`);
    L.push(`- **Trace:** \`${i.traceId}\` · **Audit hash:** \`${i.auditHash ?? '-'}\``, '', '| Rule | Result | CCC | AIGF risks | AIGF mitigations |', '|---|---|---|---|---|');
    for (const t of i.rulesEvaluated) L.push(`| ${t.ruleId} | ${t.result} | ${t.ccc ?? ''} | ${(t.aigf?.risks ?? []).join(', ')} | ${(t.aigf?.mitigations ?? []).join(', ')} |`);
    L.push('');
  }
  return L.join('\n');
}
