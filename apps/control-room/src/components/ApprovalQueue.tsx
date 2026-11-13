import type { Row } from '../api';
import { money } from '../api';

export function ApprovalQueue(p: { queue: Row[]; byId: Map<string, Row>; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Approval queue ({p.queue.length})</h2>
      {p.queue.length === 0 && <p className="text-sm text-slate-500">Nothing waiting for a human.</p>}
      <div className="space-y-3">
        {p.queue.map(({ request: r, decision: d, approvals }) => {
          const need = d?.approvalsRequired ?? 1;
          const done = approvals.filter((a) => a.action === 'approve');
          return (
            <article key={r.id} className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <b className="text-lg tabular-nums">{money(r.amount)}</b>
                <span className="text-xs text-slate-500">{r.caseId}</span>
              </div>
              <div className="text-slate-600">{r.agentId} · {r.service}</div>
              <p className="mt-2 text-slate-800"><span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{d?.ruleId}</span>{d?.reason}</p>
              {!!d?.linkedRequestIds?.length && (
                <ul className="mt-2 rounded bg-white p-2 text-xs text-slate-600">
                  <li className="font-medium text-slate-700">Linked earlier purchases (possible split):</li>
                  {d.linkedRequestIds.map((id) => {
                    const l = p.byId.get(id)?.request;
                    return <li key={id} className="tabular-nums">{l ? `${l.service} · ${money(l.amount)}` : id}</li>;
                  })}
                </ul>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600" aria-label={`${done.length} of ${need} approvals`}>
                {Array.from({ length: need }, (_, i) => (
                  <span key={i} className={i < done.length ? 'text-green-600' : 'text-slate-300'}>{i < done.length ? '●' : '○'}</span>
                ))}
                <span>{done.length}/{need} approvals{done.length ? ` (${done.map((a) => a.approverId).join(', ')})` : ''}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => p.onApprove(r.id)} className="flex-1 rounded bg-green-600 py-1.5 font-medium text-white hover:bg-green-700">Approve</button>
                <button onClick={() => p.onReject(r.id)} className="flex-1 rounded border border-red-300 py-1.5 font-medium text-red-700 hover:bg-red-50">Reject</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
