import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState('checking…');
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((j) => setHealth(j.status)).catch(() => setHealth('guard unreachable'));
  }, []);
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <h1 className="text-2xl font-semibold">◆ Agent Spend Guard</h1>
      <p className="mt-2 text-slate-600">Guard API: <span className="font-mono">{health}</span></p>
    </main>
  );
}
