import type { Row, State } from '../api';
import { money } from '../api';

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
      {sub && <div className="text-xs tabular-nums text-slate-400">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ state }: { state: State | null }) {
  const rows: Row[] = state?.requests ?? [];
  const spent = (state?.agents ?? []).reduce((a, x) => a + x.spentToday, 0);
  const budget = (state?.agents ?? []).reduce((a, x) => a + x.budgets.perDay, 0);
  const auto = rows.filter((r) => r.request.status === 'approved' && r.decision?.outcome === 'approve').length;
  const pending = state?.queue.length ?? 0;
  const denied = rows.filter((r) => ['denied', 'rejected', 'expired'].includes(r.request.status)).length;
  const frozen = (state?.agents ?? []).filter((a) => a.suspended).length;
  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-3 px-4 pt-4 md:grid-cols-5">
      <Tile label="Spend today" value={money(spent)} sub={`of ${money(budget)} budget`} />
      <Tile label="✓ Auto-approved" value={String(auto)} tone="text-green-700" />
      <Tile label="⏳ Escalated (pending)" value={String(pending)} tone={pending ? 'text-amber-700' : ''} />
      <Tile label="✕ Denied" value={String(denied)} tone={denied ? 'text-red-700' : ''} />
      <Tile label="Agents suspended" value={String(frozen)} tone={frozen ? 'text-red-700' : ''} />
    </div>
  );
}
