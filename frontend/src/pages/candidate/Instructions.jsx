import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';
import { Clock, BookOpen, Brain, Lightbulb, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

export default function Instructions() {
  const { sessionToken: token } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/candidate/instructions/${token}`).then(r => setData(r.data));
  }, [token]);

  const begin = async () => {
    setLoading(true);
    try {
      await api.post(`/candidate/accept-instructions/${token}`);
      navigate(`/assessment/${token}`);
    } finally { setLoading(false); }
  };

  if (!data) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}><div className="spinner-lg spinner" /></div>;

  const segments = [
    { num: 1, title: 'Knowledge Assessment', icon: BookOpen, color: '#4F46E5', bg: '#EEF2FF', desc: `${data.seg1_count || 15} multiple-choice questions testing core knowledge. Timer runs per question.` },
    { num: 2, title: 'Role Competency', icon: Brain, color: '#7C3AED', bg: '#F5F3FF', desc: `${data.seg2_count || 10} role-specific MCQs with optional rationale. Tests applied thinking.` },
    { num: 3, title: 'Scenario Response', icon: Lightbulb, color: '#D97706', bg: '#FFFBEB', desc: `${data.seg3_count || 2} open-ended scenarios. AI-evaluated for relevance and depth.` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: 'var(--text)' }}>TalentLens</span>
        </div>
        {state?.reference_code && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Reference Code</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--primary)', letterSpacing: '0.1em' }}>
              {state.reference_code}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px 60px' }}>
        <div style={{ width: '100%', maxWidth: 660 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
              Assessment Instructions
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-2)' }}>Please read carefully before you begin.</p>
          </div>

          {/* Segment cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {segments.map(({ num, title, icon: Icon, color, bg, desc }) => (
              <div key={num} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Segment {num} — {title}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)', marginBottom: 8 }}>Important — Please read</div>
                <ul style={{ fontSize: 13, color: '#92400E', lineHeight: 1.8, paddingLeft: 16 }}>
                  <li>Each segment is individually timed. The clock starts when a segment loads.</li>
                  <li>Unanswered questions when time expires are submitted as blank.</li>
                  <li>Do not close or refresh the browser mid-assessment.</li>
                  <li>Ensure a stable internet connection before proceeding.</li>
                  <li>This assessment may only be attempted once within the allowed period.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="portal-card" style={{ padding: 24 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                I have read and understood the instructions. I confirm that I am the intended candidate and will complete this assessment honestly and independently.
              </span>
            </label>
            <button
              onClick={begin} disabled={!accepted || loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>
              {loading ? <><span className="spinner" style={{width:16,height:16}} />Starting…</> : <><CheckCircle2 size={16} />Begin Assessment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
