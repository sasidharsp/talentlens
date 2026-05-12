import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Zap, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/admin');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex' }}>
      {/* Left panel */}
      <div style={{
        width: 440, flexShrink: 0,
        background: 'linear-gradient(160deg, #1E1B4B 0%, #312E81 60%, #4338CA 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 44px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#fff', fontWeight: 400 }}>TalentLens</span>
        </div>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
            Hire with clarity,<br />
            <em style={{ color: '#A5B4FC' }}>not guesswork.</em>
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            AI-powered assessments that reveal real capability — across knowledge, role-fit, and practical thinking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Objective', 'AI-scored answers'], ['Structured', '3-segment process'], ['Tracked', 'Full lifecycle audit']].map(([t, s]) => (
            <div key={t}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#C7D2FE' }}>{t}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Admin sign in</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Access the assessment management portal</p>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">Email address</label>
              <input
                type="email" className="input"
                placeholder="you@organisation.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} />Signing in…</> : 'Sign in to portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
