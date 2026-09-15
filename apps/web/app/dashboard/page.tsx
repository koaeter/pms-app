'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type User = { id: string; username: string; firstName: string; lastName: string; roles: string[] };
type Employee = { id: string; userId: string; managerId?: string | null; organisationId?: string | null; user: { firstName: string; lastName: string } };
type Plan = { id: string; status: string; employeeId: string; cycle: { name: string; organisationId: string; reviewType: { name: string } }; employee: { user: { firstName: string; lastName: string }; managerId?: string | null }; assessments: { assessorType: string; status: string; overallScore?: number | string | null }[] };
type Organisation = { id: string; name: string; code: string };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [teamPlans, setTeamPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState('');

  async function request(path: string) {
    const token = localStorage.getItem('pms_token');
    if (!token) { router.replace('/login'); throw new Error('Not signed in'); }
    const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to load dashboard data');
    return response.json();
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await request('/auth/me');
        setUser(me);
        const organisations: Organisation[] = await request('/organisation');
        let employee: Employee | null = null;
        let organisation: Organisation | null = null;
        for (const candidate of organisations) {
          const employees: Employee[] = await request(`/organisation/${candidate.id}/employees`);
          const match = employees.find((item) => item.userId === me.id);
          if (match) { employee = match; organisation = candidate; break; }
        }
        if (!employee || !organisation) { setMessage('Your account is not yet linked to an employee record.'); return; }
        const cycles = await request(`/performance/organisations/${organisation.id}/cycles`);
        const allPlans: Plan[] = [];
        for (const cycle of cycles) allPlans.push(...await request(`/performance/cycles/${cycle.id}/plans`));
        setPlans(allPlans.filter((plan) => plan.employeeId === employee!.id));
        setTeamPlans(allPlans.filter((plan) => plan.employee.managerId === employee!.id));
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load dashboard.'); }
    })();
  }, [router]);

  const pendingTeam = teamPlans.filter((plan) => !plan.assessments.some((a) => a.assessorType === 'SUPERVISOR' && a.status !== 'DRAFT'));

  if (!user) return <main className="shell"><section className="card"><p>Loading dashboard…</p></section></main>;

  return <main className="shell"><section className="card">
    <p className="eyebrow">PMS DASHBOARD</p>
    <h1>Welcome, {user.firstName}</h1>
    <p>{user.username}</p>
    {message && <p className="muted">{message}</p>}
    <div className="grid">
      <section className="card"><h2>My Performance</h2><p>{plans.length} performance plan{plans.length === 1 ? '' : 's'}.</p>
        {plans.map((plan) => <article className="card" key={plan.id}><strong>{plan.cycle.name}</strong><p>{plan.cycle.reviewType.name} · {plan.status}</p><button className="button" onClick={() => router.push(`/performance/${plan.id}`)}>Open performance record</button></article>)}
      </section>
      <section className="card"><h2>My Team</h2><p>{teamPlans.length} team performance plan{teamPlans.length === 1 ? '' : 's'}.</p><p className="muted">{pendingTeam.length} pending supervisor review{pendingTeam.length === 1 ? '' : 's'}.</p>
        {teamPlans.slice(0, 8).map((plan) => <article className="card" key={plan.id}><strong>{plan.employee.user.firstName} {plan.employee.user.lastName}</strong><p>{plan.cycle.name} · {plan.status}</p><button className="button secondary" onClick={() => router.push(`/performance/${plan.id}`)}>Review</button></article>)}
      </section>
      <section className="card"><h2>Reports</h2><p>Performance reporting will be expanded in the reporting pass.</p></section>
    </div>
    <button className="button secondary" onClick={() => { localStorage.removeItem('pms_token'); router.push('/login'); }}>Sign out</button>
  </section></main>;
}
