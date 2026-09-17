'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Organisation = { id: string; name: string; code: string };
type Summary = { organisation: Organisation; employeeCount: number; planCount: number; approvedPlanCount: number; averageApprovedScore: number | null; statusCounts: Record<string, number>; cycles: Array<{ id: string; name: string; status: string; planCount: number; programme: { name: string }; reviewType: { name: string }; startsAt: string; endsAt: string }> };

export default function ReportsAdmin() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [organisationId, setOrganisationId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState('');

  async function request(path: string) {
    const token = localStorage.getItem('pms_token');
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function loadSummary(id = organisationId) {
    if (!id) return;
    try { setSummary(await request(`/reports/organisations/${id}/performance-summary`)); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load report.'); }
  }

  useEffect(() => {
    request('/organisation').then((data: Organisation[]) => {
      setOrganisations(data);
      const saved = localStorage.getItem('pms_organisation_id');
      const selected = saved && data.some(x => x.id === saved) ? saved : data[0]?.id ?? '';
      setOrganisationId(selected);
      if (selected) loadSummary(selected);
    }).catch(error => setMessage(error instanceof Error ? error.message : 'Unable to load organisations.'));
  }, []);

  return <main className="shell"><section className="card">
    <p className="eyebrow">REPORTING</p><h1>Performance reports</h1>
    <p>Organisation-level performance activity and approved assessment results.</p>
    <div className="actions"><Link className="button secondary" href="/admin">Back to administration</Link><Link className="button secondary" href="/dashboard">Dashboard</Link></div>
    <label>Organisation<select value={organisationId} onChange={e => { setOrganisationId(e.target.value); loadSummary(e.target.value); }}><option value="">Select organisation…</option>{organisations.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}</select></label>
    {message && <p className="muted">{message}</p>}
    {summary && <>
      <div className="grid"><article className="card"><p className="eyebrow">STAFF</p><h2>{summary.employeeCount}</h2><p>Employees</p></article><article className="card"><p className="eyebrow">PLANS</p><h2>{summary.planCount}</h2><p>Performance plans</p></article><article className="card"><p className="eyebrow">APPROVED</p><h2>{summary.approvedPlanCount}</h2><p>Final assessments</p></article><article className="card"><p className="eyebrow">AVERAGE</p><h2>{summary.averageApprovedScore === null ? '—' : `${summary.averageApprovedScore}%`}</h2><p>Approved final score</p></article></div>
      <div className="card"><h2>Plan status</h2><div className="grid">{Object.entries(summary.statusCounts).map(([status, count]) => <article key={status}><strong>{status}</strong><p>{count}</p></article>)}</div></div>
      <div className="card"><h2>Cycles</h2>{summary.cycles.length === 0 ? <p className="muted">No performance cycles yet.</p> : <div>{summary.cycles.map(cycle => <article className="card" key={cycle.id}><strong>{cycle.name}</strong><p>{cycle.programme.name} · {cycle.reviewType.name} · {cycle.status}</p><p>{cycle.planCount} plan{cycle.planCount === 1 ? '' : 's'}</p></article>)}</div>}</div>
    </>}
  </section></main>;
}
