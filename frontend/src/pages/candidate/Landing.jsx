import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, ClipboardList, Award } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'16px 32px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Zap size={16} color="#fff" />
        </div>
        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:'var(--text)' }}>TalentLens</span>
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
        <div style={{ width:'100%', maxWidth:700 }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:40, fontWeight:400, color:'var(--text)', marginBottom:12, lineHeight:1.2 }}>
              Welcome to TalentLens
            </h1>
            <p style={{ fontSize:16, color:'var(--text-2)', lineHeight:1.7, maxWidth:480, margin:'0 auto' }}>
              An AI-powered assessment platform. Select the appropriate assessment below to proceed.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            {/* Round 1 */}
            <button onClick={() => navigate('/register')}
              style={{ background:'var(--surface)', border:'2px solid var(--border)', borderRadius:16, padding:'32px 28px', cursor:'pointer', textAlign:'left', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:16 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.boxShadow='var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}>
              <div style={{ width:52, height:52, borderRadius:13, background:'var(--primary-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ClipboardList size={26} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:'var(--text)', marginBottom:6 }}>
                  New Assessment
                </div>
                <div style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.65 }}>
                  First-time candidates register here to take the complete 3-segment screening assessment.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--primary)', fontWeight:600, marginTop:'auto' }}>
                Register & Begin <ArrowRight size={15} />
              </div>
            </button>

            {/* Round 2 */}
            <button onClick={() => navigate('/round2')}
              style={{ background:'var(--surface)', border:'2px solid var(--border)', borderRadius:16, padding:'32px 28px', cursor:'pointer', textAlign:'left', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:16 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#7C3AED'; e.currentTarget.style.boxShadow='var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}>
              <div style={{ width:52, height:52, borderRadius:13, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Award size={26} color="#7C3AED" />
              </div>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:'var(--text)', marginBottom:6 }}>
                  Round 2 Assessment
                </div>
                <div style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.65 }}>
                  Shortlisted candidates — enter your reference code from Round 1 to access your second round.
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#7C3AED', fontWeight:600, marginTop:'auto' }}>
                Enter Code & Begin <ArrowRight size={15} />
              </div>
            </button>
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'var(--text-3)', marginTop:32 }}>
            If you are unsure which to select, contact your assessment coordinator.
          </p>
        </div>
      </div>
    </div>
  );
}
