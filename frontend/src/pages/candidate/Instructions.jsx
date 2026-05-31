import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';
import { Clock, BookOpen, Brain, Lightbulb, AlertTriangle, CheckCircle2, Zap, Timer } from 'lucide-react';

const SEG_ICONS = { 1: BookOpen, 2: Brain, 3: Lightbulb };
const SEG_COLORS = { 1: '#4F46E5', 2: '#7C3AED', 3: '#D97706' };
const SEG_BG    = { 1: '#EEF2FF', 2: '#F5F3FF', 3: '#FFFBEB' };

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

  const fmtTime = (mins) => {
    if (!mins) return '';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  };

  if (!data) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  const totalMins = data.total_timer_minutes || (data.segments || []).reduce((a, s) => a + (s.timer_minutes || Math.round(s.timer_seconds / 60) || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '36px 24px 60px' }}>
        <div style={{ width: '100%', maxWidth: 660 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>
              Assessment Instructions
            </h1>
            {data.candidate_name && (
              <p style={{ fontSize: 15, color: 'var(--text-2)' }}>Welcome, <strong>{data.candidate_name}</strong></p>
            )}
          </div>

          {/* Total time banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)',
            borderRadius: 12, padding: '18px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Timer size={24} color="#A5B4FC" />
              <div>
                <div style={{ fontSize: 12, color: '#A5B4FC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Time Allotted</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{fmtTime(totalMins)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {(data.segments || []).map(s => (
                <div key={s.number} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{fmtTime(s.timer_minutes || Math.round((s.timer_seconds || 0) / 60))}</div>
                  <div style={{ fontSize: 10, color: '#A5B4FC' }}>Seg {s.number}</div>
                </div>
              ))}
            </div>
          </div>



          {/* Custom instructions from admin */}
          {data.instructions && data.instructions !== 'Please complete all three segments carefully.' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Additional Instructions</div>
              <div
                className="instruction-content"
                style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 }}
                dangerouslySetInnerHTML={{ __html: data.instructions }}
              />
            </div>
          )}

          {/* Warnings */}
          <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={17} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)', marginBottom: 8 }}>Important — Please read before starting</div>
                <ul style={{ fontSize: 13, color: '#92400E', lineHeight: 1.9, paddingLeft: 16 }}>
                  <li>The assessment is <strong>proctored</strong> — your webcam will be active and tab switches are monitored</li>
                  <li>Unanswered questions when time expires are submitted as blank</li>
                  <li>Do not close or refresh the browser during the assessment</li>
                  <li>Copy-paste and keyboard shortcuts are disabled</li>
                  <li>This assessment may only be attempted once</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="portal-card" style={{ padding: 24 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                I have read and understood all instructions. I confirm that I am the intended candidate and will complete this assessment honestly and independently.
              </span>
            </label>
            <button onClick={begin} disabled={!accepted || loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} />Starting…</>
                : <><CheckCircle2 size={16} />Begin Assessment ({fmtTime(totalMins)})</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
