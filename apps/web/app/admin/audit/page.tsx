'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export default function AuditAdmin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { const token = localStorage.getItem('pms_token'); fetch(`${API}/admin/audit`, { headers: { Authorization: `Bearer ${token}` } }).then(async r => r.ok ? setLogs(await r.json()) : setError('You do not have permission to view audit logs.')); }, []);
  return <main className="shell"><section className="card"><p className="eyebrow">GOVERNANCE</p><h1>Audit Log</h1>{error && <p>{error}</p>}<div>{logs.map(log => <article key={log.id} className="card"><strong>{log.action}</strong><p>{log.entity}{log.entityId ? ` · ${log.entityId}` : ''}</p><small>{new Date(log.createdAt).toLocaleString()}</small></article>)}</div></section></main>;
}
