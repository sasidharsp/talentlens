import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Zap, Award, ArrowLeft } from 'lucide-react';

export default function Round2Entry() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const verify = async (e) => {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter your reference code.'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.post('/round2/verify', { reference_code: code.trim() });
      navigate(`/round2/instructions/${r.data.session_token}`, {
        state: { candidate_name: r.data.candidate_name, role: r.data.role }
      });
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed. Please check your code.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}><Zap size={16} color="#fff" /></div>
          <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:'var(--text)' }}>TalentLens</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={14}/> Back</button>
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
        <div style={{ width:'100%', maxWidth:440 }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <Award size={32} color="#7C3AED" />
            </div>
            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:30, fontWeight:400, color:'var(--text)', marginBottom:8 }}>Round 2 Assessment</h1>
            <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.7 }}>
              Enter the reference code you received after clearing Round 1 to access your second-round assessment.
            </p>
          </div>

          <div className="portal-card" style={{ padding:32 }}>
            {error && (
              <div style={{ background:'var(--danger-light)', border:'1px solid var(--danger-border)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--danger)', marginBottom:20 }}>
                {error}
              </div>
            )}
            <form onSubmit={verify}>
              <label className="label">Your Reference Code</label>
              <input className="input"
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. TL-2025-0042"
                style={{ fontFamily:'monospace', fontWeight:700, fontSize:18, letterSpacing:'0.1em', textAlign:'center', marginBottom:20 }}
                autoFocus />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                style={{ width:'100%', justifyContent:'center', background:'#7C3AED', borderColor:'#7C3AED' }}>
                {loading ? <><span className="spinner" style={{width:16,height:16}}/>Verifying…</> : 'Verify & Continue →'}
              </button>
            </form>
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'var(--text-3)', marginTop:20, lineHeight:1.7 }}>
            Your reference code was provided after your Round 1 results.<br/>
            If you can't find it, contact your assessment coordinator.
          </p>
        </div>
      </div>
    </div>
  );
}
