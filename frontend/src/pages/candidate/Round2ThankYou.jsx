import { useSearchParams, useNavigate } from 'react-router-dom';
import { Award, XCircle, LogOut } from 'lucide-react';

export default function Round2ThankYou() {
  const [params] = useSearchParams();
  const terminated = params.get('terminated') === 'true';
  const handleExit = () => { try { window.close(); } catch(e) {} setTimeout(() => { window.location.href='about:blank'; }, 300); };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
      <div style={{ width:68, height:68, borderRadius:'50%', background: terminated ? 'var(--danger-light)' : '#F5F3FF', border:`2px solid ${terminated ? 'var(--danger-border)' : '#DDD6FE'}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
        {terminated ? <XCircle size={32} color="var(--danger)" /> : <Award size={32} color="#7C3AED" />}
      </div>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:34, fontWeight:400, color:'var(--text)', marginBottom:12 }}>
        {terminated ? 'Round 2 Terminated' : 'Round 2 Complete'}
      </h1>
      <p style={{ fontSize:16, color:'var(--text-2)', maxWidth:440, lineHeight:1.7, marginBottom:32 }}>
        {terminated
          ? 'Your session was terminated. This has been recorded. Contact your assessment coordinator for further guidance.'
          : 'Thank you for completing Round 2. The hiring team will review your responses and be in touch with next steps.'}
      </p>
      <button onClick={handleExit} className="btn btn-secondary" style={{ gap:8 }}>
        <LogOut size={16} /> Close Session &amp; Exit
      </button>
    </div>
  );
}
