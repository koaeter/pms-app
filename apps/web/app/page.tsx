import Link from 'next/link';

export default function Home() {
  return <main className="shell"><section className="card"><p className="eyebrow">PMS</p><h1>Performance Management System</h1><p>Configurable performance management for public-sector organisations.</p><div className="actions"><Link className="button" href="/login">Sign in</Link><Link className="button secondary" href="/admin">System administration</Link></div></section></main>;
}
