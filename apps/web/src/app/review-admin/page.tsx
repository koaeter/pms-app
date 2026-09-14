'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type Program = { id: string; name: string; code: string };
type Cycle = { id: string; name: string; code: string; status: string };
type ReviewType = { id: string; name: string; code: string };
type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string };
type Kpi = { id: string; name?: string; title?: string; code: string; description?: string | null };
type Competency = { id: string; name: string; code: string; description?: string | null };

type SelectedItem = { id: string; weight: string };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options });
  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(message ?? 'Request failed');
  }
  return data;
}

export default function ReviewAdminPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [reviewTypes, setReviewTypes] = useState<ReviewType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [reviewTypeId, setReviewTypeId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedKpis, setSelectedKpis] = useState<SelectedItem[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<SelectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      request('/performance/programs'),
      request('/employees'),
      request('/performance/kpis'),
      request('/performance/competencies'),
    ])
      .then(([p, e, k, c]) => {
        setPrograms(p);
        setEmployees(e);
        setKpis(k);
        setCompetencies(c);
        if (p[0]) setProgramId(p[0].id);
      })
      .catch((e) => {
        if (e.message === 'AUTH_REQUIRED') router.replace('/login');
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!programId) return;
    Promise.all([
      request(`/performance/programs/${programId}/cycles`),
      request(`/performance/programs/${programId}/review-types`),
    ])
      .then(([c, r]) => {
        setCycles(c);
        setReviewTypes(r);
        setCycleId(c[0]?.id ?? '');
        setReviewTypeId(r[0]?.id ?? '');
      })
      .catch((e) => setError(e.message));
  }, [programId]);

  function toggleItem(
    id: string,
    current: SelectedItem[],
    setCurrent: (items: SelectedItem[]) => void,
  ) {
    const exists = current.some((item) => item.id === id);
    setCurrent(exists ? current.filter((item) => item.id !== id) : [...current, { id, weight: '1' }]);
  }

  function updateWeight(
    id: string,
    current: SelectedItem[],
    setCurrent: (items: SelectedItem[]) => void,
    weight: string,
  ) {
    setCurrent(current.map((item) => item.id === id ? { ...item, weight } : item));
  }

  async function createReview() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!employeeId || !cycleId || !reviewTypeId) throw new Error('Select an employee, cycle and review type');
      if (!selectedKpis.length && !selectedCompetencies.length) throw new Error('Select at least one KPI or competency');
      if ([...selectedKpis, ...selectedCompetencies].some((item) => !Number.isFinite(Number(item.weight)) || Number(item.weight) <= 0)) {
        throw new Error('All selected items must have a weight greater than zero');
      }
      const created = await request('/performance/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          performanceCycleId: cycleId,
          reviewTypeId,
          kpis: selectedKpis.map((item) => ({ kpiId: item.id, weight: Number(item.weight) })),
          competencies: selectedCompetencies.map((item) => ({ competencyId: item.id, weight: Number(item.weight) })),
        }),
      });
      setSuccess('Review created successfully.');
      setSelectedKpis([]);
      setSelectedCompetencies([]);
      if (created?.id) setTimeout(() => router.push(`/reviews/${created.id}`), 500);
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_REQUIRED') router.replace('/login');
      else setError(e instanceof Error ? e.message : 'Unable to create review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>PMS</span><small>Performance Management</small></div>
        <nav>
          <a onClick={() => router.push('/')}>Overview</a>
          <a onClick={() => router.push('/performance-setup')}>Performance Setup</a>
          <a onClick={() => router.push('/reviews')}>My Reviews</a>
          <a onClick={() => router.push('/team-reviews')}>Team Reviews</a>
          <a className="active">Create Review</a>
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">PMS administration</p><h1>Create performance review</h1></div>
          <button className="back-button" onClick={() => router.push('/')}>Dashboard</button>
        </header>
        <div className="content">
          {error && <p className="error">{error}</p>}
          {success && <p className="success-note">{success}</p>}
          {loading ? <p className="muted">Loading review configuration…</p> : (
            <>
              <section className="panel setup-hero">
                <div>
                  <p className="eyebrow">Review assignment</p>
                  <h2>Build an individual appraisal from configured components.</h2>
                  <p className="muted">Select the employee, performance period, review type, and the KPI/competency items that belong to this review.</p>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Review context</p><h3>Assignment details</h3></div></div>
                <div className="setup-form">
                  <label>Program<select value={programId} onChange={(e) => setProgramId(e.target.value)}>{programs.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
                  <label>Cycle<select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label>
                  <label>Review type<select value={reviewTypeId} onChange={(e) => setReviewTypeId(e.target.value)}>{reviewTypes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
                  <label>Employee<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeNumber} · {item.firstName} {item.lastName}</option>)}</select></label>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Measurement</p><h3>KPIs</h3><p className="muted">Choose the KPIs for this appraisal and assign their weights.</p></div></div>
                {kpis.length === 0 ? <p className="muted">No KPIs have been configured.</p> : <div className="review-list">{kpis.map((item) => { const selected = selectedKpis.find((x) => x.id === item.id); return <div className="review-row" key={item.id}><label className="checkbox-row"><input type="checkbox" checked={!!selected} onChange={() => toggleItem(item.id, selectedKpis, setSelectedKpis)} /><span><strong>{item.title ?? item.name ?? item.code}</strong><small>{item.code}{item.description ? ` · ${item.description}` : ''}</small></span></label>{selected && <input className="weight-input" type="number" min="0.01" step="0.01" value={selected.weight} onChange={(e) => updateWeight(item.id, selectedKpis, setSelectedKpis, e.target.value)} aria-label={`Weight for ${item.title ?? item.name ?? item.code}`} />}</div>})}</div>}
              </section>

              <section className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Behaviour and capability</p><h3>Competencies</h3><p className="muted">Choose the competencies to assess during this appraisal.</p></div></div>
                {competencies.length === 0 ? <p className="muted">No competencies have been configured.</p> : <div className="review-list">{competencies.map((item) => { const selected = selectedCompetencies.find((x) => x.id === item.id); return <div className="review-row" key={item.id}><label className="checkbox-row"><input type="checkbox" checked={!!selected} onChange={() => toggleItem(item.id, selectedCompetencies, setSelectedCompetencies)} /><span><strong>{item.name}</strong><small>{item.code}{item.description ? ` · ${item.description}` : ''}</small></span></label>{selected && <input className="weight-input" type="number" min="0.01" step="0.01" value={selected.weight} onChange={(e) => updateWeight(item.id, selectedCompetencies, setSelectedCompetencies, e.target.value)} aria-label={`Weight for ${item.name}`} />}</div>})}</div>}
              </section>

              <section className="panel action-panel">
                <div><p className="eyebrow">Ready to assign</p><h3>{selectedKpis.length + selectedCompetencies.length} assessment item{selectedKpis.length + selectedCompetencies.length === 1 ? '' : 's'} selected</h3><p className="muted">The employee will receive the review in their review list after creation.</p></div>
                <button className="primary-action" disabled={saving} onClick={createReview}>{saving ? 'Creating…' : 'Create review'}</button>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
