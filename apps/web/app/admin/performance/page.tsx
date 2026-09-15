'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Programme = { id: string; name: string; code: string; description?: string | null; _count: { cycles: number; kpis: number; competencies: number } };

export default function PerformanceAdmin() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [organisationId, setOrganisationId] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  async function load() {
    const token = localStorage.getItem('pms_token');
    if (!token || !organisationId) return;
    const response = await fetch(`${API_URL}/performance/organisations/${organisationId}/programmes`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { setMessage('Unable to load performance programmes.'); return; }
    setProgrammes(await response.json());
  }

  useEffect(() => {
    setOrganisationId(localStorage.getItem('pms_organisation_id') ?? '');
  }, []);

  useEffect(() => { load(); }, [organisationId]);

  async function createProgramme(event: React.FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem('pms_token');
    if (!token || !organisationId) { setMessage('Set an organisation ID first.'); return; }
    const response = await fetch(`${API_URL}/performance/organisations/${organisationId}/programmes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, code }),
    });
    if (!response.ok) { setMessage('Unable to create programme.'); return; }
    setName(''); setCode(''); setMessage('Programme created.'); load();
  }

  return <main className="shell"><section className="card">
    <p className="eyebrow">PERFORMANCE ADMINISTRATION</p>
    <h1>Performance programmes</h1>
    <p>Configure programmes first, then attach review types, KPIs, competencies, cycles and rating scales.</p>
    <div className="actions"><Link className="button secondary" href="/admin">Back to administration</Link></div>

    <div className="card">
      <h2>Organisation context</h2>
      <label>Organisation ID<input value={organisationId} onChange={(event) => setOrganisationId(event.target.value)} placeholder="Paste organisation ID" /></label>
      <button className="button" onClick={() => { localStorage.setItem('pms_organisation_id', organisationId); load(); }}>Load programmes</button>
    </div>

    <div className="card">
      <h2>New programme</h2>
      <form className="form" onSubmit={createProgramme}>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Annual Performance Management" /></label>
        <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} required placeholder="APM" /></label>
        <button className="button" type="submit">Create programme</button>
      </form>
    </div>

    {message && <p className="muted">{message}</p>}
    <div className="grid">{programmes.map((programme) => <article className="card" key={programme.id}>
      <p className="eyebrow">{programme.code}</p>
      <h2>{programme.name}</h2>
      <p>{programme.description || 'No description.'}</p>
      <p>{programme._count.cycles} cycles · {programme._count.kpis} KPIs · {programme._count.competencies} competencies</p>
    </article>)}</div>
  </section></main>;
}
