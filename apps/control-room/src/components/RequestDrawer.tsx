import { Check, Minus, X } from 'lucide-react';
import type { Control, Row } from '../api';
import { money } from '../api';
import { DecisionBadge } from './SpendFeed';

const ICON = { pass: [Check, 'text-green-700'], fail: [X, 'text-red-700'], skip: [Minus, 'text-slate-400'] } as const;

export function RequestDrawer({ row, controls, onClose }: { row: Row | undefined; controls: Control[]; onClose: () => void }) {
  if (!row) return null;
  const { request: r, decision: d, approvals } = row;
  const trace = d?.ruleTrace ?? [];
  const uniq = (xs: string[]) => [...new Set(xs)].join(', ') || '-';
  const aigfAll = uniq(trace.flatMap((t) => [...(t.aigf?.risks ?? []), ...(t.aigf?.mitigations ?? [])]));
  const cccAll = uniq(trace.flatMap((t) => (t.ccc ? [t.ccc] : [])));
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Request {r.id.slice(0, 8)}</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="mb-3 flex items-center gap-2"><DecisionBadge status={r.status} /><span className="text-lg font-semibold tabular-nums">{money(r.amount)}</span></div>
        <p className="mb-4 text-sm text-slate-700">{d?.reason}</p>
        <dl className="mb-4 grid grid-cols-[110px_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">Agent</dt><dd>{r.agentId}{r.rootAgentId !== r.agentId && ` (for ${r.rootAgentId})`}</dd>
          <dt className="text-slate-500">Case</dt><dd>{r.caseId}</dd>
          <dt className="text-slate-500">Service</dt><dd>{r.service}</dd>
          {r.kind === 'llm' && (<><dt className="text-slate-500">Tokens</dt><dd className="tabular-nums">{r.inputTokens} in / {r.outputTokens} out</dd></>)}
          <dt className="text-slate-500">Purpose</dt><dd>{r.purpose}</dd>
          <dt className="text-slate-500">Source</dt><dd>{r.source ?? 'scripted'}</dd>
          <dt className="text-slate-500">Rule / code</dt><dd>{d?.ruleId ?? '-'} · {d?.reasonCode}</dd>
          <dt className="text-slate-500">Limits</dt>
          <dd className="tabular-nums">{d?.limitsSnapshot ? `${d.limitsSnapshot.tier}: signing limit ${money(d.limitsSnapshot.autoApproveUpTo)}, remaining ${money(d.limitsSnapshot.remaining)}` : '-'}</dd>
          <dt className="text-slate-500">AIGF</dt><dd>{aigfAll}</dd>
          <dt className="text-slate-500">CCC</dt><dd>{cccAll}</dd>
          <dt className="text-slate-500">CALM control</dt><dd>{d?.calmControl ?? '-'}</dd>
          <dt className="text-slate-500">Trace ID</dt><dd className="break-all font-mono text-xs">{r.traceId ?? '-'}</dd>
        </dl>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Rule trace</h3>
        <ul className="mb-4 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
          {trace.map((t, i) => {
            const [Icon, cls] = ICON[t.result];
            return (
              <li key={i} className="flex flex-wrap items-start gap-2 px-3 py-1.5">
                <Icon size={14} className={`mt-0.5 ${cls}`} />
                <span className="font-mono text-xs">{t.ruleId}</span>
                <span className={`text-xs font-medium ${cls}`}>{t.result}</span>
                <span className="text-xs text-slate-500">{t.detail}</span>
                {(t.aigf || t.ccc) && <span className="basis-full pl-5 text-[11px] text-slate-400">{[...(t.aigf?.risks ?? []), ...(t.aigf?.mitigations ?? []), t.ccc].filter(Boolean).join(' · ')}</span>}
              </li>
            );
          })}
        </ul>
        {approvals.length > 0 && (
          <>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Approvals</h3>
            <ul className="text-sm">{approvals.map((a, i) => <li key={i}>{a.approverId} ({a.role}): {a.action}{a.comment ? ` - ${a.comment}` : ''}</li>)}</ul>
          </>
        )}
      </aside>
    </div>
  );
}
