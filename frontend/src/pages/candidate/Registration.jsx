import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

export default function Registration() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', experience: '', role_applied: '',
  });
  const [roles, setRoles]     = useState([]);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    api.get('/candidate/roles').then(r => setRoles(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setErr('Full name and email are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const res = await api.post('/candidate/register', form);
      navigate('/instructions', { state: { token: res.data.token, candidate: res.data } });
    } catch (e) {
      setErr(e.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo + title — compact */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>
            TalentLens
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Candidate Registration</div>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label" style={{ fontSize: 12 }}>Full Name *</label>
              <input className="input" style={{ height: 36, fontSize: 13 }}
                value={form.full_name} placeholder="Your full name"
                onChange={e => set('full_name', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label" style={{ fontSize: 12 }}>Email Address *</label>
              <input type="email" className="input" style={{ height: 36, fontSize: 13 }}
                value={form.email} placeholder="your@email.com"
                onChange={e => set('email', e.target.value)} />
            </div>

            <div>
              <label className="label" style={{ fontSize: 12 }}>Phone</label>
              <input className="input" style={{ height: 36, fontSize: 13 }}
                value={form.phone} placeholder="+91 98765 43210"
                onChange={e => set('phone', e.target.value)} />
            </div>

            <div>
              <label className="label" style={{ fontSize: 12 }}>Years of Experience</label>
              <input className="input" style={{ height: 36, fontSize: 13 }}
                value={form.experience} placeholder="e.g. 5"
                onChange={e => set('experience', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label" style={{ fontSize: 12 }}>Role Applied For</label>
              {roles.length > 0 ? (
                <select className="input" style={{ height: 36, fontSize: 13 }}
                  value={form.role_applied}
                  onChange={e => set('role_applied', e.target.value)}>
                  <option value="">— Select role —</option>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : (
                <input className="input" style={{ height: 36, fontSize: 13 }}
                  value={form.role_applied} placeholder="e.g. Senior Production Engineer"
                  onChange={e => set('role_applied', e.target.value)} />
              )}
            </div>
          </div>

          {err && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', borderRadius: 6,
              border: '1px solid #FECACA', color: '#DC2626', fontSize: 12 }}>
              {err}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14, height: 38, fontSize: 14 }}
            onClick={submit}
            disabled={saving}
          >
            {saving ? 'Registering…' : 'Continue to Assessment →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
          Your information is used only for assessment purposes.
        </div>
      </div>
    </div>
  );
}
