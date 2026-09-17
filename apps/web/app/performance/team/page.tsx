'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Plan = { id: string; status: string; employee: { user: { firstName: string; lastName: string }; department?: { name: string } | null; designation?: { name: string } | null }; cycle: { name: string; startsAt: string; endsAt: string; reviewType: { name: string } }; assessments: Array<{ assessorType: string; status: string }> };

export default function TeamQueue() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState('Loading…');
  useEffect(() => {
    const token = localStorage.getItem('pms_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/performance/dashboard/team`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); })
      .then(data => { setPlans(data); setMessage(''); })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Unable to load team queue.'));
  }, []);
  const pending = plans.filter(p => !p.assessments.some(a => a.assessorType === 'SUPERVISOR' && a.status !== 'DRAFT'));
  return <main className="shell"><section className="card">
    <p className="eyebrow">SUPERVISOR WORK QUEUE</p><h1>My team</h1><p>Performance records for your direct reports in active review cycles.</p>
    <div className="actions"><Link className="button secondary" href="/dashboard">Back to dashboard</Link></div>
    {message && <p className="muted">{message}</p>}
    {!message && <p>{pending.length} record{pending.length === 1 ? '' : 's'} awaiting your supervisor assessment.</p>}
    <div className="grid">{plans.map(plan => <article className="card" key={plan.id}><h2>{plan.employee.user.firstName} {plan.employee.user.lastName}</h2><p>{plan.employee.designation?.name ?? 'No designation'} · {plan.employee.department?.name ?? 'No department'}</p><p>{plan.cycle.name} · {plan.cycle.reviewType.name}</p><p>Status: {plan.status}</p><Link className="button" href={`/performance/${plan.id}`}>Open review</Link></article>)}</div>
  </section></main>;
}
