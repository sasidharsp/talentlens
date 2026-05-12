import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Upload, FileText, X, Zap, CheckCircle } from 'lucide-react';

export default function Registration() {
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    full_name:'', email:'', mobile:'', role_id:'', years_of_experience:'',
    current_organization:'', highest_qualification:'', linkedin_url:''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const navigate = useNavigate();

  useEffect(() => { api.get('/candidate/roles').then(r => setRoles(r.data)); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('File too large — max 5MB.'); return; }
    setFile(f); setError('');
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('resume', file);
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
        <div style={{ width: '100%', maxWidth: 680 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 32, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
              Candidate Registration
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Complete your profile to begin the assessment. This takes about 2 minutes.
            </p>
          </div>

          {/* Steps preview */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {[['Segment 1','15 MCQ · Knowledge','~45 min'], ['Segment 2','10 MCQ · Role Fit','~80 min'], ['Segment 3','2 Scenarios','~8 min']].map(([s,d,t], i) => (
              <div key={s} style={{ flex: 1, padding: '16px 20px', borderRight: i < 2 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{i+1}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{s}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{d}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{t}</div>
              </div>
            ))}
          </div>

          <div className="portal-card" style={{ padding: 32 }}>
            {error && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><label className="label">Full Name <span style={{color:'var(--danger)'}}>*</span></label><input className="input" required value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="As per ID" /></div>
                <div><label className="label">Email Address <span style={{color:'var(--danger)'}}>*</span></label><input type="email" className="input" required value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@email.com" /></div>
                <div><label className="label">Mobile Number <span style={{color:'var(--danger)'}}>*</span></label><input className="input" required value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="+91 98765 43210" /></div>
                <div><label className="label">Years of Experience <span style={{color:'var(--danger)'}}>*</span></label><input type="number" className="input" required min="0" max="50" step="0.5" value={form.years_of_experience} onChange={e=>set('years_of_experience',e.target.value)} placeholder="e.g. 4.5" /></div>
                <div><label className="label">Applying for Role <span style={{color:'var(--danger)'}}>*</span></label>
                  <select className="input" required value={form.role_id} onChange={e=>set('role_id',e.target.value)}>
                    <option value="">Select role…</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Current Organisation</label><input className="input" value={form.current_organization} onChange={e=>set('current_organization',e.target.value)} placeholder="Optional" /></div>
                <div><label className="label">Highest Qualification</label><input className="input" value={form.highest_qualification} onChange={e=>set('highest_qualification',e.target.value)} placeholder="e.g. B.Tech, MBA" /></div>
                <div><label className="label">LinkedIn URL</label><input className="input" value={form.linkedin_url} onChange={e=>set('linkedin_url',e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
              </div>

              {/* Resume upload */}
              <div style={{ marginBottom: 24 }}>
                <label className="label">Resume / CV</label>
                <div
                  onDragOver={e=>e.preventDefault()} onDrop={handleDrop}
                  onClick={() => fileRef.current.click()}
                  style={{
                    border: `2px dashed ${file ? 'var(--success-border)' : 'var(--border-2)'}`,
                    borderRadius: 10, padding: '24px', textAlign: 'center',
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: file ? 'var(--success-light)' : 'var(--surface-2)',
                  }}>
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--success)' }}>
                      <CheckCircle size={20} />
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{file.name}</span>
                      <button type="button" onClick={e=>{e.stopPropagation();setFile(null)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)' }}><X size={14}/></button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} color="var(--text-3)" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Drop your resume here</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>PDF, DOC, DOCX · max 5MB</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <><span className="spinner" style={{width:16,height:16}} />Registering…</> : 'Register & Continue →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
