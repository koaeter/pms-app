'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Cycle = { id: string; name: string; status: string };
type Candidate = { id: string; employeeNumber: string; firstName: string; lastName: string; department?: string | null; designation?: string | null; roles: string[] };
type Plan = {
  id: string;
  status: string;
  employee: { id: string; employeeNumber: string; user: { firstName: string; lastName: string } };
};

type Assignment = { reviewerId?: string | null; finalAssessorId?: string | null };

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('pms_token');
  return fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
}

export default function PerformanceAssignments() {
  const [organisationId, setOrganisationId] = useState('');
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [planId, setPlanId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [finalAssessorId, setFinalAssessorId] = useState('');
  const [message, setMessage] = useState('');

  async function loadOrganisation(id: string) {
    if (!id) return;
    localStorage.setItem('pms_organisation_id', id);
    const [cyclesResponse, candidatesResponse] = await Promise.all([
      request(`/performance/organisations/${id}/cycles`),
      request(`/performance/organisations/${id}/assessor-candidates`),
    ]);
    if (cyclesResponse.ok) {
      const data = await cyclesResponse.json();
      setCycles(data);
      if (!cycleId && data[0]) setCycleId(data[0].id);
    }
    if (candidatesResponse.ok) setCandidates(await candidatesResponse.json());
  }

  async function loadPlans(id: string) {
    if (!id) return;
    const response = await request(`/performance/cycles/${id}/plans`);
    if (!response.ok) { setMessage(await response.text()); return; }
    const data = await response.json();
    setPlans(data);
    setPlanId('');
    setReviewerId('');
    setFinalAssessorId('');
  }

  async function loadPlan(id: string) {
    if (!id) return;
    const response = await request(`/performance/plans/${id}`);
    if (!response.ok) { setMessage(await response.text()); return; }
    const plan = await response.json();
    setReviewerId(plan.reviewerId ?? '');
    setFinalAssessorId(plan.finalAssessorId ?? '');
  }

  useEffect(() => {
    const saved = localStorage.getItem('pms_organisation_id') ?? '';
    setOrganisationId(saved);
    if (saved) loadOrganisation(saved);
  }, []);

  useEffect(() => { if (cycleId) loadPlans(cycleId); }, [cycleId]);
  useEffect(() => { if (planId) loadPlan(planId); }, [planId]);

  async function save() {
    if (!planId) return;
    const response = await request(`/performance/plans/${planId}/assessors`, {
      method: 'POST',
      body: JSON.stringify({ reviewerId: reviewerId || null, finalAssessorId: finalAssessorId || null }),
    });
    if (!response.ok) { setMessage(await response.text()); return; }
    setMessage('Assessor assignments saved.');
    await loadPlan(planId);
  }

  return <main className="shell"><section className="card">
    <p className="eyebrow">PERFORMANCE ADMINISTRATION</p>
    <h1>Reviewer & final assessor assignments</h1>
    <p>Assign the employees who are authorised to complete the reviewer and final assessment stages for each performance plan.</p>
    <div className="actions">
      <Link className="button secondary" href="/admin/performance">Back to performance configuration</Link>
      <Link className="button secondary" href="/admin">Administration</Link>
    </div>
    {message && <p className="muted">{message}</p>}

    <div className="card">
      <h2>Organisation</h2>
      <label>Organisation ID<input value={organisationId} onChange={e => setOrganisationId(e.target.value)} placeholder="Organisation ID" /></label>
      <button className="button" onClick={() => loadOrganisation(organisationId)}>Load</button>
    </div>

    {organisationId && <>
      <div className="card">
        <h2>Performance plan</h2>
        <label>Cycle<select value={cycleId} onChange={e => setCycleId(e.target.value)}><option value="">Select cycle…</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}</select></label>
        <label>Employee plan<select value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Select employee…</option>{plans.map(p => <option key={p.id} value={p.id}>{p.employee.user.firstName} {p.employee.user.lastName} · {p.employee.employeeNumber} · {p.status}</option>)}</select></label>
      </div>

      {planId && <div className="grid">
        <div className="card">
          <h2>Reviewer</h2>
          <p className="muted">Only employees with reviewer/admin eligibility are shown.</p>
          <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}><option value="">Unassigned</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.employeeNumber}{c.department ? ` · ${c.department}` : ''}</option>)}</select>
        </div>
        <div className="card">
          <h2>Final assessor</h2>
          <p className="muted">Final assessment is a separate workflow stage.</p>
          <select value={finalAssessorId} onChange={e => setFinalAssessorId(e.target.value)}><option value="">Unassigned</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.employeeNumber}{c.department ? ` · ${c.department}` : ''}</option>)}</select>
        </div>
      </div>}

      {planId && <div className="card"><button className="button" onClick={save}>Save assignments</button></div>}
    </>}
  </section></main>;
}
