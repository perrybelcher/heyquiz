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
  return <main style={{ maxWidth: 560, margin: '10vh auto', padding: 24 }}>
    <h1>Something interrupted this page.</h1>
    <p>Try opening it again. If you were editing, check for a saved browser draft when the editor returns.</p>
    <button onClick={() => retry()} style={{ padding: '12px 20px', margin: '16px 0' }}>Try again</button>
    <p><a href="/">Go to your workspace</a></p>
    {reference && <p style={{ fontSize: 13, overflowWrap: 'anywhere' }}>Support reference: {reference}</p>}
  </main>;
}
