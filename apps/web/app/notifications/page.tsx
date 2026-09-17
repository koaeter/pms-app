'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Notification = { id: string; title: string; message: string; link?: string | null; isRead: boolean; createdAt: string };

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('pms_token');
  if (!token) throw new Error('Not signed in');
  const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error('Unable to load notifications');
  return response.json();
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    try { setItems(await request('/notifications')); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load notifications.'); }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) { await request(`/notifications/${id}/read`, { method: 'POST' }); await load(); }
  async function markAll() { await request('/notifications/read-all', { method: 'POST' }); await load(); }

  return <main className="shell"><section className="card">
    <p className="eyebrow">NOTIFICATIONS</p><h1>Notifications</h1>
    <div className="actions"><Link className="button secondary" href="/dashboard">Back to dashboard</Link><button className="button" onClick={markAll} disabled={!items.some(i => !i.isRead)}>Mark all as read</button></div>
    {message && <p className="muted">{message}</p>}
    {items.length === 0 ? <p className="muted">No notifications.</p> : <div>{items.map(item => <article className="card" key={item.id}><h2>{item.title}</h2><p>{item.message}</p><p className="muted">{new Date(item.createdAt).toLocaleString()} · {item.isRead ? 'Read' : 'Unread'}</p><div className="actions">{item.link && <Link className="button" href={item.link} onClick={() => !item.isRead && markRead(item.id)}>Open</Link>}{!item.isRead && <button className="button secondary" onClick={() => markRead(item.id)}>Mark read</button>}</div></article>)}</div>}
  </section></main>;
}
