'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Cycle = { id: string; name: string; startsAt: string; endsAt: string; status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'CLOSED'; programme: { name: string }; reviewType: { name: string } };

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('pms_token');
  return fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
}

const nextStatuses: Record<Cycle['status'], Cycle['status'][]> = {
  DRAFT: ['OPEN'],
  OPEN: ['REVIEW', 'CLOSED'],
  REVIEW: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export default function CycleAdministration() {
  const [organisationId, setOrganisationId] = useState('');
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [message, setMessage] = useState('');

  async function load(id = organisationId) {
    if (!id) return;
    localStorage.setItem('pms_organisation_id', id);
    const response = await request(`/performance/organisations/${id}/cycles`);
    if (response.ok) setCycles(await response.json());
    else setMessage(await response.text());
  }

  useEffect(() => {
    const saved = localStorage.getItem('pms_organisation_id') ?? '';
    setOrganisationId(saved);
    if (saved) load(saved);
  }, []);

  async function changeStatus(cycleId: string, status: Cycle['status']) {
    setMessage('');
    const response = await request(`/performance/cycles/${cycleId}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    if (!response.ok) { setMessage(await response.text()); return; }
    setMessage(`Cycle moved to ${status}.`);
    load();
  }

  return <main className="shell"><section className="card">
    <p className="eyebrow">PERFORMANCE ADMINISTRATION</p>
    <h1>Cycle management</h1>
    <p>Control the lifecycle of performance cycles. Transitions are enforced by the server.</p>
    <div className="actions"><Link className="button secondary" href="/admin/performance">Back to performance configuration</Link></div>
    {message && <p className="muted">{message}</p>}
    <div className="card"><h2>Organisation context</h2><label>Organisation ID<input value={organisationId} onChange={e => setOrganisationId(e.target.value)} placeholder="Organisation ID" /></label><button className="button" onClick={() => load()}>Load cycles</button></div>
    {organisationId && <div className="card"><h2>Configured cycles</h2>{cycles.length === 0 ? <p className="muted">No cycles configured.</p> : <div className="grid">{cycles.map(cycle => <article className="card" key={cycle.id}><p className="eyebrow">{cycle.status}</p><h3>{cycle.name}</h3><p>{cycle.programme.name} · {cycle.reviewType.name}</p><p className="muted">{new Date(cycle.startsAt).toLocaleString()} – {new Date(cycle.endsAt).toLocaleString()}</p><div className="actions">{nextStatuses[cycle.status].map(status => <button className="button secondary" key={status} onClick={() => changeStatus(cycle.id, status)}>{status === 'OPEN' ? 'Open cycle' : status === 'REVIEW' ? 'Move to review' : 'Close cycle'}</button>)}</div>{cycle.status === 'CLOSED' && <p className="muted">Closed cycles are final and cannot be reopened.</p>}</article>)}</div>}</div>}
  </section></main>;
}
