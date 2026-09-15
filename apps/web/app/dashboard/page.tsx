'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('pms_token');
    if (!token) { router.replace('/login'); return; }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setUser(await response.json());
      })
      .catch(() => { localStorage.removeItem('pms_token'); router.replace('/login'); });
  }, [router]);

  if (!user) return <main className="shell"><section className="card"><p>Loading dashboard…</p></section></main>;

  return <main className="shell"><section className="card"><p className="eyebrow">PMS DASHBOARD</p><h1>Welcome, {user.firstName}</h1><p>{user.username}</p><div className="grid"><div className="card"><h2>My Performance</h2><p>Performance cycles and reviews will appear here.</p></div><div className="card"><h2>My Team</h2><p>Reporting relationships will appear here.</p></div><div className="card"><h2>Reports</h2><p>Performance reports will appear here.</p></div></div><button className="button secondary" onClick={() => { localStorage.removeItem('pms_token'); router.push('/login'); }}>Sign out</button></section></main>;
}
