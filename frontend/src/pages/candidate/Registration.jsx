import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import WebcamCapture from '../../components/WebcamCapture';
import { Zap, Camera, CheckCircle } from 'lucide-react';

export default function Registration() {
  const [requisitions, setRequisitions] = useState([]);
  const [form, setForm] = useState({
    full_name:'', email:'', mobile:'', requisition_id:'', years_of_experience:''
  });
  const [webcamPhoto, setWebcamPhoto] = useState(null);
  const [showWebcam, setShowWebcam] = useState(false);
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
    if (!webcamPhoto) { setError('Identity photo is required. Please open the camera and take a photo before continuing.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      const r = await api.post('/candidate/register', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      if (webcamPhoto) {
        const photoFd = new FormData();
        photoFd.append('photo', webcamPhoto, 'webcam.jpg');
        await api.post(`/candidate/webcam-photo/${r.data.session_token}`, photoFd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }).catch(() => {});
      }

      navigate(`/instructions/${r.data.session_token}`, { state: { reference_code: r.data.reference_code } });
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header — squeezed */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={12} color="#fff" />
        </div>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 14, color: 'var(--text)' }}>TalentLens</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 16px 16px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {/* Title — compact */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: 0 }}>
              Candidate Registration
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, marginBottom: 0 }}>
              Complete your profile to begin the assessment.
            </p>
          </div>

          <div className="portal-card" style={{ padding: '14px 18px' }}>
            {error && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>Full Name <span style={{color:'var(--danger)'}}>*</span></label>
                  <input className="input" style={{ height: 32, fontSize: 12 }} required value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="As per ID" />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>Email Address <span style={{color:'var(--danger)'}}>*</span></label>
                  <input type="email" className="input" style={{ height: 32, fontSize: 12 }} required value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@email.com" />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>Mobile Number <span style={{color:'var(--danger)'}}>*</span></label>
                  <input className="input" style={{ height: 32, fontSize: 12 }} required value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>Years of Experience <span style={{color:'var(--danger)'}}>*</span></label>
                  <input type="number" className="input" style={{ height: 32, fontSize: 12 }} required min="0" max="50" step="0.5"
                    value={form.years_of_experience} onChange={e=>set('years_of_experience',e.target.value)} placeholder="e.g. 4.5" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>Applying For <span style={{color:'var(--danger)'}}>*</span></label>
                  <select className="input" style={{ height: 32, fontSize: 12 }} required value={form.requisition_id} onChange={e=>set('requisition_id',e.target.value)}>
                    <option value="">Select role…</option>
                    {requisitions.length === 0
                      ? <option disabled>No active requisitions — contact admin</option>
                      : requisitions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Identity Photo */}
              <div style={{ marginBottom: 10 }}>
                <label className="label" style={{ fontSize: 11, marginBottom: 3 }}>
                  Identity Photo <span style={{color:'var(--danger)'}}>*</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>required for proctored assessment</span>
                </label>
                {!showWebcam ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, border: `1px dashed ${webcamPhoto ? 'var(--success-border)' : 'var(--danger-border)'}` }}>
                    {webcamPhoto ? (
                      <>
                        <CheckCircle size={15} color="var(--success)" />
                        <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, flex: 1 }}>Photo captured ✓</span>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setShowWebcam(true); setWebcamPhoto(null); }}>Retake</button>
                      </>
                    ) : (
                      <>
                        <Camera size={15} color="var(--danger)" />
                        <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>A photo is required to verify your identity</span>
                        <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setShowWebcam(true)}>
                          <Camera size={12} /> Open Camera
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 10 }}>
                    <WebcamCapture
                      onCapture={(blob, dataUrl) => { if (blob) { setWebcamPhoto(blob); setShowWebcam(false); } }}
                      onSkip={null}
                    />
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', height: 36, fontSize: 13 }}>
                {loading
                  ? <><span className="spinner" style={{width:14,height:14}} />Registering…</>
                  : 'Register & Continue →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
