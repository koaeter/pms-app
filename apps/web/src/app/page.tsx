export default function HomePage() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 48 }}>
      <section style={{ background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 8px 30px rgba(0,0,0,.06)' }}>
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Performance Management System
        </p>
        <h1 style={{ fontSize: 42, margin: '16px 0' }}>Performance, structured for the organization.</h1>
        <p style={{ maxWidth: 720, lineHeight: 1.7 }}>
          A configurable platform for KPIs, competencies, reviews, approvals, evidence,
          organizational hierarchy, auditability and role-based access.
        </p>
      </section>
    </main>
  );
}
