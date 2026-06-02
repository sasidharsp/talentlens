import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';

export default function Instructions() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { token, candidate } = location.state || {};

  const [config, setConfig]     = useState(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    api.get('/candidate/assessment-config').then(r => setConfig(r.data)).catch(() => {});
  }, [token]);

  const begin = () => {
    if (!accepted) return;
    navigate('/assessment', { state: { token, candidate } });
  };

  // Fallback values while loading
  const s1q = config?.seg1_count ?? '—';
  const s1t = config?.seg1_time  ?? '—';
  const s2q = config?.seg2_count ?? '—';
  const s2t = config?.seg2_time  ?? '—';
  const s3q = config?.seg3_count ?? '—';
  const s3t = config?.seg3_time  ?? '—';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--text)' }}>
            Assessment Instructions
          </div>
          {candidate?.full_name && (
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>
              Welcome, <strong>{candidate.full_name}</strong>
            </div>
          )}
        </div>

        {/* Yellow instructions block */}
        <div style={{
          border: '1.5px solid #F59E0B',
          borderRadius: 10,
          background: '#FFFBEB',
          padding: '16px 20px',
          marginBottom: 14,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#92400E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Please read before you begin
          </div>

          <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <li style={{ fontSize: 13, color: '#78350F', lineHeight: 1.45 }}>
              <strong>Segment 1:</strong> {s1q} Multiple Choice Questions — {s1t}-minute timer. Answers are auto-submitted when time expires.
            </li>
            <li style={{ fontSize: 13, color: '#78350F', lineHeight: 1.45 }}>
              <strong>Segment 2:</strong> {s2q} Multiple Choice Questions with optional rationale — {s2t}-minute timer.
            </li>
            <li style={{ fontSize: 13, color: '#78350F', lineHeight: 1.45 }}>
              <strong>Segment 3:</strong> {s3q} Scenario-Based Questions requiring detailed written responses — {s3t}-minute timer.
            </li>
            <li style={{ fontSize: 13, color: '#78350F', lineHeight: 1.45 }}>
              Once you begin a segment you <strong>cannot return</strong> to a previous one. Ensure a stable internet connection throughout.
            </li>
            <li style={{ fontSize: 13, color: '#78350F', lineHeight: 1.45 }}>
              <strong>Proctoring Notice:</strong> This assessment is monitored. By proceeding, you consent to periodic camera snapshots, gaze and movement tracking, and audio activity detection for integrity purposes. All data is used solely for assessment evaluation.
            </li>
          </ul>
        </div>

        {/* Consent checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 16px',
          background: 'var(--surface)',
          borderRadius: 8,
          border: `1.5px solid ${accepted ? 'var(--primary)' : 'var(--border)'}`,
          cursor: 'pointer',
          marginBottom: 14,
          transition: 'border-color 0.15s',
        }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--primary)', width: 15, height: 15, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>
            I have read and understood the instructions. I consent to proctoring and agree to complete the assessment honestly and independently.
          </span>
        </label>

        {/* Begin button */}
        <button
          className="btn btn-primary"
          style={{
            width: '100%', height: 42, fontSize: 14,
            opacity: accepted ? 1 : 0.45,
            cursor: accepted ? 'pointer' : 'not-allowed',
          }}
          onClick={begin}
          disabled={!accepted}
        >
          Begin Assessment →
        </button>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
          Ensure your camera and microphone are accessible before starting.
        </div>
      </div>
    </div>
  );
}
