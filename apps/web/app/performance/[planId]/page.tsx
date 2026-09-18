'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type PlanItem = { id: string; type: 'KPI' | 'COMPETENCY'; description?: string | null; weight: number | string; target?: string | null; kpi?: { name: string } | null; competency?: { name: string } | null };
type RatingScale = { id: string; name: string; levels: { id: string; name: string; score: number | string; description?: string | null }[] };
type Assessment = { id: string; assessorType: string; status: string; overallScore?: number | string | null; comment?: string | null; assessor?: { user?: { firstName: string; lastName: string } }; items?: { planItemId: string; ratingLevelId: string; comment?: string | null }[] };
type Assignee = { id: string; user?: { id: string; firstName: string; lastName: string; username?: string } };
type Plan = { id: string; status: string; employeeId: string; reviewerId?: string | null; finalAssessorId?: string | null; reviewer?: Assignee | null; finalAssessor?: Assignee | null; employee: { user: { id: string; firstName: string; lastName: string }; managerId?: string | null; department?: { name: string } | null; designation?: { name: string } | null }; cycle: { name: string; organisationId: string; startsAt: string; endsAt: string; programme: { name: string }; reviewType: { name: string } }; items: PlanItem[]; assessments: Assessment[] };
type User = { id: string; roles: string[]; firstName: string; lastName?: string };

function resolveAssessorType(plan: Plan, user: User) {
  const submitted = new Set(plan.assessments.filter((a) => a.status !== 'DRAFT').map((a) => a.assessorType));
  if (!submitted.has('SELF') && plan.employee.user.id === user.id) return 'SELF' as const;
  if (!submitted.has('SUPERVISOR') && submitted.has('SELF') && plan.employee.managerId === user.id) return 'SUPERVISOR' as const;
  if (!submitted.has('REVIEWER') && submitted.has('SUPERVISOR') && plan.reviewer?.user?.id === user.id) return 'REVIEWER' as const;
  if (!submitted.has('FINAL') && submitted.has('REVIEWER') && plan.finalAssessor?.user?.id === user.id) return 'FINAL' as const;
  return null;
}

export default function PerformanceWorkspace() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [scales, setScales] = useState<RatingScale[]>([]);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, options?: RequestInit) {
    const token = localStorage.getItem('pms_token');
    if (!token) { router.replace('/login'); throw new Error('Not signed in'); }
    const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) } });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.message || 'Request failed'); }
    return response.json();
  }

  async function load() {
    try {
      const [me, currentPlan] = await Promise.all([request('/auth/me'), request(`/performance/plans/${params.planId}`)]);
      setUser(me); setPlan(currentPlan);
      const ratingScales = await request(`/performance/organisations/${currentPlan.cycle.organisationId}/rating-scales`);
      setScales(ratingScales);
      const currentAssessorType = resolveAssessorType(currentPlan, me);
      const draft = currentAssessorType ? currentPlan.assessments.find((a: Assessment) => a.status === 'DRAFT' && a.assessorType === currentAssessorType) : undefined;
      setRatings({}); setComments({}); setOverallComment('');
      if (draft) {
        setOverallComment(draft.comment ?? '');
        setRatings(Object.fromEntries((draft.items ?? []).map((item) => [item.planItemId, item.ratingLevelId])));
        setComments(Object.fromEntries((draft.items ?? []).map((item) => [item.planItemId, item.comment ?? ''])));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load performance plan.'); }
  }

  useEffect(() => { load(); }, [params.planId]);

  const admin = !!user?.roles?.some((role) => ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role));
  const submitted = useMemo(() => new Set(plan?.assessments.filter((a) => a.status !== 'DRAFT').map((a) => a.assessorType) ?? []), [plan]);
  const assessorType = useMemo(() => (plan && user ? resolveAssessorType(plan, user) : null), [plan, user]);

  async function saveAssessment(submit: boolean) {
    if (!plan || !assessorType) return;
    setBusy(true); setMessage('');
    try {
      const items = plan.items.map((item) => ({ planItemId: item.id, ratingLevelId: ratings[item.id], comment: comments[item.id] })).filter((item) => item.ratingLevelId);
      if (items.length !== plan.items.length) throw new Error('Please rate every performance item before continuing.');
      await request(`/performance/plans/${plan.id}/assessments`, { method: 'POST', body: JSON.stringify({ assessorType, comment: overallComment, items }) });
      if (submit) await request(`/performance/plans/${plan.id}/assessments/submit`, { method: 'POST', body: JSON.stringify({ assessorType }) });
      setMessage(submit ? 'Assessment submitted successfully.' : 'Assessment saved as draft.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save assessment.'); }
    finally { setBusy(false); }
  }

  async function submitPlan() {
    if (!plan) return;
    setBusy(true); setMessage('');
    try { await request(`/performance/plans/${plan.id}/submit`, { method: 'POST' }); setMessage('Performance plan submitted.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit plan.'); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!plan) return;
    setBusy(true); setMessage('');
    try { await request(`/performance/plans/${plan.id}/approve`, { method: 'POST' }); setMessage('Final assessment approved.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to approve assessment.'); }
    finally { setBusy(false); }
  }

  async function lock() {
    if (!plan) return;
    setBusy(true); setMessage('');
    try { await request(`/performance/plans/${plan.id}/lock`, { method: 'POST' }); setMessage('Performance plan locked.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to lock plan.'); }
    finally { setBusy(false); }
  }

  if (!plan) return <main className="shell"><section className="card"><p>{message || 'Loading performance plan…'}</p></section></main>;

  const activeScale = scales[0];
  const currentDraft = plan.assessments.find((a) => a.assessorType === assessorType && a.status === 'DRAFT');
  const finalSubmitted = plan.assessments.some((a) => a.assessorType === 'FINAL' && a.status === 'SUBMITTED');
  const canEdit = !!assessorType && ['SUBMITTED', 'IN_REVIEW'].includes(plan.status);
  const activeAssessment = assessorType ? plan.assessments.find((a) => a.assessorType === assessorType) : undefined;
  const finalAssessment = plan.assessments.find((a) => a.assessorType === 'FINAL');
  const nextStage = !submitted.has('SELF') ? 'Employee self assessment' : !submitted.has('SUPERVISOR') ? 'Supervisor assessment' : !submitted.has('REVIEWER') ? 'Assigned reviewer assessment' : !submitted.has('FINAL') ? 'Assigned final assessment' : 'Final approval';
  const nextAssignee = !submitted.has('SELF') ? plan.employee.user : !submitted.has('REVIEWER') ? plan.reviewer?.user : !submitted.has('FINAL') ? plan.finalAssessor?.user : undefined;

  return <main className="shell"><section className="card">
    <button className="button secondary" onClick={() => router.back()}>Back</button>
    <p className="eyebrow">PERFORMANCE WORKSPACE</p>
    <h1>{plan.employee.user.firstName} {plan.employee.user.lastName}</h1>
    <p>{plan.cycle.name} · {plan.cycle.reviewType.name} · {plan.cycle.programme.name}</p>
    <div className="grid">
      <div className="card"><strong>Plan status</strong><p>{plan.status}</p></div>
      <div className="card"><strong>Department</strong><p>{plan.employee.department?.name ?? '—'}</p></div>
      <div className="card"><strong>Designation</strong><p>{plan.employee.designation?.name ?? '—'}</p></div>
    </div>

    {plan.status === 'DRAFT' && <div className="card"><h2>Performance plan</h2><p>Add/configure plan items from the administration area before submitting.</p>{plan.items.length === 0 && <p className="muted">No performance items have been added yet.</p>}<button className="button" disabled={busy || plan.items.length === 0} onClick={submitPlan}>Submit plan</button></div>}

    <div className="card"><h2>Current stage</h2><p><strong>{nextStage}</strong></p><p>{plan.status === 'DRAFT' ? 'The performance plan must be completed and submitted before assessments can begin.' : submitted.has('FINAL') ? 'The final assessment is complete and is awaiting administrative approval.' : assessorType ? 'You are the assigned ' + assessorType.toLowerCase() + ' assessor for the current stage.' : 'The next workflow action belongs to another participant.'}</p>{nextAssignee && <small>Next participant: {nextAssignee.firstName} {nextAssignee.lastName}</small>}{!assessorType && plan.status !== 'DRAFT' && <p className="muted">This workspace is currently read-only for your account.</p>}</div>

    <div className="card"><h2>Workflow</h2><div className="grid">
      {['SELF','SUPERVISOR','REVIEWER','FINAL'].map((stage) => { const assessment = plan.assessments.find((a) => a.assessorType === stage); const assigned = stage === 'REVIEWER' ? plan.reviewer : stage === 'FINAL' ? plan.finalAssessor : null; return <div className="card" key={stage}><strong>{stage}</strong><p>{assessment ? `${assessment.status}${assessment.overallScore != null ? ` · ${Number(assessment.overallScore).toFixed(1)}%` : ''}` : 'PENDING'}</p>{assigned?.user && <small>Assigned: {assigned.user.firstName} {assigned.user.lastName}</small>}{assessment?.assessor?.user && <small> · Completed by {assessment.assessor.user.firstName} {assessment.assessor.user.lastName}</small>}</div>; })}
    </div></div>

    {activeAssessment?.status === 'SUBMITTED' && <div className="card"><h2>{activeAssessment.assessorType} assessment submitted</h2><p>This stage has already been submitted and cannot be edited.</p>{activeAssessment.overallScore != null && <p><strong>Score: {Number(activeAssessment.overallScore).toFixed(1)}%</strong></p>}{activeAssessment.comment && <p>{activeAssessment.comment}</p>}</div>}

    {canEdit && <div className="card"><h2>{assessorType} assessment</h2><p>Rate every item using the organisation's rating scale. Scores are normalised to 100 and weighted by the performance plan.</p>{!activeScale && <p className="muted">No rating scale has been configured for this organisation yet.</p>}
      {plan.items.map((item) => <div className="card" key={item.id}>
        <strong>{item.kpi?.name ?? item.competency?.name ?? item.description ?? item.type}</strong>
        <p>Weight: {Number(item.weight).toFixed(2)}% {item.target ? `· Target: ${item.target}` : ''}</p>
        <select value={ratings[item.id] ?? ''} onChange={(e) => setRatings((v) => ({ ...v, [item.id]: e.target.value }))}>
          <option value="">Select rating</option>
          {(activeScale?.levels ?? []).map((level) => <option key={level.id} value={level.id}>{level.name} — {level.score}</option>)}
        </select>
        <textarea placeholder="Comment (optional)" value={comments[item.id] ?? ''} onChange={(e) => setComments((v) => ({ ...v, [item.id]: e.target.value }))} />
      </div>)}
      <label>Overall comment<textarea value={overallComment} onChange={(e) => setOverallComment(e.target.value)} placeholder="Overall assessment comments" /></label>
      {currentDraft && <p className="muted">A draft assessment already exists; saving will update it.</p>}
      <div className="actions"><button className="button secondary" disabled={busy || !activeScale} onClick={() => saveAssessment(false)}>Save draft</button><button className="button" disabled={busy || !activeScale} onClick={() => saveAssessment(true)}>Submit assessment</button></div>
    </div>}

    {plan.status === 'IN_REVIEW' && finalSubmitted && admin && <div className="card"><h2>Final approval</h2><p>The final assessment has been submitted and is ready for approval.</p>{finalAssessment?.overallScore != null && <p><strong>Final score: {Number(finalAssessment.overallScore).toFixed(1)}%</strong></p>}{finalAssessment?.comment && <p>{finalAssessment.comment}</p>}<button className="button" disabled={busy} onClick={approve}>Approve final assessment</button></div>}
    {plan.status === 'APPROVED' && admin && <div className="card"><h2>Close record</h2><p>Locking prevents further changes to the performance record.</p><button className="button" disabled={busy} onClick={lock}>Lock performance record</button></div>}
    {message && <p className="muted">{message}</p>}
  </section></main>;
}
