'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string };
type Program = { id: string; name: string; code: string };
type Cycle = { id: string; name: string; code: string; status: string };
type ReviewType = { id: string; name: string; code: string };
type Kpi = { id: string; name?: string; title?: string; code: string; description?: string | null; defaultUnit?: string | null };
type Competency = { id: string; name: string; code: string; description?: string | null };

type SelectedKpi = { kpiId: string; weight: number; target: string; measurementUnit: string };
type SelectedCompetency = { competencyId: string; weight: number };

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? 'Request failed');
  return body;
}

export default function NewReviewPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [reviewTypes, setReviewTypes] = useState<ReviewType[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [reviewTypeId, setReviewTypeId] = useState('');
  const [selectedKpis, setSelectedKpis] = useState<SelectedKpi[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<SelectedCompetency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/employees'), api('/performance/programs'), api('/performance/kpis'), api('/performance/competencies')])
      .then(([employeeData, programData, kpiData, competencyData]) => {
        setEmployees(employeeData); setPrograms(programData); setKpis(kpiData); setCompetencies(competencyData);
        if (programData[0]) setProgramId(programData[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!programId) { setCycles([]); setReviewTypes([]); return; }
    setCycleId(''); setReviewTypeId('');
    Promise.all([api(`/performance/programs/${programId}/cycles`), api(`/performance/programs/${programId}/review-types`)]).then(([cycleData, typeData]) => {
      setCycles(cycleData); setReviewTypes(typeData);
      const open = cycleData.find((cycle: Cycle) => cycle.status === 'OPEN') ?? cycleData.find((cycle: Cycle) => cycle.status === 'DRAFT');
      if (open) setCycleId(open.id);
      if (typeData[0]) setReviewTypeId(typeData[0].id);
    }).catch((err) => setError(err.message));
  }, [programId]);

  const kpiWeight = useMemo(() => selectedKpis.reduce((sum, item) => sum + Number(item.weight || 0), 0), [selectedKpis]);
  const competencyWeight = useMemo(() => selectedCompetencies.reduce((sum, item) => sum + Number(item.weight || 0), 0), [selectedCompetencies]);
  const totalWeight = kpiWeight + competencyWeight;

  function addKpi(kpi: Kpi) {
    if (selectedKpis.some((item) => item.kpiId === kpi.id)) return;
    setSelectedKpis((items) => [...items, { kpiId: kpi.id, weight: 10, target: '', measurementUnit: kpi.defaultUnit ?? '' }]);
  }
  function addCompetency(competency: Competency) {
    if (selectedCompetencies.some((item) => item.competencyId === competency.id)) return;
    setSelectedCompetencies((items) => [...items, { competencyId: competency.id, weight: 10 }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!employeeId || !cycleId || !reviewTypeId) { setError('Select an employee, cycle and review type.'); return; }
    if (totalWeight <= 0) { setError('Add at least one KPI or competency with a weight greater than zero.'); return; }
    setSaving(true);
    try {
      const review = await api('/performance/reviews', { method: 'POST', body: JSON.stringify({
        employeeId, performanceCycleId: cycleId, reviewTypeId,
        kpis: selectedKpis.map((item) => ({ kpiId: item.kpiId, weight: Number(item.weight), target: item.target || undefined, measurementUnit: item.measurementUnit || undefined })),
        competencies: selectedCompetencies.map((item) => ({ competencyId: item.competencyId, weight: Number(item.weight) })),
      }) });
      router.push(`/reviews/${review.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create review'); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="page-shell"><div className="content-card">Loading review setup…</div></main>;

  return <main className="page-shell">
    <section className="content-card review-builder">
      <div className="review-header"><div><p className="eyebrow">Performance Management</p><h1>Create Performance Review</h1><p>Choose the employee and assessment framework. The system will snapshot the employee's current organizational assignment when the review is created.</p></div><button className="secondary-button" onClick={() => router.push('/reviews')}>Back to reviews</button></div>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Employee<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.employeeNumber} — {e.firstName} {e.lastName}</option>)}</select></label>
          <label>Performance program<select value={programId} onChange={(e) => setProgramId(e.target.value)}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></label>
          <label>Cycle<select value={cycleId} onChange={(e) => setCycleId(e.target.value)}><option value="">Select cycle</option>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.status}</option>)}</select></label>
          <label>Review type<select value={reviewTypeId} onChange={(e) => setReviewTypeId(e.target.value)}><option value="">Select review type</option>{reviewTypes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
        </div>

        <div className="builder-section"><div className="section-heading"><div><h2>Key Performance Indicators</h2><p>Add the KPIs that will be assessed in this review.</p></div><span>{kpiWeight}%</span></div>
          <div className="option-list">{kpis.filter((k) => !selectedKpis.some((s) => s.kpiId === k.id)).map((k) => <button type="button" className="option-chip" key={k.id} onClick={() => addKpi(k)}>{k.name ?? k.title} <span>+</span></button>)}</div>
          {selectedKpis.map((item, index) => { const kpi = kpis.find((k) => k.id === item.kpiId)!; return <div className="builder-row" key={item.kpiId}><strong>{kpi.name ?? kpi.title}</strong><input type="number" min="0" step="0.1" value={item.weight} aria-label="KPI weight" onChange={(e) => setSelectedKpis((items) => items.map((x, i) => i === index ? { ...x, weight: Number(e.target.value) } : x))} /><input placeholder="Target" value={item.target} onChange={(e) => setSelectedKpis((items) => items.map((x, i) => i === index ? { ...x, target: e.target.value } : x))} /><input placeholder="Unit" value={item.measurementUnit} onChange={(e) => setSelectedKpis((items) => items.map((x, i) => i === index ? { ...x, measurementUnit: e.target.value } : x))} /><button type="button" onClick={() => setSelectedKpis((items) => items.filter((x) => x.kpiId !== item.kpiId))}>Remove</button></div>; })}
        </div>

        <div className="builder-section"><div className="section-heading"><div><h2>Competencies</h2><p>Add behavioural or professional competencies to the assessment.</p></div><span>{competencyWeight}%</span></div>
          <div className="option-list">{competencies.filter((c) => !selectedCompetencies.some((s) => s.competencyId === c.id)).map((c) => <button type="button" className="option-chip" key={c.id} onClick={() => addCompetency(c)}>{c.name} <span>+</span></button>)}</div>
          {selectedCompetencies.map((item, index) => { const competency = competencies.find((c) => c.id === item.competencyId)!; return <div className="builder-row" key={item.competencyId}><strong>{competency.name}</strong><input type="number" min="0" step="0.1" value={item.weight} aria-label="Competency weight" onChange={(e) => setSelectedCompetencies((items) => items.map((x, i) => i === index ? { ...x, weight: Number(e.target.value) } : x))} /><button type="button" onClick={() => setSelectedCompetencies((items) => items.filter((x) => x.competencyId !== item.competencyId))}>Remove</button></div>; })}
        </div>

        <div className="builder-footer"><span>Total assessment weight: <strong>{totalWeight}%</strong></span><button className="primary-button" disabled={saving}>{saving ? 'Creating…' : 'Create review'}</button></div>
      </form>
    </section>
  </main>;
}
