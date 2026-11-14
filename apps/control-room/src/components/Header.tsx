import { ChevronDown, Play, RotateCcw, ShieldAlert, Diamond } from 'lucide-react';
import type { AgentInfo, FinosStatus, State } from '../api';
import { money } from '../api';

const SCENARIOS = [
  ['S1', 'Normal loan case'], ['S2', 'High-value, four-eyes'], ['S3', 'Split purchase (structuring)'],
  ['S4', 'Delegation to helper'], ['S5', 'Runaway agent'],
];

export function Header(p: {
  state: State | null; finos: FinosStatus | null; approvers: { id: string; name: string; role: string }[]; actor: string; setActor: (s: string) => void;
  online: boolean; showDemo: boolean; onRun: (id: string) => void; onReset: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-lg font-semibold"><Diamond size={18} className="text-indigo-600" /> Agent Spend Guard</div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" title="Active policy">
        {p.state ? `policy "${p.state.policy.name}" v${p.state.policy.version}` : p.online ? 'loading...' : 'guard unreachable'}
      </span>
      <FinosChainBadge finos={p.finos} />
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Acting as
          <select value={p.actor} onChange={(e) => p.setActor(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900">
            {p.approvers.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>
        </label>
        {p.showDemo && (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
              <Play size={14} /> Demo <ChevronDown size={14} />
            </summary>
            <ul className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              {SCENARIOS.map(([id, label]) => (
                <li key={id}>
                  <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={(e) => { p.onRun(id); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; }}>
                    <b>{id}</b> · {label}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <button onClick={p.onReset} className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </header>
  );
}

function FinosChainBadge({ finos }: { finos: FinosStatus | null }) {
  const items: [string, boolean, string][] = finos ? [
    ['AIGF', finos.aigf.ok, `${finos.aigf.ids.length} risk and mitigation ids referenced by the policy`],
    ['CALM', finos.calm.ok, `binding verified at startup, sha256 ${finos.calm.sha.slice(0, 12)}`],
    ['CCC', finos.ccc.ok, `${finos.ccc.controls.length} controls in the catalog`],
    ['Fluxnova', finos.fluxnova.connected, finos.fluxnova.connected ? `last call ${finos.fluxnova.lastCallAt}` : 'no call from the loan process yet'],
  ] : [];
  return (
    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs" title="FINOS pipeline: AIGF, CALM, CCC, Fluxnova">
      <span className="text-slate-500">FINOS chain</span>
      {finos ? items.map(([name, ok, tip]) => (
        <span key={name} title={tip} className={ok ? 'font-medium text-green-700' : 'text-slate-400'}>{name} {ok ? '✓' : '–'}</span>
      )) : <span className="text-slate-400">checking...</span>}
    </span>
  );
}

export function SuspensionBanner({ agents, onResume }: { agents: AgentInfo[]; onResume: (id: string) => void }) {
  return (
    <>
      {agents.map((a) => (
        <div key={a.agentId} className="flex items-center gap-3 bg-red-700 px-4 py-2 text-sm text-white">
          <ShieldAlert size={18} />
          <span>
            <b>{a.agentId} frozen:</b> {a.suspendedReason ?? 'looping'}
            {a.projectedHourlyBurn != null && <>, projected <b className="tabular-nums">{money(a.projectedHourlyBurn)}/hour</b></>}.
          </span>
          <button onClick={() => onResume(a.agentId)} className="ml-auto rounded bg-white px-3 py-1 font-medium text-red-700">Resume</button>
        </div>
      ))}
    </>
  );
}

export function Toasts({ toasts }: { toasts: { id: number; text: string; bad: boolean }[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-30 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`max-w-sm rounded-md px-4 py-2 text-sm text-white shadow-lg ${t.bad ? 'bg-red-700' : 'bg-slate-800'}`}>{t.text}</div>
      ))}
    </div>
  );
}
