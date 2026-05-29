import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Zap, LogOut } from 'lucide-react';

export default function ThankYou() {
  const [params] = useSearchParams();
  const terminated = params.get('terminated') === 'true';

  const handleExit = () => {
    // Try to close the window; works if opened by JS, otherwise redirect to a blank page
    try { window.close(); } catch (e) {}
    // Fallback — navigate away so the session is clearly ended
    setTimeout(() => { window.location.href = 'about:blank'; }, 300);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: terminated ? 'var(--danger-light)' : 'var(--success-light)', border: `2px solid ${terminated ? 'var(--danger-border)' : 'var(--success-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        {terminated
          ? <XCircle size={32} color="var(--danger)" />
          : <CheckCircle2 size={32} color="var(--success)" />}
      </div>

      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>
        {terminated ? 'Assessment Terminated' : 'Assessment Complete'}
      </h1>

      <p style={{ fontSize: 16, color: 'var(--text-2)', maxWidth: 440, lineHeight: 1.7, marginBottom: 32 }}>
        {terminated
          ? 'Your session was terminated due to a proctoring violation. This has been recorded. Please contact the assessment coordinator.'
          : 'Thank you for completing the TalentLens assessment. Your responses have been recorded and will be reviewed by the hiring team.'}
      </p>

      {!terminated && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 28px', maxWidth: 400, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Zap size={16} color="var(--primary)" />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>What happens next?</span>
          </div>
          <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 2, textAlign: 'left', paddingLeft: 16 }}>
            <li>Your responses have been recorded</li>
            <li>The hiring team will review your results</li>
            <li>You will be contacted via email if shortlisted</li>
          </ul>
        </div>
      )}

      <button
        onClick={handleExit}
        className="btn btn-secondary"
        style={{ gap: 8, fontSize: 14 }}
      >
        <LogOut size={16} />
        Close Session &amp; Exit
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
        You may close this browser window safely
      </p>
    </div>
  );
}
