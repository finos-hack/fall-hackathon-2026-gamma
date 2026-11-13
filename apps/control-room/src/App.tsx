import { useEffect, useState } from 'react';
import { call, money, type Row } from './api';
import { useGuard } from './useGuard';
import { Header, SuspensionBanner, Toasts } from './components/Header';
import { SpendFeed } from './components/SpendFeed';
import { ApprovalQueue } from './components/ApprovalQueue';

export default function App() {
  const { state, policy, online, refresh } = useGuard();
  const [actor, setActor] = useState('sofia');
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
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <SpendFeed rows={rows} />
        <div className="space-y-4">
          <ApprovalQueue
            queue={state?.queue ?? []} byId={byId}
            onApprove={(id) => act(() => call('POST', `/requests/${id}/approve`, { approverId: actor }), 'Approval recorded')}
            onReject={(id) => act(() => call('POST', `/requests/${id}/reject`, { approverId: actor, comment: 'Rejected in control room' }), 'Request rejected')}
          />
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Agents</h2>
            <ul className="space-y-1 text-sm">
              {(state?.agents ?? []).map((a) => (
                <li key={a.agentId} className="flex justify-between tabular-nums">
                  <span>{a.agentId} <span className="text-slate-400">({a.tier})</span></span>
                  <span className={a.suspended ? 'font-medium text-red-700' : 'text-slate-600'}>
                    {a.suspended ? 'frozen' : `${money(a.spentToday)} / ${money(a.budgets.perDay)} today`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Toasts toasts={toasts} />
    </div>
  );
}
