'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Sign-in failed');
      localStorage.setItem('pms_token', data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell"><section className="card narrow"><p className="eyebrow">ACCOUNT ACCESS</p><h1>Sign in</h1><form className="form" onSubmit={submit}><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label><label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>{error && <p className="error">{error}</p>}<button className="button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></section></main>;
}
