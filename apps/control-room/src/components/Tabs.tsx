import { useEffect, useState } from 'react';
import { Download, FileText, ShieldCheck, ShieldX } from 'lucide-react';
import { call, money, type AuditEntry, type Control, type State } from '../api';

export function AuditLog({ state }: { state: State | null }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [v, setV] = useState<{ ok: boolean; count: number } | null>(null);
  const [type, setType] = useState('');
  const [agent, setAgent] = useState('');
  const [caseId, setCase] = useState('');
  const cases = (state?.cases ?? []).map((c) => c.caseId);
  const evCase = caseId || cases[cases.length - 1] || '';
  useEffect(() => {
    call<AuditEntry[]>('GET', '/audit').then(setEntries).catch(() => {});
    call<{ ok: boolean; count: number }>('GET', '/audit/verify').then(setV).catch(() => {});
  }, [state]);
  const types = [...new Set(entries.map((e) => e.type))];
  const shown = entries
    .filter((e) => (!type || e.type === type) && (!agent || e.actor === agent || JSON.stringify(e.payload).includes(`"${agent}"`)))
    .reverse();
  const sel = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={sel} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">All agents</option>{(state?.agents ?? []).map((a) => <option key={a.agentId}>{a.agentId}</option>)}
        </select>
        {v && (v.ok
          ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"><ShieldCheck size={12} /> chain intact, {v.count} entries</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"><ShieldX size={12} /> chain BROKEN</span>)}
        <span className="ml-auto flex items-center gap-2">
          <select className={sel} value={evCase} onChange={(e) => setCase(e.target.value)} aria-label="Case for evidence report">
            {cases.length === 0 && <option value="">no cases yet</option>}{cases.map((c) => <option key={c}>{c}</option>)}
          </select>
          {evCase && (
            <>
              <a className={`${sel} inline-flex items-center gap-1`} href={`/api/evidence/${evCase}?format=md`} target="_blank" rel="noreferrer"><FileText size={12} /> Evidence report</a>
              <a className={`${sel} inline-flex items-center gap-1`} href={`/api/evidence/${evCase}`} target="_blank" rel="noreferrer">JSON</a>
            </>
          )}
          <a className={`${sel} inline-flex items-center gap-1`} href="/api/audit?format=csv"><Download size={12} /> CSV</a>
          <a className={`${sel} inline-flex items-center gap-1`} href="/api/audit" target="_blank" rel="noreferrer"><Download size={12} /> JSON</a>
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-slate-500"><tr><th className="py-1">#</th><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th><th>Hash</th></tr></thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.seq} className="border-t border-slate-100 align-top">
                <td className="py-1 tabular-nums">{e.seq}</td>
                <td className="tabular-nums">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</td>
                <td className="font-mono">{e.type}</td><td>{e.actor}</td>
                <td className="max-w-[420px] truncate text-slate-500" title={JSON.stringify(e.payload)}>{JSON.stringify(e.payload)}</td>
                <td className="font-mono text-slate-400">{e.hash.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AgentsPanel({ state, onResume }: { state: State | null; onResume: (id: string) => void }) {
  const dels = state?.delegations ?? [];
  const tone = (s: string) => (s === 'active' ? 'text-green-700' : s === 'pending' ? 'text-amber-700' : 'text-slate-500');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        {(state?.agents ?? []).map((a) => (
          <div key={a.agentId} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
            <div>
              <div className="font-medium">{a.agentId} <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{a.tier}</span></div>
              <div className="text-xs tabular-nums text-slate-500">per case {money(a.budgets.perCase)} · per day {money(a.budgets.perDay)} · spent today {money(a.spentToday)}</div>
              {a.suspended && <div className="text-xs text-red-700">{a.suspendedReason}</div>}
            </div>
            {a.suspended
              ? <button onClick={() => onResume(a.agentId)} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white">Resume</button>
              : <span className="text-xs font-medium text-green-700">✓ active</span>}
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Delegations</h3>
        {dels.length === 0 && <p className="text-sm text-slate-500">No delegations yet.</p>}
        <ul className="space-y-2 text-sm">
          {dels.map((d) => (
            <li key={d.id} style={{ marginLeft: (d.depth - 1) * 16 }} className="rounded border border-slate-200 p-2">
              <div className="font-medium">{d.parentAgentId} → {d.childAgentId}
                <span className={`ml-2 text-xs ${tone(d.status)}`}>{d.status}</span></div>
              <div className="text-xs tabular-nums text-slate-500">{d.caseId} · {money(d.spent)} / {money(d.amount)} · {d.services.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PolicyViewer({ controls }: { controls: Control[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500"><tr><th className="py-1">Rule</th><th>Control</th><th>Action</th><th>AIGF</th><th>CCC</th></tr></thead>
      <tbody>
        {controls.map((c) => (
          <tr key={c.id} className="border-t border-slate-100 align-top">
            <td className="py-1 font-mono">{c.id}</td><td>{c.name}</td><td>{c.action}</td>
            <td>{[...c.aigf.risks, ...c.aigf.mitigations].join(', ')}</td><td>{c.ccc ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
