import type { State } from '../api';
import { money } from '../api';

export function CaseBudgets({ state }: { state: State | null }) {
  const agents = new Map((state?.agents ?? []).map((a) => [a.agentId, a]));
  const cases = [...(state?.cases ?? [])].reverse();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Case budgets</h2>
      {cases.length === 0 && <p className="text-sm text-slate-500">No cases yet.</p>}
      <ul className="space-y-3">
        {cases.map((c) => (
          <li key={c.caseId}>
            <div className="mb-1 text-xs font-medium text-slate-600">{c.caseId}</div>
            {c.byAgent.map((b) => {
              const cap = agents.get(b.agentId)?.budgets.perCase ?? 1;
              const pct = Math.min(100, (b.spent / cap) * 100);
              return (
                <div key={b.agentId} className="mb-1">
                  <div className="flex justify-between text-xs tabular-nums text-slate-500">
                    <span>{b.agentId}</span><span>{money(b.spent)} / {money(cap)}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className={`h-2 rounded ${pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
