'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type User = {
  id: string; username: string; firstName: string; lastName: string; email?: string | null;
  isActive: boolean; provisioningOrganisationId?: string | null;
  roles: Array<{ role: { id: string; name: string } }>;
  employee?: { id: string; employeeNumber: string; organisation?: { id: string; name: string } | null } | null;
};
type Role = { id: string; name: string; description?: string; _count: { users: number } };
type Employee = { id: string; employeeNumber: string; user?: { id: string } | null };

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', firstName: '', lastName: '', email: '' });

  async function load() {
    const token = localStorage.getItem('pms_token');
    const headers = { Authorization: `Bearer ${token}` };
    const [u, r] = await Promise.all([fetch(`${API}/admin/users`, { headers }), fetch(`${API}/admin/roles`, { headers })]);
    if (!u.ok || !r.ok) { setError('You do not have permission to administer users.'); return; }
    setUsers(await u.json()); setRoles(await r.json());
    const me = await fetch(API + '/auth/me', { headers });
    if (me.ok) {
      const currentUser = await me.json();
      if (currentUser?.organisationId) {
        const e = await fetch(API + '/organisation/' + currentUser.organisationId + '/employees', { headers });
        if (e.ok) setEmployees(await e.json());
      }
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const token = localStorage.getItem('pms_token');
    const response = await fetch(`${API}/admin/users`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
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

  async function linkEmployee(userId: string, employeeId: string) {
    const token = localStorage.getItem('pms_token');
    const response = await fetch(`${API}/admin/users/${userId}/link-employee/${employeeId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { setError(await response.text()); return; }
    load();
  }

  return <main className="shell"><section className="card">
    <p className="eyebrow">SYSTEM ADMINISTRATION</p><h1>Users & Roles</h1>
    <p>Manage login identities separately from personnel records. Accounts may be unassigned until they are linked to an employee.</p>
    {error && <p>{error}</p>}
    <form onSubmit={createUser} className="grid">
      <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
      <input placeholder="Password (10+ characters)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={10} />
      <input placeholder="First name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required />
      <input placeholder="Last name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required />
      <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <button className="button" type="submit">Create account</button>
    </form>
    <h2>Accounts</h2>
    <div>{users.map(user => <article key={user.id} className="card">
      <strong>{user.firstName} {user.lastName}</strong> <span>@{user.username}</span>
      <p>{user.email ?? 'No email'} · {user.isActive ? 'Active' : 'Inactive'}</p>
      <p>Roles: {user.roles.map(x => x.role.name).join(', ') || 'None'}</p>
      <p>{user.employee ? `Employee: ${user.employee.employeeNumber} · ${user.employee.organisation?.name ?? 'Organisation assigned'}` : user.provisioningOrganisationId ? 'Pending employee assignment' : 'Platform account / unassigned'}</p>
      {!user.employee && employees.length > 0 && <select defaultValue="" onChange={e => e.target.value && linkEmployee(user.id, e.target.value)}>
        <option value="">Link to employee…</option>
        {employees.filter(e => !e.user || e.user.id === user.id).map(e => <option key={e.id} value={e.id}>{e.employeeNumber}</option>)}
      </select>}
      <button className="button" onClick={() => toggle(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button>
      {roles.length > 0 && <select defaultValue="" onChange={e => e.target.value && addRole(user.id, e.target.value)}>
        <option value="">Assign role…</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>}
    </article>)}</div>
  </section></main>;
}
