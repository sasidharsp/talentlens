import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Zap } from 'lucide-react';

export default function Registration() {
  const [requisitions, setRequisitions] = useState([]);
  const [form, setForm] = useState({
    full_name:'', email:'', mobile:'', requisition_id:'', years_of_experience:'',
    current_organization:''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/candidate/requisitions').then(r => setRequisitions(r.data));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.years_of_experience) { setError('Years of experience is required.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      const r = await api.post('/candidate/register', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate(`/instructions/${r.data.session_token}`, { state: { reference_code: r.data.reference_code } });
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={16} color="#fff" />
        </div>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: 'var(--text)' }}>TalentLens</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px 60px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
              Candidate Registration
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Complete your profile to begin the assessment.
            </p>
          </div>

          <div className="portal-card" style={{ padding: 32 }}>
            {error && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label">Full Name <span style={{color:'var(--danger)'}}>*</span></label>
                  <input className="input" required value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="As per ID" />
                </div>
                <div>
                  <label className="label">Email Address <span style={{color:'var(--danger)'}}>*</span></label>
                  <input type="email" className="input" required value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@email.com" />
                </div>
                <div>
                  <label className="label">Mobile Number <span style={{color:'var(--danger)'}}>*</span></label>
                  <input className="input" required value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="label">
                    Years of Experience <span style={{color:'var(--danger)'}}>*</span>
                  </label>
                  <input type="number" className="input" required min="0" max="50" step="0.5"
                    value={form.years_of_experience} onChange={e=>set('years_of_experience',e.target.value)}
                    placeholder="e.g. 4.5" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Applying For <span style={{color:'var(--danger)'}}>*</span></label>
                  <select className="input" required value={form.requisition_id} onChange={e=>set('requisition_id',e.target.value)}>
                    <option value="">Select role…</option>
                    {requisitions.length === 0
                      ? <option disabled>No active requisitions — contact admin</option>
                      : requisitions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Current Organisation <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" value={form.current_organization} onChange={e=>set('current_organization',e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                {loading ? <><span className="spinner" style={{width:16,height:16}} />Registering…</> : 'Register & Continue →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
