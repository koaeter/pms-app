import Link from 'next/link';

export default function Admin() {
  return <main className="shell"><section className="card">
    <p className="eyebrow">SYSTEM ADMINISTRATION</p><h1>Administration</h1>
    <div className="grid">
      <article><h2>Identity</h2><p>Users, roles, permissions and account status.</p><Link className="button" href="/admin/users">Manage users & roles</Link></article>
      <article><h2>Organisation</h2><p>Departments, designations and reporting relationships.</p></article>
      <article><h2>Performance</h2><p>Cycles, review types, KPIs, competencies and rating scales.</p><Link className="button" href="/admin/performance">Open performance administration</Link></article>
      <article><h2>Governance</h2><p>Approval workflows and system activity.</p><Link className="button" href="/admin/audit">View audit log</Link></article>
    </div>
  </section></main>;
}
