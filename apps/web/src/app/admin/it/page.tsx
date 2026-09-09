'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type User = { id: string; username: string; accountStatus: string; mfaEnabled: boolean; lastLoginAt: string | null; employee: { firstName: string; lastName: string; employeeNumber: string }; roles: Array<{ role: { name: string } }> };
type Session = { id: string; userId: string; user: { username: string }; ipAddress: string | null; userAgent: string | null; lastActivityAt: string; revokedAt: string | null };
type Event = { id: string; eventType: string; success: boolean; createdAt: string; user: { username: string } };
type Health = { status: string; database: string; uptimeSeconds: number; responseMs: number; timestamp: string };

export default function ItAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<'users' | 'sessions' | 'security'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function get(path: string) {
    const response = await fetch(`${API}${path}`, { credentials: 'include' });
    if (response.status === 401) { router.replace('/login'); throw new Error('unauthenticated'); }
    if (!response.ok) throw new Error('Unable to load IT administration data');
    return response.json();
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const [h, u, s, e] = await Promise.all([get('/admin/it/health'), get('/admin/it/users'), get('/admin/it/sessions'), get('/admin/it/authentication-events')]);
      setHealth(h); setUsers(u); setSessions(s); setEvents(e);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load IT administration data'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function revoke(userId: string) {
    await fetch(`${API}/admin/it/users/${userId}/revoke-sessions`, { method: 'POST', credentials: 'include' });
    await load();
  }

  async function setStatus(userId: string, status: string) {
    await fetch(`${API}/admin/it/users/${userId}/status`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await load();
  }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span>PMS</span><small>Performance Management</small></div><nav><a onClick={() => router.push('/')}>Overview</a><a onClick={() => router.push('/reviews')}>My Reviews</a><a className="active">IT Administration</a></nav></aside>
    <section className="workspace">
      <header className="topbar"><div><p className="eyebrow">Technical administration</p><h1>IT Administration</h1></div><button className="back-button" onClick={() => router.push('/')}>Dashboard</button></header>
      <div className="content">
        {error && <p className="error">{error}</p>}
        <section className="admin-health"><div><p className="eyebrow">System health</p><h3>{health?.status === 'ok' ? 'All core services operational' : 'Checking system health…'}</h3></div><div className="health-metrics"><span>Database <strong>{health?.database ?? '—'}</strong></span><span>API response <strong>{health ? `${health.responseMs} ms` : '—'}</strong></span><span>Uptime <strong>{health ? `${Math.floor(health.uptimeSeconds / 3600)}h` : '—'}</strong></span></div></section>
        <div className="stat-grid"><article><span>Users</span><strong>{loading ? '—' : users.length}</strong><small>Accounts in your organization</small></article><article><span>Active sessions</span><strong>{loading ? '—' : sessions.filter(s => !s.revokedAt).length}</strong><small>Currently non-revoked sessions</small></article><article><span>Authentication events</span><strong>{loading ? '—' : events.length}</strong><small>Most recent 200 events</small></article></div>
        <section className="panel"><div className="tab-bar"><button className={tab === 'users' ? 'selected' : ''} onClick={() => setTab('users')}>Users</button><button className={tab === 'sessions' ? 'selected' : ''} onClick={() => setTab('sessions')}>Sessions</button><button className={tab === 'security' ? 'selected' : ''} onClick={() => setTab('security')}>Security events</button></div>
          {loading ? <p className="muted">Loading administration data…</p> : tab === 'users' ? <div className="admin-table"><div className="admin-row admin-head"><span>Account</span><span>Employee</span><span>Role</span><span>Status</span><span>Actions</span></div>{users.map(u => <div className="admin-row" key={u.id}><span><strong>{u.username}</strong><small>{u.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}</small></span><span>{u.employee.firstName} {u.employee.lastName}<small>{u.employee.employeeNumber}</small></span><span>{u.roles.map(r => r.role.name).join(', ') || 'No role'}</span><span><span className="status">{u.accountStatus.replaceAll('_', ' ')}</span></span><span className="action-buttons"><button onClick={() => revoke(u.id)}>Revoke sessions</button>{u.accountStatus === 'ACTIVE' ? <button onClick={() => setStatus(u.id, 'SUSPENDED')}>Suspend</button> : <button onClick={() => setStatus(u.id, 'ACTIVE')}>Activate</button>}</span></div>)}</div> : tab === 'sessions' ? <div className="admin-table"><div className="admin-row admin-head"><span>User</span><span>IP</span><span>Last activity</span><span>Status</span><span>User agent</span></div>{sessions.map(s => <div className="admin-row" key={s.id}><span>{s.user.username}</span><span>{s.ipAddress ?? '—'}</span><span>{new Date(s.lastActivityAt).toLocaleString()}</span><span>{s.revokedAt ? 'Revoked' : 'Active'}</span><span>{s.userAgent ?? '—'}</span></div>)}</div> : <div className="admin-table"><div className="admin-row admin-head"><span>User</span><span>Event</span><span>Result</span><span>Time</span></div>{events.map(e => <div className="admin-row" key={e.id}><span>{e.user.username}</span><span>{e.eventType.replaceAll('_', ' ')}</span><span>{e.success ? 'Success' : 'Failed'}</span><span>{new Date(e.createdAt).toLocaleString()}</span></div>)}</div>}
        </section>
      </div>
    </section>
  </main>;
}
