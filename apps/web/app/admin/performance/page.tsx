'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Programme = { id: string; name: string; code: string; description?: string | null; _count: { cycles: number; kpis: number; competencies: number } };
type ReviewType = { id: string; name: string; code: string; description?: string | null };
type Cycle = { id: string; name: string; startsAt: string; endsAt: string; status: string; programme: { name: string }; reviewType: { name: string } };
type Employee = { id: string; employeeNumber: string; user: { firstName: string; lastName: string; isActive: boolean }; department?: { name: string } | null; designation?: { name: string; grade?: string | null } | null };
type LibraryItem = { id: string; name: string; code: string; description?: string | null; defaultWeight?: string | number | null };
type Scale = { id: string; name: string; description?: string | null; levels: Array<{ id: string; name: string; score: string | number; description?: string | null }> };
type Plan = {
  id: string;
  status: string;
  employee: { employeeNumber: string; user: { firstName: string; lastName: string }; department?: { name: string } | null; designation?: { name: string; grade?: string | null } | null };
  reviewType: { name: string };
  items: Array<{ id: string; type: 'KPI' | 'COMPETENCY'; kpi?: { name: string; code: string } | null; competency?: { name: string; code: string } | null; description?: string | null; weight: string | number; target?: string | null }>;
};

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('pms_token');
  return fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
}

export default function PerformanceAdmin() {
  const [organisationId, setOrganisationId] = useState('');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmeId, setProgrammeId] = useState('');
  const [reviewTypes, setReviewTypes] = useState<ReviewType[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [kpis, setKpis] = useState<LibraryItem[]>([]);
  const [competencies, setCompetencies] = useState<LibraryItem[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [planForm, setPlanForm] = useState({ cycleId: '', employeeId: '', reviewTypeId: '' });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [itemForm, setItemForm] = useState({ type: 'KPI' as 'KPI' | 'COMPETENCY', kpiId: '', competencyId: '', description: '', weight: '', target: '' });
  const [itemEdits, setItemEdits] = useState<Record<string, { description: string; weight: string; target: string }>>({});
  const [programmeForm, setProgrammeForm] = useState({ name: '', code: '', description: '' });
  const [reviewForm, setReviewForm] = useState({ name: '', code: '', description: '' });
  const [cycleForm, setCycleForm] = useState({ name: '', reviewTypeId: '', startsAt: '', endsAt: '' });
  const [kpiForm, setKpiForm] = useState({ name: '', code: '', description: '', defaultWeight: '' });
  const [competencyForm, setCompetencyForm] = useState({ name: '', code: '', description: '', defaultWeight: '' });
  const [scaleForm, setScaleForm] = useState({ name: '', description: '', levels: [{ name: 'Outstanding', score: '5' }, { name: 'Exceeds Expectations', score: '4' }, { name: 'Meets Expectations', score: '3' }, { name: 'Needs Improvement', score: '2' }, { name: 'Unsatisfactory', score: '1' }] });

  async function loadAll(id = organisationId) {
    if (!id) return;
    localStorage.setItem('pms_organisation_id', id);
    const [p, c, s, e] = await Promise.all([request(`/performance/organisations/${id}/programmes`), request(`/performance/organisations/${id}/cycles`), request(`/performance/organisations/${id}/rating-scales`), request(`/organisation/${id}/employees`)]);
    if (p.ok) { const data = await p.json(); setProgrammes(data); if (!programmeId && data[0]) setProgrammeId(data[0].id); }
    if (c.ok) setCycles(await c.json());
    if (s.ok) setScales(await s.json());
    if (e.ok) { const data = await e.json(); setEmployees(data.filter((x: Employee) => x.user.isActive)); }
  }

  async function loadPlans(cycleId: string) {
    if (!cycleId) { setPlans([]); setSelectedPlanId(''); setSelectedPlan(null); return; }
    const response = await request(`/performance/cycles/${cycleId}/plans`);
    if (!response.ok) { setMessage(await response.text()); return; }
    const data: Plan[] = await response.json();
    setPlans(data);
    setSelectedPlanId(current => data.some(plan => plan.id === current) ? current : (data[0]?.id ?? ''));
  }

  async function loadPlan(planId: string) {
    if (!planId) { setSelectedPlan(null); return; }
    const response = await request(`/performance/plans/${planId}`);
    if (!response.ok) { setMessage(await response.text()); return; }
    const plan: Plan = await response.json();
    setSelectedPlan(plan);
    setItemEdits(Object.fromEntries(plan.items.map(item => [item.id, { description: item.description ?? '', weight: String(item.weight), target: item.target ?? '' }])));
  }

  async function loadProgramme(id: string) {
    if (!id) return;
    const [r, k, c] = await Promise.all([request(`/performance/programmes/${id}/review-types`), request(`/performance/programmes/${id}/kpis`), request(`/performance/programmes/${id}/competencies`)]);
    if (r.ok) { const data = await r.json(); setReviewTypes(data); setCycleForm(f => ({ ...f, reviewTypeId: data[0]?.id ?? '' })); setPlanForm(f => ({ ...f, reviewTypeId: data[0]?.id ?? '' })); }
    if (k.ok) setKpis(await k.json());
    if (c.ok) setCompetencies(await c.json());
  }

  useEffect(() => { const saved = localStorage.getItem('pms_organisation_id') ?? ''; setOrganisationId(saved); if (saved) loadAll(saved); }, []);
  useEffect(() => { if (programmeId) loadProgramme(programmeId); }, [programmeId]);
  useEffect(() => { if (planForm.cycleId) loadPlans(planForm.cycleId); }, [planForm.cycleId]);
  useEffect(() => { if (selectedPlanId) loadPlan(selectedPlanId); }, [selectedPlanId]);

  async function submit(path: string, body: unknown, success: string, reset: () => void, reload = loadAll) {
    const response = await request(path, { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) { setMessage(await response.text()); return; }
    reset(); setMessage(success); reload();
  }

  function addLevel() { setScaleForm(f => ({ ...f, levels: [...f.levels, { name: '', score: '' }] })); }
  function removeLevel(index: number) { setScaleForm(f => ({ ...f, levels: f.levels.filter((_, i) => i !== index) })); }

  return <main className="shell"><section className="card">
    <p className="eyebrow">PERFORMANCE ADMINISTRATION</p><h1>Performance configuration</h1>
    <p>Configure the performance programme structure before assigning plans to employees.</p>
    <div className="actions"><Link className="button secondary" href="/admin">Back to administration</Link><Link className="button" href="/admin/performance/cycles">Manage cycle workflow</Link><Link className="button" href="/admin/performance/assignments">Assign reviewers</Link></div>
    {message && <p className="muted">{message}</p>}

    <div className="card"><h2>Organisation context</h2><label>Organisation ID<input value={organisationId} onChange={e => setOrganisationId(e.target.value)} placeholder="Organisation ID" /></label><button className="button" onClick={() => loadAll()}>Load configuration</button></div>

    {organisationId && <>
      <div className="card"><h2>Programmes</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/organisations/${organisationId}/programmes`, programmeForm, 'Programme created.', () => setProgrammeForm({ name: '', code: '', description: '' }), () => loadAll()); }}><label>Name<input value={programmeForm.name} onChange={e => setProgrammeForm({ ...programmeForm, name: e.target.value })} required /></label><label>Code<input value={programmeForm.code} onChange={e => setProgrammeForm({ ...programmeForm, code: e.target.value })} required /></label><label>Description<input value={programmeForm.description} onChange={e => setProgrammeForm({ ...programmeForm, description: e.target.value })} /></label><button className="button">Create programme</button></form><label>Configure programme<select value={programmeId} onChange={e => setProgrammeId(e.target.value)}><option value="">Select programme…</option>{programmes.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></label></div>

      {programmeId && <>
        <div className="grid">
          <div className="card"><h2>Review types</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/programmes/${programmeId}/review-types`, reviewForm, 'Review type created.', () => setReviewForm({ name: '', code: '', description: '' }), () => loadProgramme(programmeId)); }}><label>Name<input value={reviewForm.name} onChange={e => setReviewForm({ ...reviewForm, name: e.target.value })} required /></label><label>Code<input value={reviewForm.code} onChange={e => setReviewForm({ ...reviewForm, code: e.target.value })} required /></label><label>Description<input value={reviewForm.description} onChange={e => setReviewForm({ ...reviewForm, description: e.target.value })} /></label><button className="button">Add review type</button></form><ul>{reviewTypes.map(r => <li key={r.id}><strong>{r.name}</strong> ({r.code})</li>)}</ul></div>
          <div className="card"><h2>Performance cycles</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/organisations/${organisationId}/cycles`, { ...cycleForm, programmeId, startsAt: new Date(cycleForm.startsAt).toISOString(), endsAt: new Date(cycleForm.endsAt).toISOString() }, 'Cycle created.', () => setCycleForm({ name: '', reviewTypeId: reviewTypes[0]?.id ?? '', startsAt: '', endsAt: '' })); }}><label>Name<input value={cycleForm.name} onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })} required /></label><label>Review type<select value={cycleForm.reviewTypeId} onChange={e => setCycleForm({ ...cycleForm, reviewTypeId: e.target.value })} required>{reviewTypes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Start<input type="datetime-local" value={cycleForm.startsAt} onChange={e => setCycleForm({ ...cycleForm, startsAt: e.target.value })} required /></label><label>End<input type="datetime-local" value={cycleForm.endsAt} onChange={e => setCycleForm({ ...cycleForm, endsAt: e.target.value })} required /></label><button className="button" disabled={!reviewTypes.length}>Create cycle</button></form></div>
        </div>

        <div className="grid">
          <div className="card"><h2>KPI library</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/programmes/${programmeId}/kpis`, { ...kpiForm, defaultWeight: kpiForm.defaultWeight ? Number(kpiForm.defaultWeight) : undefined }, 'KPI created.', () => setKpiForm({ name: '', code: '', description: '', defaultWeight: '' }), () => loadProgramme(programmeId)); }}><label>Name<input value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} required /></label><label>Code<input value={kpiForm.code} onChange={e => setKpiForm({ ...kpiForm, code: e.target.value })} required /></label><label>Default weight %<input type="number" min="0" max="100" step="0.01" value={kpiForm.defaultWeight} onChange={e => setKpiForm({ ...kpiForm, defaultWeight: e.target.value })} /></label><button className="button">Add KPI</button></form><ul>{kpis.map(k => <li key={k.id}><strong>{k.name}</strong> ({k.code}){k.defaultWeight != null ? ` · ${k.defaultWeight}%` : ''}</li>)}</ul></div>
          <div className="card"><h2>Competency library</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/programmes/${programmeId}/competencies`, { ...competencyForm, defaultWeight: competencyForm.defaultWeight ? Number(competencyForm.defaultWeight) : undefined }, 'Competency created.', () => setCompetencyForm({ name: '', code: '', description: '', defaultWeight: '' }), () => loadProgramme(programmeId)); }}><label>Name<input value={competencyForm.name} onChange={e => setCompetencyForm({ ...competencyForm, name: e.target.value })} required /></label><label>Code<input value={competencyForm.code} onChange={e => setCompetencyForm({ ...competencyForm, code: e.target.value })} required /></label><label>Default weight %<input type="number" min="0" max="100" step="0.01" value={competencyForm.defaultWeight} onChange={e => setCompetencyForm({ ...competencyForm, defaultWeight: e.target.value })} /></label><button className="button">Add competency</button></form><ul>{competencies.map(k => <li key={k.id}><strong>{k.name}</strong> ({k.code}){k.defaultWeight != null ? ` · ${k.defaultWeight}%` : ''}</li>)}</ul></div>
        </div>
      </>}

      <div className="card"><h2>Rating scales</h2><form className="form" onSubmit={e => { e.preventDefault(); submit(`/performance/organisations/${organisationId}/rating-scales`, { name: scaleForm.name, description: scaleForm.description, levels: scaleForm.levels.map(x => ({ ...x, score: Number(x.score) })) }, 'Rating scale created.', () => setScaleForm({ name: '', description: '', levels: [{ name: '', score: '' }] })); }}><label>Name<input value={scaleForm.name} onChange={e => setScaleForm({ ...scaleForm, name: e.target.value })} required /></label><label>Description<input value={scaleForm.description} onChange={e => setScaleForm({ ...scaleForm, description: e.target.value })} /></label>{scaleForm.levels.map((level, index) => <div className="actions" key={index}><input placeholder="Level name" value={level.name} onChange={e => setScaleForm(f => ({ ...f, levels: f.levels.map((x, i) => i === index ? { ...x, name: e.target.value } : x) }))} required /><input placeholder="Score" type="number" step="0.01" value={level.score} onChange={e => setScaleForm(f => ({ ...f, levels: f.levels.map((x, i) => i === index ? { ...x, score: e.target.value } : x) }))} required /><button type="button" className="button secondary" onClick={() => removeLevel(index)} disabled={scaleForm.levels.length === 1}>Remove</button></div>)}<div className="actions"><button type="button" className="button secondary" onClick={addLevel}>Add level</button><button className="button">Create rating scale</button></div></form><div className="grid">{scales.map(s => <article key={s.id}><h3>{s.name}</h3><p>{s.levels.map(l => `${l.name} (${l.score})`).join(' · ')}</p></article>)}</div></div>

      <div className="card"><h2>Performance plans</h2>
        <p>Create a plan for an employee after configuring the cycle and review type. Plan items can then be added from the employee's performance workspace.</p>
        <form className="form" onSubmit={async e => {
          e.preventDefault();
          const response = await request(`/performance/cycles/${planForm.cycleId}/plans`, { method: 'POST', body: JSON.stringify({ employeeId: planForm.employeeId, reviewTypeId: planForm.reviewTypeId }) });
          if (!response.ok) { setMessage(await response.text()); return; }
          setMessage('Performance plan created.');
          setPlanForm(f => ({ ...f, employeeId: '' }));
          await loadPlans(planForm.cycleId);
        }}>
          <label>Cycle<select value={planForm.cycleId} onChange={e => {
            const cycleId = e.target.value;
            const cycle = cycles.find(c => c.id === cycleId);
            setPlanForm(f => ({ ...f, cycleId, reviewTypeId: cycle ? reviewTypes.find(r => r.name === cycle.reviewType.name)?.id ?? f.reviewTypeId : f.reviewTypeId }));
          }} required><option value="">Select cycle…</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name} · {c.reviewType.name} · {c.status}</option>)}</select></label>
          <label>Employee<select value={planForm.employeeId} onChange={e => setPlanForm({ ...planForm, employeeId: e.target.value })} required><option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName} · {e.employeeNumber}</option>)}</select></label>
          <label>Review type<select value={planForm.reviewTypeId} onChange={e => setPlanForm({ ...planForm, reviewTypeId: e.target.value })} required><option value="">Select review type…</option>{reviewTypes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}</select></label>
          <button className="button" disabled={!planForm.cycleId || !planForm.employeeId || !planForm.reviewTypeId}>Create performance plan</button>
        </form>
      </div>

      <div className="card"><h2>Plan administration</h2>
        <p>Review existing plans for the selected cycle, open a plan, and manage its draft items. Submitted plans are read-only.</p>
        <label>Cycle<select value={planForm.cycleId} onChange={e => setPlanForm(f => ({ ...f, cycleId: e.target.value }))}><option value="">Select cycle…</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}</select></label>
        {plans.length ? <label>Performance plan<select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}><option value="">Select plan…</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.employee.user.firstName} {plan.employee.user.lastName} · {plan.reviewType.name} · {plan.status}</option>)}</select></label> : <p className="muted">No plans exist for this cycle.</p>}
        {selectedPlan && <div className="card">
          <h3>{selectedPlan.employee.user.firstName} {selectedPlan.employee.user.lastName}</h3>
          <p className="muted">{selectedPlan.employee.employeeNumber} · {selectedPlan.reviewType.name} · Status: {selectedPlan.status}</p>
          {selectedPlan.items.length ? <div>{selectedPlan.items.map(item => {
            const edit = itemEdits[item.id] ?? { description: item.description ?? '', weight: String(item.weight), target: item.target ?? '' };
            return <div className="card" key={item.id}>
              <strong>{item.type === 'KPI' ? item.kpi?.name : item.competency?.name}</strong>
              <p className="muted">{item.type === 'KPI' ? item.kpi?.code : item.competency?.code}</p>
              <div className="actions">
                <input type="number" min="0.01" max="100" step="0.01" value={edit.weight} disabled={selectedPlan.status !== 'DRAFT'} onChange={e => setItemEdits(x => ({ ...x, [item.id]: { ...edit, weight: e.target.value } }))} />
                <input placeholder="Description" value={edit.description} disabled={selectedPlan.status !== 'DRAFT'} onChange={e => setItemEdits(x => ({ ...x, [item.id]: { ...edit, description: e.target.value } }))} />
                <input placeholder="Target" value={edit.target} disabled={selectedPlan.status !== 'DRAFT'} onChange={e => setItemEdits(x => ({ ...x, [item.id]: { ...edit, target: e.target.value } }))} />
                {selectedPlan.status === 'DRAFT' && <><button className="button secondary" onClick={async () => {
                  const response = await request(`/performance/plans/${selectedPlan.id}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...edit, weight: Number(edit.weight) }) });
                  setMessage(response.ok ? 'Plan item updated.' : await response.text());
                  if (response.ok) loadPlan(selectedPlan.id);
                }}>Save</button><button className="button secondary" onClick={async () => {
                  if (!window.confirm('Remove this plan item?')) return;
                  const response = await request(`/performance/plans/${selectedPlan.id}/items/${item.id}`, { method: 'DELETE' });
                  setMessage(response.ok ? 'Plan item removed.' : await response.text());
                  if (response.ok) loadPlan(selectedPlan.id);
                }}>Remove</button></>}
              </div>
            </div>;
          })}</div> : <p className="muted">No items have been added.</p>}
          {selectedPlan.status === 'DRAFT' && <form className="form" onSubmit={async e => {
            e.preventDefault();
            const body = { type: itemForm.type, kpiId: itemForm.type === 'KPI' ? itemForm.kpiId : undefined, competencyId: itemForm.type === 'COMPETENCY' ? itemForm.competencyId : undefined, description: itemForm.description || undefined, weight: Number(itemForm.weight), target: itemForm.target || undefined };
            const response = await request(`/performance/plans/${selectedPlan.id}/items`, { method: 'POST', body: JSON.stringify(body) });
            setMessage(response.ok ? 'Plan item added.' : await response.text());
            if (response.ok) { setItemForm({ type: 'KPI', kpiId: '', competencyId: '', description: '', weight: '', target: '' }); loadPlan(selectedPlan.id); }
          }}>
            <h4>Add plan item</h4>
            <select value={itemForm.type} onChange={e => setItemForm(f => ({ ...f, type: e.target.value as 'KPI' | 'COMPETENCY', kpiId: '', competencyId: '' }))}><option value="KPI">KPI</option><option value="COMPETENCY">Competency</option></select>
            {itemForm.type === 'KPI' ? <select value={itemForm.kpiId} onChange={e => setItemForm(f => ({ ...f, kpiId: e.target.value }))} required><option value="">Select KPI…</option>{kpis.map(k => <option key={k.id} value={k.id}>{k.name} ({k.code})</option>)}</select> : <select value={itemForm.competencyId} onChange={e => setItemForm(f => ({ ...f, competencyId: e.target.value }))} required><option value="">Select competency…</option>{competencies.map(k => <option key={k.id} value={k.id}>{k.name} ({k.code})</option>)}</select>}
            <input placeholder="Weight %" type="number" min="0.01" max="100" step="0.01" value={itemForm.weight} onChange={e => setItemForm(f => ({ ...f, weight: e.target.value }))} required />
            <input placeholder="Description" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
            <input placeholder="Target" value={itemForm.target} onChange={e => setItemForm(f => ({ ...f, target: e.target.value }))} />
            <button className="button" disabled={!itemForm.weight || (itemForm.type === 'KPI' ? !itemForm.kpiId : !itemForm.competencyId)}>Add item</button>
          </form>}
        </div>}
      </div>

      <div className="card"><h2>Cycles</h2>{cycles.length ? <ul>{cycles.map(c => <li key={c.id}><strong>{c.name}</strong> · {c.programme.name} · {c.reviewType.name} · {c.status} · {new Date(c.startsAt).toLocaleDateString()} – {new Date(c.endsAt).toLocaleDateString()}</li>)}</ul> : <p className="muted">No performance cycles configured.</p>}</div>
    </>}
  </section></main>;
}
