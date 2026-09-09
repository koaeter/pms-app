'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
type Review = { id: string; status: string; employee: { id: string; firstName: string; lastName: string; employeeNumber: string }; performanceCycle: { name: string; program: { name: string } }; reviewType: { name: string }; kpis: Array<{ id: string; title: string; target: string | null; measurementUnit: string | null; weight: number; employeeScore: number | null; supervisorScore: number | null; employeeComment: string | null; supervisorComment: string | null }>; competencies: Array<{ id: string; competency: { name: string }; weight: number; employeeRating: number | null; supervisorRating: number | null; employeeComment: string | null; supervisorComment: string | null }>; scores: Array<{ overallScore: number | null; overallRating: string | null; calculatedAt: string }> };
type Me = { employee: { id: string } };

export default function ReviewDetailPage() {
  const params = useParams<{ reviewId: string }>(); const router = useRouter();
  const [review, setReview] = useState<Review | null>(null); const [canEdit, setCanEdit] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    try {
      const meResponse = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (meResponse.status === 401) { router.replace('/login'); return; }
      if (!meResponse.ok) throw new Error('Unable to identify current user');
      const me: { user: Me } = await meResponse.json();
      const [mineResponse, teamResponse] = await Promise.all([
        fetch(`${API}/performance/reviews/mine`, { credentials: 'include' }),
        fetch(`${API}/performance/reviews/team`, { credentials: 'include' }),
      ]);
      const mine: Review[] = mineResponse.ok ? await mineResponse.json() : [];
      const team: Review[] = teamResponse.ok ? await teamResponse.json() : [];
      const found = [...mine, ...team].find(item => item.id === params.reviewId) ?? null;
      if (!found) throw new Error('You do not have access to this review');
      setReview(found); setCanEdit(found.employee.id === me.user.employee.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load review'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [params.reviewId]);

  async function saveKpi(id: string, score: string, comment: string) { setSaving(id); const response = await fetch(`${API}/performance/reviews/${params.reviewId}/kpis/${id}/employee-score`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: Number(score), comment }) }); if (!response.ok) setError('Unable to save KPI score'); await load(); setSaving(null); }
  async function saveCompetency(id: string, rating: string, comment: string) { setSaving(id); const response = await fetch(`${API}/performance/reviews/${params.reviewId}/competencies/${id}/employee-rating`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: Number(rating), comment }) }); if (!response.ok) setError('Unable to save competency rating'); await load(); setSaving(null); }
  async function submit() { setSaving('submit'); const r = await fetch(`${API}/performance/reviews/${params.reviewId}/submit`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!r.ok) setError('The review could not be submitted. Complete the required workflow steps first.'); await load(); setSaving(null); }

  if (loading) return <main className="loading">Loading review…</main>;
  if (!review) return <main className="content"><p className="error">{error || 'Review not found.'}</p></main>;
  const latest = review.scores[0]; const editable = canEdit && !['FINALIZED', 'LOCKED', 'CANCELLED', 'APPROVED'].includes(review.status);
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span>PMS</span><small>Performance Management</small></div><nav><a onClick={() => router.push('/')}>Overview</a><a className="active" onClick={() => router.push('/reviews')}>My Reviews</a></nav></aside><section className="workspace"><header className="topbar"><div><p className="eyebrow">Performance review</p><h1>{review.performanceCycle.name}</h1></div><button className="back-button" onClick={() => router.push('/reviews')}>Back to reviews</button></header><div className="content">{error && <p className="error">{error}</p>}<section className="review-summary"><div><p className="eyebrow">{review.performanceCycle.program.name} · {review.reviewType.name}</p><h2>{review.employee.firstName} {review.employee.lastName}</h2><p className="muted">Employee {review.employee.employeeNumber}</p></div><div className="review-score"><span className={`status status-${review.status.toLowerCase()}`}>{review.status.replaceAll('_', ' ')}</span><strong>{latest?.overallScore != null ? `${Number(latest.overallScore).toFixed(1)}%` : '—'}</strong><small>{latest?.overallRating ?? 'Overall score not calculated'}</small></div></section>
    <section className="panel review-section"><div className="panel-heading"><div><p className="eyebrow">Key performance indicators</p><h3>Goals and results</h3></div></div>{review.kpis.length === 0 ? <p className="muted">No KPIs are attached to this review.</p> : <div className="review-items">{review.kpis.map(k => <KpiEditor key={k.id} kpi={k} editable={editable} saving={saving === k.id} onSave={saveKpi} />)}</div>}</section>
    <section className="panel review-section"><div className="panel-heading"><div><p className="eyebrow">Competencies</p><h3>Behaviour and capability</h3></div></div>{review.competencies.length === 0 ? <p className="muted">No competencies are attached to this review.</p> : <div className="review-items">{review.competencies.map(c => <CompetencyEditor key={c.id} competency={c} editable={editable} saving={saving === c.id} onSave={saveCompetency} />)}</div>}</section>
    {editable && <section className="review-actions"><p className="muted">Review your entries before submitting. Once submitted, the workflow routes the review to the configured next actor.</p><button className="primary-action" disabled={saving !== null} onClick={submit}>{saving === 'submit' ? 'Submitting…' : 'Submit review'}</button></section>}
  </div></section></main>;
}

function KpiEditor({ kpi, editable, saving, onSave }: { kpi: Review['kpis'][number]; editable: boolean; saving: boolean; onSave: (id: string, score: string, comment: string) => void }) { const [score, setScore] = useState(kpi.employeeScore?.toString() ?? ''); const [comment, setComment] = useState(kpi.employeeComment ?? ''); return <article className="review-item"><div className="item-title"><div><strong>{kpi.title}</strong><span>{kpi.target ? `Target: ${kpi.target}${kpi.measurementUnit ? ` ${kpi.measurementUnit}` : ''}` : 'No target specified'}</span></div><b>{kpi.weight}%</b></div><label>Employee score (0–100)<input type="number" min="0" max="100" value={score} disabled={!editable} onChange={e => setScore(e.target.value)} /></label><label>Comment<textarea value={comment} disabled={!editable} onChange={e => setComment(e.target.value)} /></label>{kpi.supervisorScore != null && <small>Supervisor score: {Number(kpi.supervisorScore).toFixed(1)}%</small>}{editable && <button disabled={saving || score === ''} onClick={() => onSave(kpi.id, score, comment)}>{saving ? 'Saving…' : 'Save KPI'}</button>}</article> }
function CompetencyEditor({ competency, editable, saving, onSave }: { competency: Review['competencies'][number]; editable: boolean; saving: boolean; onSave: (id: string, rating: string, comment: string) => void }) { const [rating, setRating] = useState(competency.employeeRating?.toString() ?? ''); const [comment, setComment] = useState(competency.employeeComment ?? ''); return <article className="review-item"><div className="item-title"><div><strong>{competency.competency.name}</strong><span>Weighted competency</span></div><b>{competency.weight}%</b></div><label>Employee rating (0–100)<input type="number" min="0" max="100" value={rating} disabled={!editable} onChange={e => setRating(e.target.value)} /></label><label>Comment<textarea value={comment} disabled={!editable} onChange={e => setComment(e.target.value)} /></label>{competency.supervisorRating != null && <small>Supervisor rating: {Number(competency.supervisorRating).toFixed(1)}%</small>}{editable && <button disabled={saving || rating === ''} onClick={() => onSave(competency.id, rating, comment)}>{saving ? 'Saving…' : 'Save competency'}</button>}</article> }
