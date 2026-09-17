'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type User = { id: string; username: string; firstName: string; lastName: string; employeeId?: string | null; organisationId?: string | null; roles: string[] };
type Plan = { id: string; status: string; employeeId: string; cycle: { name: string; reviewType: { name: string } }; employee?: { user: { firstName: string; lastName: string } }; assessments: { assessorType: string; status: string; overallScore?: number | string | null }[] };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [teamPlans, setTeamPlans] = useState<Plan[]>([]);
  const [unread, setUnread] = useState(0);
  const [message, setMessage] = useState('');

  async function request(path: string) {
    const token = localStorage.getItem('pms_token');
    if (!token) { router.replace('/login'); throw new Error('Not signed in'); }
    const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(await response.text() || 'Unable to load dashboard data');
    return response.json();
  }

  useEffect(() => {
    (async () => {
      try {
        const me: User = await request('/auth/me');
        setUser(me);
        const [myPlans, team, count] = await Promise.all([request('/performance/dashboard/me'), request('/performance/dashboard/team'), request('/notifications/unread-count')]);
        setPlans(myPlans);
        setTeamPlans(team);
        setUnread(count);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load dashboard.'); }
    })();
  }, [router]);

  const pendingTeam = teamPlans.filter((plan) => !plan.assessments.some((a) => a.assessorType === 'SUPERVISOR' && a.status !== 'DRAFT'));

  if (!user) return <main className="shell"><section className="card"><p>Loading dashboard…</p></section></main>;

  return <main className="shell"><section className="card">
    <p className="eyebrow">PMS DASHBOARD</p>
    <h1>Welcome, {user.firstName}</h1>
    <p>{user.username} · {user.roles.join(', ')}</p>
    {message && <p className="muted">{message}</p>}
    <div className="actions"><button className="button secondary" onClick={() => router.push('/notifications')}>Notifications{unread ? ` (${unread})` : ''}</button></div>
    <div className="grid">
      <section className="card"><h2>My Performance</h2><p>{plans.length} performance plan{plans.length === 1 ? '' : 's'}.</p>
        {plans.slice(0, 6).map((plan) => <article className="card" key={plan.id}><strong>{plan.cycle.name}</strong><p>{plan.cycle.reviewType.name} · {plan.status}</p><button className="button" onClick={() => router.push(`/performance/${plan.id}`)}>Open performance record</button></article>)}
        <button className="button secondary" onClick={() => router.push('/performance/history')}>View performance history</button>
      </section>
      <section className="card"><h2>My Team</h2><p>{teamPlans.length} active team performance plan{teamPlans.length === 1 ? '' : 's'}.</p><p className="muted">{pendingTeam.length} pending supervisor review{pendingTeam.length === 1 ? '' : 's'}.</p>
        {teamPlans.slice(0, 8).map((plan) => <article className="card" key={plan.id}><strong>{plan.employee?.user.firstName} {plan.employee?.user.lastName}</strong><p>{plan.cycle.name} · {plan.status}</p><button className="button secondary" onClick={() => router.push(`/performance/${plan.id}`)}>Review</button></article>)}
        <button className="button secondary" onClick={() => router.push('/performance/team')}>Open team review queue</button>
      </section>
      <section className="card"><h2>Reports</h2><p>Administrative reporting is available to authorised users.</p>{user.roles.some(r => ['SYSTEM_ADMIN', 'PERFORMANCE_ADMIN', 'HR_ADMIN'].includes(r)) && <button className="button secondary" onClick={() => router.push('/admin/reports')}>Open reports</button>}</section>
    </div>
    <button className="button secondary" onClick={async () => { const token = localStorage.getItem('pms_token'); if (token) await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined); localStorage.removeItem('pms_token'); router.push('/login'); }}>Sign out</button>
  </section></main>;
}
