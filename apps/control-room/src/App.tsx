import { useEffect, useState } from 'react';
import { call, money, type Row } from './api';
import { useGuard } from './useGuard';
import { Header, SuspensionBanner, Toasts } from './components/Header';
import { SpendFeed } from './components/SpendFeed';
import { ApprovalQueue } from './components/ApprovalQueue';
import { KpiStrip } from './components/Kpi';
import { CaseBudgets } from './components/CaseBudgets';
import { RequestDrawer } from './components/RequestDrawer';
import { AgentsPanel, AuditLog, PolicyViewer } from './components/Tabs';

export default function App() {
  const { state, policy, online, refresh } = useGuard();
  const [actor, setActor] = useState('sofia');
  const [tab, setTab] = useState<'audit' | 'agents' | 'policy'>('audit');
  const [selected, setSelected] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; text: string; bad: boolean }[]>([]);

  const toast = (text: string, bad = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); } catch (e) { toast((e as Error).message, true); }
    refresh();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'd' && !(e.target instanceof HTMLInputElement)) setShowDemo((v) => !v); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const rows: Row[] = state?.requests ?? [];
  const byId = new Map(rows.map((r) => [r.request.id, r]));
  const frozen = (state?.agents ?? []).filter((a) => a.suspended);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SuspensionBanner agents={frozen} onResume={(id) => act(() => call('POST', `/agents/${id}/resume`, { approverId: actor }), `${id} resumed`)} />
      <Header
        state={state} approvers={policy?.approvers ?? []} actor={actor} setActor={setActor} online={online} showDemo={showDemo}
        onRun={(id) => act(() => call('POST', `/scenarios/${id}/run`), `Scenario ${id} started`)}
        onReset={() => act(() => call('POST', '/reset'), 'Guard reset')}
      />
      <KpiStrip state={state} />
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <SpendFeed rows={rows} onSelect={setSelected} />
        <div className="space-y-4">
          <ApprovalQueue
            queue={state?.queue ?? []} byId={byId}
            onApprove={(id) => act(() => call('POST', `/requests/${id}/approve`, { approverId: actor }), 'Approval recorded')}
            onReject={(id) => act(() => call('POST', `/requests/${id}/reject`, { approverId: actor, comment: 'Rejected in control room' }), 'Request rejected')}
          />
          <CaseBudgets state={state} />
        </div>
      </main>
      <section className="mx-auto mb-6 max-w-[1440px] px-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-4 border-b border-slate-200 text-sm">
            {([['audit', 'Audit log & evidence'], ['agents', 'Agents & delegations'], ['policy', 'Policy']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-2 ${tab === k ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500'}`}>{l}</button>
            ))}
          </div>
          {tab === 'audit' && <AuditLog state={state} />}
          {tab === 'agents' && <AgentsPanel state={state} onResume={(id) => act(() => call('POST', `/agents/${id}/resume`, { approverId: actor }), `${id} resumed`)} />}
          {tab === 'policy' && <PolicyViewer controls={policy?.controls ?? []} />}
        </div>
      </section>
      <RequestDrawer row={selected ? byId.get(selected) : undefined} controls={policy?.controls ?? []} onClose={() => setSelected(null)} />
      <Toasts toasts={toasts} />
    </div>
  );
}
