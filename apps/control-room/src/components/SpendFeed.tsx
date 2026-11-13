import { Check, Clock, X, ArrowRight } from 'lucide-react';
import type { Row } from '../api';
import { money } from '../api';

const BADGE = {
  approved: ['Approved', 'bg-green-100 text-green-800', Check],
  pending: ['Escalated', 'bg-amber-100 text-amber-800', Clock],
  denied: ['Denied', 'bg-red-100 text-red-800', X],
  rejected: ['Rejected', 'bg-red-100 text-red-800', X],
  expired: ['Expired', 'bg-red-100 text-red-800', X],
} as const;

export function DecisionBadge({ status, escalated }: { status: Row['request']['status']; escalated?: boolean }) {
  const [word, cls, Icon] = BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={12} /> {word}{escalated && status === 'approved' ? ' (after review)' : ''}
    </span>
  );
}

export function SpendFeed({ rows }: { rows: Row[] }) {
  const list = [...rows].reverse();
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Live spend feed</h2>
      {list.length === 0 && <p className="p-6 text-sm text-slate-500">No spend yet. Start a scenario from the Demo menu.</p>}
      <ul className="divide-y divide-slate-100">
        {list.map(({ request: r, decision: d }) => (
          <li key={r.id} className="feed-row flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <span className="w-16 tabular-nums text-slate-400">{new Date(r.ts).toLocaleTimeString([], { hour12: false })}</span>
            <span className="font-medium">{r.agentId}</span>
            {r.rootAgentId !== r.agentId && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                {r.rootAgentId} <ArrowRight size={10} /> {r.agentId}
              </span>
            )}
            {r.source && r.source !== 'scripted' && (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">{r.source === 'fluxnova' ? 'Fluxnova' : 'live LLM'}</span>
            )}
            <span className="text-slate-600">{r.service}</span>
            <span className="ml-auto font-medium tabular-nums">{money(r.amount)}</span>
            <DecisionBadge status={r.status} escalated={d?.outcome === 'escalate'} />
            {d?.ruleId && d.outcome !== 'approve' && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{d.ruleId}</span>
            )}
            <span className="basis-full pl-[4.75rem] text-xs text-slate-500">{r.caseId} · {d?.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
