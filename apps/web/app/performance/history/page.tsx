'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Plan = { id: string; status: string; cycle: { name: string; startsAt: string; endsAt: string; programme: { name: string }; reviewType: { name: string } }; assessments: Array<{ assessorType: string; status: string; overallScore?: string | number | null; comment?: string | null }> };

export default function PerformanceHistory() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState('Loading…');

  useEffect(() => {
    const token = localStorage.getItem('pms_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/performance/dashboard/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); })
      .then((data) => { setPlans(data); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load history.'));
  }, []);

  return <main className="shell"><section className="card">
    <p className="eyebrow">PERFORMANCE HISTORY</p><h1>My performance history</h1>
    <p className="muted">Completed assessment records across your performance cycles.</p>
    <div className="actions"><Link className="button secondary" href="/dashboard">Back to dashboard</Link></div>
    {message && <p className="muted">{message}</p>}
    {!message && plans.length === 0 && <p>No performance history is available yet.</p>}
    <div className="grid">{plans.map((plan) => <article className="card" key={plan.id}>
      <h2>{plan.cycle.name}</h2><p>{plan.cycle.programme.name} · {plan.cycle.reviewType.name}</p><p>{new Date(plan.cycle.startsAt).toLocaleDateString()} – {new Date(plan.cycle.endsAt).toLocaleDateString()} · {plan.status}</p>
      {plan.assessments.map((assessment) => <div key={`${assessment.assessorType}-${assessment.status}`}><strong>{assessment.assessorType}</strong><p>{assessment.status} · {assessment.overallScore != null ? `${Number(assessment.overallScore).toFixed(2)}%` : 'No score'}</p>{assessment.comment && <p className="muted">{assessment.comment}</p>}</div>)}
      <Link className="button" href={`/performance/${plan.id}`}>Open record</Link>
    </article>)}</div>
  </section></main>;
}
