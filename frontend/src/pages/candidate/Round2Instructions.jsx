import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';
import { Zap, Award, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';

export default function Round2Instructions() {
  const { token } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(state || {});

  useEffect(() => {
    api.get(`/round2/session/${token}`).then(r => setSessionData(r.data)).catch(() => {});
  }, [token]);

  const begin = async () => {
    setLoading(true);
    try {
      await api.post(`/round2/start/${token}`);
      navigate(`/round2/assessment/${token}`);
    } catch(e) {
      alert(e.response?.data?.detail || 'Failed to start. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}><Zap size={16} color="#fff" /></div>
          <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18 }}>TalentLens — Round 2</span>
        </div>
        {sessionData.candidate_name && <span style={{ fontSize:13, color:'var(--text-2)' }}>Welcome, <strong>{sessionData.candidate_name}</strong></span>}
      </div>

      <div style={{ flex:1, display:'flex', justifyContent:'center', padding:'36px 24px 60px' }}>
        <div style={{ width:'100%', maxWidth:620 }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ width:56, height:56, borderRadius:14, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Award size={28} color="#7C3AED" />
            </div>
            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, fontWeight:400, color:'var(--text)', marginBottom:6 }}>Round 2 Assessment</h1>
            <p style={{ fontSize:14, color:'var(--text-2)' }}>{sessionData.role && `Applying for: ${sessionData.role}`}</p>
          </div>

          {/* Assessment overview */}
          <div style={{ background:'linear-gradient(135deg, #3B0764 0%, #7C3AED 100%)', borderRadius:12, padding:'20px 24px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Clock size={22} color="#C4B5FD" />
              <div>
                <div style={{ fontSize:12, color:'#C4B5FD', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Total Time Allotted</div>
                <div style={{ fontSize:26, fontWeight:800, color:'#fff' }}>25 minutes</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:28, fontWeight:800, color:'#fff' }}>5</div>
              <div style={{ fontSize:12, color:'#C4B5FD' }}>Open Questions</div>
            </div>
          </div>

          {/* What to expect */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px', marginBottom:16 }}>
            <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <FileText size={16} color="#7C3AED" /> What to expect
            </div>
            {[
              ['5 scenario-based questions', 'Each drawing on real-world BFSI situations relevant to your role.'],
              ['One question at a time', 'Questions are revealed one by one — no going back to previous answers.'],
              ['5 minutes per question', 'Aim for structured, detailed responses that show depth of thinking.'],
              ['AI evaluation', 'Your responses are assessed in context of your Round 1 performance.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display:'flex', gap:10, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#7C3AED', flexShrink:0, marginTop:6 }} />
                <div>
                  <strong style={{ fontSize:13, color:'var(--text)' }}>{title}</strong>
                  <div style={{ fontSize:12, color:'var(--text-2)', marginTop:1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div style={{ background:'var(--warning-light)', border:'1px solid var(--warning-border)', borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
            <div style={{ display:'flex', gap:10 }}>
              <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink:0, marginTop:2 }} />
              <div style={{ fontSize:13, color:'#92400E', lineHeight:1.8 }}>
                <strong>This is a proctored assessment.</strong> Your session is monitored. Tab switches and leaving the window will be recorded. Ensure you are in a quiet environment before beginning.
              </div>
            </div>
          </div>

          <div className="portal-card" style={{ padding:24 }}>
            <label style={{ display:'flex', gap:12, cursor:'pointer', alignItems:'flex-start' }}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop:3, width:16, height:16, accentColor:'#7C3AED', cursor:'pointer' }} />
              <span style={{ fontSize:14, color:'var(--text)', lineHeight:1.6 }}>
                I am ready to begin. I confirm I will complete this assessment independently, in a quiet environment, without any external assistance.
              </span>
            </label>
            <button onClick={begin} disabled={!accepted || loading} className="btn btn-lg"
              style={{ width:'100%', justifyContent:'center', marginTop:18, background: accepted ? '#7C3AED' : 'var(--surface-2)', color: accepted ? '#fff' : 'var(--text-3)', border:'none', cursor: accepted ? 'pointer' : 'not-allowed' }}>
              {loading ? <><span className="spinner" style={{width:16,height:16,borderTopColor:'#fff'}}/>Starting…</> : <><CheckCircle2 size={16}/>Begin Round 2 (25 min)</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
