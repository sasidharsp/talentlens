import { CheckCircle2, Zap } from 'lucide-react';

export default function ThankYou() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--success-light)', border: '2px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <CheckCircle2 size={32} color="var(--success)" />
      </div>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 34, fontWeight: 400, color: 'var(--text)', marginBottom: 12 }}>
        Assessment Complete
      </h1>
      <p style={{ fontSize: 16, color: 'var(--text-2)', maxWidth: 440, lineHeight: 1.7, marginBottom: 32 }}>
        Thank you for completing the TalentLens assessment. Your responses have been recorded and will be reviewed by the hiring team.
      </p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 28px', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Zap size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>What happens next?</span>
        </div>
        <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 2, textAlign: 'left', paddingLeft: 16 }}>
          <li>AI evaluation of your responses is underway</li>
          <li>The hiring team will review your results</li>
          <li>You will be contacted via email if shortlisted</li>
        </ul>
      </div>
    </div>
  );
}
