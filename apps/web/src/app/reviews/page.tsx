'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type Review = { id: string; status: string; employee: { firstName: string; lastName: string; employeeNumber: string }; performanceCycle: { name: string; program: { name: string } }; reviewType: { name: string }; scores: Array<{ overallScore: number | null; overallRating: string | null }> };

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { fetch(`${API}/performance/reviews/mine`, { credentials: 'include' }).then(async r => { if (r.status === 401) { router.replace('/login'); return []; } if (!r.ok) throw new Error('Unable to load reviews'); return r.json(); }).then(setReviews).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [router]);
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span>PMS</span><small>Performance Management</small></div><nav><a onClick={() => router.push('/')}>Overview</a><a className="active">My Reviews</a></nav></aside><section className="workspace"><header className="topbar"><div><p className="eyebrow">Performance</p><h1>My reviews</h1></div><button className="back-button" onClick={() => router.push('/')}>Dashboard</button></header><div className="content"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Review history</p><h3>Your performance reviews</h3></div></div>{loading ? <p className="muted">Loading reviews…</p> : error ? <p className="error">{error}</p> : reviews.length === 0 ? <p className="muted">No performance reviews have been assigned to you yet.</p> : <div className="review-list">{reviews.map(review => <button className="review-row" key={review.id} onClick={() => router.push(`/reviews/${review.id}`)}><div><strong>{review.performanceCycle.name}</strong><span>{review.performanceCycle.program.name} · {review.reviewType.name}</span></div><div className="review-meta"><span className={`status status-${review.status.toLowerCase()}`}>{review.status.replaceAll('_', ' ')}</span><strong>{review.scores[0]?.overallScore != null ? `${Number(review.scores[0].overallScore).toFixed(1)}%` : 'Not scored'}</strong></div></button>)}</div>}</section></div></section></main>;
}
