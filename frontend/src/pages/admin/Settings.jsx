import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Save, AlertCircle, CheckCircle2, Download, Database, FolderArchive, Shield } from 'lucide-react';

const GROUPS = {
  'Assessment Counts': ['seg1_question_count','seg2_question_count','seg3_question_count'],
  'Timer (minutes)': ['seg1_timer_minutes','seg2_timer_minutes','seg3_timer_minutes'],
  'Seg 1 Difficulty Mix': ['seg1_difficulty_high','seg1_difficulty_medium','seg1_difficulty_low'],
  'Score Weights (%)': ['score_weight_seg1','score_weight_seg2','score_weight_seg3'],
  'LLM Scoring Weights': ['llm_relevance_weight','llm_context_weight','llm_semantics_weight'],
  'General': ['max_upload_size_mb','duplicate_cooldown_days','num_interview_rounds'],
};

const LABEL = {
  seg1_question_count:'Segment 1 Questions', seg2_question_count:'Segment 2 Questions', seg3_question_count:'Segment 3 Questions',
  seg1_timer_minutes:'Segment 1 Timer', seg2_timer_minutes:'Segment 2 Timer', seg3_timer_minutes:'Segment 3 Timer',
  seg1_difficulty_high:'High Difficulty', seg1_difficulty_medium:'Medium Difficulty', seg1_difficulty_low:'Low Difficulty',
  score_weight_seg1:'Segment 1 Weight', score_weight_seg2:'Segment 2 Weight', score_weight_seg3:'Segment 3 Weight',
  llm_relevance_weight:'Relevance Weight', llm_context_weight:'Context Weight', llm_semantics_weight:'Semantics Weight',
  max_upload_size_mb:'Max Upload (MB)', duplicate_cooldown_days:'Duplicate Cooldown (days)', num_interview_rounds:'Interview Rounds',
};

export default function Settings() {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/admin/config').then(r => setConfig(r.data));
  }, []);

  const save = async (key) => {
    setSaving(key); setMsg(null);
    try {
      await api.put('/admin/config', { key, value: String(config[key]) });
      setMsg({ type: 'success', text: `Saved: ${LABEL[key] || key}` });
    } catch {
      setMsg({ type: 'error', text: 'Save failed.' });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>Settings</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Assessment configuration</div>
        </div>
      </div>
      <div className="admin-content page-fade" style={{ maxWidth: 720 }}>
        {msg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            borderRadius: 8, marginBottom: 20, fontSize: 13,
            background: msg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${msg.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}>
            {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        {Object.entries(GROUPS).map(([group, keys]) => (
          <div key={group} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">{group}</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {keys.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{LABEL[key] || key}</label>
                  <input
                    type="number" className="input" style={{ width: 100, textAlign: 'right' }}
                    value={config[key] ?? ''} onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => save(key)} disabled={saving === key}>
                    {saving === key ? '…' : <><Save size={13} />Save</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Backup & Export ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="var(--primary)" />
              <span className="card-title">Backup & Data Export</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Resumes backup */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderArchive size={18} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Download All Resumes</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    Downloads a ZIP file containing every candidate resume uploaded to the platform.
                    Filename includes the candidate reference code and name.
                  </div>
                </div>
              </div>
              <a
                href="/api/admin/backup/resumes"
                download
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0, textDecoration: 'none' }}
              >
                <Download size={14} /> Download ZIP
              </a>
            </div>

            {/* Database backup */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={18} color="var(--success)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Download Database Backup</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    Exports the complete database as a <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.sql</code> file —
                    all candidates, questions, responses, rounds, and config.
                    Use this to migrate to any other server.
                  </div>
                </div>
              </div>
              <a
                href="/api/admin/backup/database"
                download
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0, textDecoration: 'none' }}
              >
                <Download size={14} /> Download SQL
              </a>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
              <Shield size={12} />
              Backup downloads are restricted to Super Admin only and are recorded in the audit log.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
