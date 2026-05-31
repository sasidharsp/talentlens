import { useState, useEffect } from 'react';
import { Shield, Power, RotateCcw, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../api/client';

const DEFAULTS = {
  enabled: true,
  max_weight: 60, grace_frames: 12, cooldown_ms: 15000,
  audio_rms: 72, audio_hold_ms: 9000,
  phone_confidence: 0.65, phone_frames: 5, phone_term_count: 3,
  gaze_h: 0.20, gaze_v_up: 0.14, gaze_v_down: 0.24, head_thresh: 0.16,
  snap_ms: 10000,
  violation_weights: {
    phone_detected:5, multiple_faces:4, devtools_open:4,
    copy_attempt:3, paste_attempt:3, tab_switch:3,
    keyboard_shortcut:2, fullscreen_exit:2, face_not_detected:1,
    audio_detected:0, gaze_away:0, head_turn:0, eyes_closed:0, window_blur:0,
  },
};

const WEIGHT_LABELS = {
  phone_detected:'📱 Phone detected',     multiple_faces:'👥 Multiple faces',
  devtools_open:'🔧 DevTools opened',     copy_attempt:'📋 Copy attempt',
  paste_attempt:'📋 Paste attempt',       tab_switch:'🔀 Tab switch',
  keyboard_shortcut:'⌨️ Blocked shortcut', fullscreen_exit:'🖥️ Fullscreen exit',
  face_not_detected:'👤 Face not visible', audio_detected:'🎤 Audio/speech',
  gaze_away:'👁️ Gaze away',              head_turn:'↔️ Head turn',
  eyes_closed:'😌 Eyes closed',           window_blur:'🪟 Window blur',
};

function Slider({ label, value, min, max, step=1, hint, onChange }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <label style={{ fontSize:13, fontWeight:500 }}>{label}</label>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--primary)', fontFamily:'monospace' }}>
          {value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ width:'100%', accentColor:'var(--primary)' }} />
      {hint && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>{hint}</div>}
    </div>
  );
}

export default function ProctoringSettings() {
  const [cfg,     setCfg]     = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const load = () => {
    api.get('/admin/proctoring-config')
      .then(r => setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }}))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const r = await api.put('/admin/proctoring-config', cfg);
      setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { alert('Save failed — please try again.'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm('Reset all proctoring settings to defaults?')) return;
    setSaving(true);
    try {
      const r = await api.post('/admin/proctoring-config/reset');
      setCfg({ ...DEFAULTS, ...r.data,
        violation_weights: { ...DEFAULTS.violation_weights, ...(r.data.violation_weights||{}) }});
    } finally { setSaving(false); }
  };

  const setW = (type, val) => setCfg(c => ({
    ...c, violation_weights: { ...c.violation_weights, [type]: parseInt(val)||0 }
  }));

  if (loading) return <div style={{ padding:60, textAlign:'center' }}><div className="spinner-lg spinner" /></div>;

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400,
            display:'flex', alignItems:'center', gap:8 }}>
            <Shield size={20} color="var(--primary)" /> Proctoring Settings
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>
            Changes take effect for all new assessment sessions immediately.
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={reset} disabled={saving}>
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saved
              ? <><CheckCircle size={14} /> Saved</>
              : <><Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}</>}
          </button>
        </div>
      </div>

      <div className="admin-content page-fade" style={{ maxWidth:820 }}>

        {/* ── Master switch ── */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16, display:'flex', alignItems:'center', gap:8 }}>
                <Power size={18} color={cfg.enabled ? 'var(--success)' : 'var(--text-3)'} />
                Proctoring is {cfg.enabled ? 'ON' : 'OFF'}
              </div>
              <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4, maxWidth:500 }}>
                {cfg.enabled
                  ? 'Camera, gaze tracking, and violation detection are active for all remote assessments.'
                  : 'Proctoring is disabled. Candidates skip the camera entirely — ideal for in-person office sessions.'}
              </div>
            </div>
            {/* Toggle */}
            <button onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
              style={{ width:54, height:28, borderRadius:14, border:'none', cursor:'pointer', flexShrink:0,
                background: cfg.enabled ? 'var(--success)' : '#D1D5DB', position:'relative',
                transition:'background 0.2s' }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff',
                position:'absolute', top:4,
                left: cfg.enabled ? 30 : 4,
                transition:'left 0.2s',
                boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
            </button>
          </div>
          {!cfg.enabled && (
            <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, fontSize:13,
              background:'#FEF3C7', border:'1px solid #FCD34D', color:'#92400E',
              display:'flex', gap:8, alignItems:'flex-start' }}>
              <AlertTriangle size={15} style={{ flexShrink:0, marginTop:1 }} />
              No proctoring data will be recorded. Use this only for physically supervised sessions.
            </div>
          )}
        </div>

        {cfg.enabled && (<>

        {/* ── Termination ── */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:18 }}>🎯 Termination</div>
          <Slider label="Max violation score before auto-terminate" value={cfg.max_weight}
            min={20} max={120}
            hint={`Terminate when accumulated score reaches ${cfg.max_weight} pts`}
            onChange={v => setCfg(c => ({ ...c, max_weight:v }))} />
          <Slider label="Grace frames before violation counts" value={cfg.grace_frames}
            min={3} max={40}
            hint={`${cfg.grace_frames} frames ≈ ${(cfg.grace_frames/10).toFixed(1)}s sustained — higher = more tolerant`}
            onChange={v => setCfg(c => ({ ...c, grace_frames:v }))} />
          <Slider label="Cooldown between same events (seconds)" value={Math.round(cfg.cooldown_ms/1000)}
            min={5} max={60}
            hint={`Same event won't fire again for ${Math.round(cfg.cooldown_ms/1000)}s`}
            onChange={v => setCfg(c => ({ ...c, cooldown_ms:v*1000 }))} />
          <Slider label="Evidence snapshots every (seconds)" value={Math.round(cfg.snap_ms/1000)}
            min={5} max={60}
            hint={`Admin audit strip captures every ${Math.round(cfg.snap_ms/1000)}s`}
            onChange={v => setCfg(c => ({ ...c, snap_ms:v*1000 }))} />
        </div>

        {/* ── Audio ── */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:18 }}>🎤 Audio Detection</div>
          <Slider label="Volume threshold (RMS)" value={cfg.audio_rms}
            min={20} max={110}
            hint="Lower = catches quieter speech. 72 = loud sustained speech only."
            onChange={v => setCfg(c => ({ ...c, audio_rms:v }))} />
          <Slider label="Sustained speech before flagging (seconds)" value={Math.round(cfg.audio_hold_ms/1000)}
            min={2} max={30}
            hint={`Must speak continuously for ${Math.round(cfg.audio_hold_ms/1000)}s before flagged`}
            onChange={v => setCfg(c => ({ ...c, audio_hold_ms:v*1000 }))} />
        </div>

        {/* ── Phone ── */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:18 }}>📱 Phone Detection</div>
          <Slider label="Detection confidence threshold" value={cfg.phone_confidence}
            min={0.3} max={0.95} step={0.05}
            hint="Lower = more sensitive. 0.65 recommended."
            onChange={v => setCfg(c => ({ ...c, phone_confidence:v }))} />
          <Slider label="Consecutive frames to confirm phone" value={cfg.phone_frames}
            min={2} max={15}
            hint={`Phone must be visible for ${cfg.phone_frames} consecutive frames`}
            onChange={v => setCfg(c => ({ ...c, phone_frames:v }))} />
          <Slider label="Confirmed detections before terminate" value={cfg.phone_term_count}
            min={1} max={10}
            hint={`Session terminates after ${cfg.phone_term_count} confirmed phone events`}
            onChange={v => setCfg(c => ({ ...c, phone_term_count:v }))} />
        </div>

        {/* ── Gaze ── */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:18 }}>👁️ Gaze Detection</div>
          <Slider label="Horizontal gaze tolerance" value={cfg.gaze_h}
            min={0.08} max={0.45} step={0.01}
            hint="Higher = allows more sideways glancing"
            onChange={v => setCfg(c => ({ ...c, gaze_h:v }))} />
          <Slider label="Looking-down tolerance" value={cfg.gaze_v_down}
            min={0.10} max={0.55} step={0.01}
            hint="Higher = allows more looking at keyboard/desk"
            onChange={v => setCfg(c => ({ ...c, gaze_v_down:v }))} />
          <Slider label="Head turn tolerance" value={cfg.head_thresh}
            min={0.06} max={0.40} step={0.01}
            hint="Higher = more tolerant of head turns"
            onChange={v => setCfg(c => ({ ...c, head_thresh:v }))} />
        </div>

        {/* ── Violation weights ── */}
        <div className="card" style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>⚖️ Violation Weights</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:18 }}>
            Score added per event. <strong>0 = logged only, no score impact.</strong>
            &nbsp;Score ≥ {cfg.max_weight} pts → session terminates.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {Object.entries(WEIGHT_LABELS).map(([type, label]) => (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', background:'var(--surface-2)', borderRadius:8 }}>
                <span style={{ fontSize:13, flex:1 }}>{label}</span>
                <input type="number" min={0} max={10}
                  value={cfg.violation_weights[type] ?? 0}
                  onChange={e => setW(type, e.target.value)}
                  style={{ width:46, textAlign:'center', fontWeight:700, fontSize:14,
                    border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px' }} />
                <span style={{ fontSize:11, minWidth:26, color:
                  (cfg.violation_weights[type]||0) === 0 ? 'var(--text-3)' : 'var(--primary)',
                  fontWeight:600 }}>
                  {(cfg.violation_weights[type]||0) === 0 ? 'log' : 'pts'}
                </span>
              </div>
            ))}
          </div>
        </div>

        </>)}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingBottom:40 }}>
          <button className="btn btn-secondary" onClick={reset} disabled={saving}>
            <RotateCcw size={14} /> Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
