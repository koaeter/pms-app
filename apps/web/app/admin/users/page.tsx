'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type User = { id: string; username: string; firstName: string; lastName: string; email?: string; isActive: boolean; roles: Array<{ role: { id: string; name: string } }> };
type Role = { id: string; name: string; description?: string; _count: { users: number } };

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', firstName: '', lastName: '', email: '' });

  async function load() {
    const token = localStorage.getItem('pms_token');
    const headers = { Authorization: `Bearer ${token}` };
    const [u, r] = await Promise.all([fetch(`${API}/admin/users`, { headers }), fetch(`${API}/admin/roles`, { headers })]);
    if (!u.ok || !r.ok) { setError('You do not have permission to administer users.'); return; }
    setUsers(await u.json()); setRoles(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const token = localStorage.getItem('pms_token');
    const response = await fetch(`${API}/admin/users`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) { setError(await response.text()); return; }
    setForm({ username: '', password: '', firstName: '', lastName: '', email: '' }); await load();
  }

  async function toggle(user: User) {
    const token = localStorage.getItem('pms_token');
    await fetch(`${API}/admin/users/${user.id}/status`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !user.isActive }) });
    load();
  }

  async function addRole(userId: string, roleId: string) {
    const token = localStorage.getItem('pms_token');
    await fetch(`${API}/admin/users/${userId}/roles`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId }) });
    load();
  }

  return <main className="shell"><section className="card"><p className="eyebrow">SYSTEM ADMINISTRATION</p><h1>Users & Roles</h1><p>Manage user accounts, activation status and role assignments.</p>{error && <p>{error}</p>}
    <form onSubmit={createUser} className="grid"><input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /><input placeholder="Password (10+ characters)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={10} /><input placeholder="First name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /><input placeholder="Last name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /><input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><button className="button" type="submit">Create user</button></form>
    <h2>Accounts</h2><div>{users.map(user => <article key={user.id} className="card"><strong>{user.firstName} {user.lastName}</strong> <span>@{user.username}</span><p>{user.email ?? 'No email'} · {user.isActive ? 'Active' : 'Inactive'}</p><p>Roles: {user.roles.map(x => x.role.name).join(', ') || 'None'}</p><button className="button" onClick={() => toggle(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button>{roles.length > 0 && <select defaultValue="" onChange={e => e.target.value && addRole(user.id, e.target.value)}><option value="">Assign role…</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</article>)}</div>
  </section></main>;
}
