import { useState, useEffect } from 'react';
import { Shield, Power, RotateCcw, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../../api/client';

const DEFAULTS = {
  enabled: true, max_weight: 60, grace_frames: 12, cooldown_ms: 15000,
  audio_rms: 72, audio_hold_ms: 9000, phone_confidence: 0.65,
  phone_frames: 5, phone_term_count: 3,
  gaze_h: 0.20, gaze_v_up: 0.14, gaze_v_down: 0.24, head_thresh: 0.16,
  violation_weights: {
    phone_detected:5, multiple_faces:4, devtools_open:4,
    copy_attempt:3, paste_attempt:3, tab_switch:3, keyboard_shortcut:2,
    fullscreen_exit:2, face_not_detected:1,
    audio_detected:0, gaze_away:0, head_turn:0, eyes_closed:0, window_blur:0,
  },
};

const WEIGHT_LABELS = {
  phone_detected:'📱 Phone detected', multiple_faces:'👥 Multiple faces',
  devtools_open:'🔧 DevTools opened', copy_attempt:'📋 Copy attempt',
  paste_attempt:'📋 Paste attempt', tab_switch:'🔀 Tab switch',
  keyboard_shortcut:'⌨️ Keyboard shortcut', fullscreen_exit:'🖥️ Fullscreen exit',
  face_not_detected:'👤 Face not visible', audio_detected:'🎤 Audio detected',
  gaze_away:'👁️ Gaze away', head_turn:'↔️ Head turn',
  eyes_closed:'😌 Eyes closed', window_blur:'🪟 Window blur',
};

function Slider({ label, value, min, max, step=1, onChange, hint }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <label style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{label}</label>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--primary)', fontFamily:'monospace' }}>
          {value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ width:'100%', accentColor:'var(--primary)' }} />
      {hint && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>{hint}</div>}
    </div>
  );
}

export default function ProctoringSettings() {
  const [cfg,     setCfg]     = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    api.get('/admin/proctoring-config')
      .then(r => setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const r = await api.put('/admin/proctoring-config', cfg);
      setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { alert('Save failed.'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm('Reset all proctoring settings to defaults?')) return;
    setSaving(true);
    try {
      const r = await api.post('/admin/proctoring-config/reset');
      setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const setW = (type, val) => setCfg(c => ({
    ...c, violation_weights: { ...c.violation_weights, [type]: parseInt(val) }
  }));

  if (loading) return <div style={{padding:40,textAlign:'center'}}><div className="spinner-lg spinner"/></div>;

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,fontWeight:400,
            display:'flex',alignItems:'center',gap:8}}>
            <Shield size={20} color="var(--primary)"/> Proctoring Settings
          </div>
          <div style={{fontSize:13,color:'var(--text-2)'}}>
            Configure detection sensitivity and violation scoring. Changes take effect for new sessions immediately.
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={reset} disabled={saving}>
            <RotateCcw size={14}/> Reset Defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saved ? <><CheckCircle size={14}/> Saved</> : <><Save size={14}/> {saving?'Saving…':'Save Changes'}</>}
          </button>
        </div>
      </div>

      <div className="admin-content page-fade" style={{maxWidth:860}}>

        {/* Master Switch */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:700,fontSize:16,display:'flex',alignItems:'center',gap:8}}>
                <Power size={18} color={cfg.enabled?'var(--success)':'var(--text-3)'}/>
                Proctoring {cfg.enabled ? 'Enabled' : 'Disabled'}
              </div>
              <div style={{fontSize:13,color:'var(--text-2)',marginTop:4,maxWidth:520}}>
                {cfg.enabled
                  ? 'Camera, gaze tracking, and violation detection are active for all assessments.'
                  : 'Proctoring is OFF. Candidates will take the assessment with no monitoring — ideal for in-person supervised sessions.'}
              </div>
            </div>
            <button onClick={() => setCfg(c => ({...c, enabled: !c.enabled}))}
              style={{
                width:56,height:30,borderRadius:15,border:'none',cursor:'pointer',
                background: cfg.enabled ? 'var(--success)' : 'var(--surface-2)',
                position:'relative',transition:'background 0.2s',
              }}>
              <div style={{
                width:22,height:22,borderRadius:'50%',background:'#fff',
                position:'absolute',top:4,
                left: cfg.enabled ? 30 : 4,
                transition:'left 0.2s',
                boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
              }}/>
            </button>
          </div>
          {!cfg.enabled && (
            <div style={{marginTop:12,padding:'10px 14px',background:'var(--warning-light)',
              border:'1px solid var(--warning-border)',borderRadius:8,
              fontSize:13,color:'var(--warning)',display:'flex',gap:8,alignItems:'flex-start'}}>
              <AlertTriangle size={15} style={{flexShrink:0,marginTop:1}}/>
              No proctoring means no integrity data. Use this only for physically supervised in-person assessments.
            </div>
          )}
        </div>

        {cfg.enabled && (<>

        {/* Termination */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:20,color:'var(--text)'}}>
            🎯 Termination Threshold
          </div>
          <Slider label="Max Violation Score before auto-terminate" value={cfg.max_weight}
            min={20} max={120} onChange={v => setCfg(c=>({...c,max_weight:v}))}
            hint={`Currently: terminate when accumulated violation score reaches ${cfg.max_weight} points`} />
          <Slider label="Grace Frames (frames before violation counts)" value={cfg.grace_frames}
            min={3} max={30} onChange={v => setCfg(c=>({...c,grace_frames:v}))}
            hint={`${cfg.grace_frames} frames ≈ ${(cfg.grace_frames/10).toFixed(1)}s at 10fps — higher = more tolerant`} />
          <Slider label="Cooldown between same events (seconds)" value={Math.round(cfg.cooldown_ms/1000)}
            min={5} max={60} onChange={v => setCfg(c=>({...c,cooldown_ms:v*1000}))}
            hint={`Same violation type won't fire again for ${Math.round(cfg.cooldown_ms/1000)} seconds`} />
        </div>

        {/* Audio */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:20}}>🎤 Audio Detection</div>
          <Slider label="Audio RMS Threshold" value={cfg.audio_rms}
            min={20} max={120} onChange={v => setCfg(c=>({...c,audio_rms:v}))}
            hint="Lower = more sensitive (20 catches whispers, 80 catches only loud speech)" />
          <Slider label="Sustained audio hold before flagging (seconds)" value={Math.round(cfg.audio_hold_ms/1000)}
            min={2} max={30} onChange={v => setCfg(c=>({...c,audio_hold_ms:v*1000}))}
            hint={`Candidate must speak continuously for ${Math.round(cfg.audio_hold_ms/1000)}s before flagged`} />
        </div>

        {/* Phone */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:20}}>📱 Phone Detection</div>
          <Slider label="COCO-SSD Confidence Threshold" value={cfg.phone_confidence}
            min={0.3} max={0.95} step={0.05} onChange={v => setCfg(c=>({...c,phone_confidence:v}))}
            hint="Lower = more sensitive but more false positives. 0.65 is recommended." />
          <Slider label="Consecutive frames to confirm phone" value={cfg.phone_frames}
            min={2} max={15} onChange={v => setCfg(c=>({...c,phone_frames:v}))}
            hint={`Phone must be visible for ${cfg.phone_frames} consecutive frames (~${(cfg.phone_frames/10).toFixed(1)}s)`} />
          <Slider label="Confirmed phone events before terminate" value={cfg.phone_term_count}
            min={1} max={10} onChange={v => setCfg(c=>({...c,phone_term_count:v}))}
            hint={`Candidate terminated after ${cfg.phone_term_count} confirmed phone detection events`} />
        </div>

        {/* Gaze */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:20}}>👁️ Gaze Detection</div>
          <Slider label="Horizontal gaze tolerance" value={cfg.gaze_h}
            min={0.08} max={0.40} step={0.01} onChange={v => setCfg(c=>({...c,gaze_h:v}))}
            hint="Iris horizontal deviation threshold — higher = more tolerant of sideways glances" />
          <Slider label="Looking-down tolerance" value={cfg.gaze_v_down}
            min={0.10} max={0.50} step={0.01} onChange={v => setCfg(c=>({...c,gaze_v_down:v}))}
            hint="Higher = more tolerant of looking at keyboard/desk" />
          <Slider label="Head turn tolerance" value={cfg.head_thresh}
            min={0.06} max={0.35} step={0.01} onChange={v => setCfg(c=>({...c,head_thresh:v}))}
            hint="Nose offset threshold — higher = more tolerant of head turns" />
        </div>

        {/* Violation weights */}
        <div className="card" style={{padding:24,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>⚖️ Violation Weights</div>
          <div style={{fontSize:13,color:'var(--text-2)',marginBottom:20}}>
            Points added to violation score per event. <strong>0 = log only, no score impact.</strong> Score ≥ {cfg.max_weight} → terminate.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {Object.entries(WEIGHT_LABELS).map(([type, label]) => (
              <div key={type} style={{display:'flex',alignItems:'center',gap:12,
                padding:'10px 14px',background:'var(--surface-2)',borderRadius:10}}>
                <span style={{fontSize:13,flex:1}}>{label}</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="number" min={0} max={10}
                    value={cfg.violation_weights[type] ?? 0}
                    onChange={e => setW(type, e.target.value)}
                    style={{width:48,textAlign:'center',fontWeight:700,fontSize:14,
                      border:'1px solid var(--border)',borderRadius:6,padding:'4px 6px'}}/>
                  <span style={{fontSize:11,color:(cfg.violation_weights[type]||0)===0?'var(--text-3)':'var(--primary)',
                    fontWeight:600,minWidth:28}}>
                    {(cfg.violation_weights[type]||0)===0?'log':'pts'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        </>)}

        {/* Save bar */}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingBottom:40}}>
          <button className="btn btn-secondary" onClick={reset} disabled={saving}>
            <RotateCcw size={14}/> Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saved ? <><CheckCircle size={14}/> Changes Saved</> : <><Save size={14}/> {saving?'Saving…':'Save Changes'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
