'use client';
import { useEffect, useState } from 'react';

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [reference, setReference] = useState('');
  useEffect(() => {
    let active = true;
    // Reporting failure must never prevent recovery. No error text or quiz data
    // leaves the browser in this request.
    fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/pippi-error' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data?.reference) setReference(data.reference); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return <main style={{ maxWidth: 560, margin: '10vh auto', padding: 32, border: '1px solid #e7e3df', borderRadius: 20, background: '#faf9f6', color: '#242020' }}>
    <img src="/pippi-logo.svg" alt="Pippi" style={{ width: 120, marginBottom: 28 }} />
    <h1 style={{ fontSize: 28, fontWeight: 650, lineHeight: 1.2, marginBottom: 16 }}>Something interrupted this page.</h1>
    <p style={{ lineHeight: 1.6, color: "#625b58" }}>Try opening it again. If you were editing, check for a saved browser draft when the editor returns.</p>
    <button onClick={() => retry()} style={{ padding: '12px 20px', margin: '24px 0 16px', borderRadius: 10, background: '#a91d25', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
    <p><a href="/" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Go to your workspace</a></p>
    {reference && <p style={{ fontSize: 12, overflowWrap: 'anywhere', marginTop: 24, color: '#766f6b' }}>Support reference: {reference}</p>}
  </main>;
}
