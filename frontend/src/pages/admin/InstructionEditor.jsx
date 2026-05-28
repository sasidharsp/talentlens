import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Save, Eye, EyeOff, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InstructionEditor({ type, title, description }) {
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    api.get(`/admin/instructions/${type}`).then(r => {
      setContent(r.data.content || '');
      setMeta(r.data);
    }).catch(() => {});
  }, [type]);

  const save = async () => {
    if (!content.trim()) { setMsg({ type:'error', text:'Content cannot be empty.' }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await api.post(`/admin/instructions/${type}`, { content });
      setMsg({ type:'success', text:`Saved as version ${r.data.version}` });
      setMeta({ ...meta, version: r.data.version, updated_at: r.data.updated_at });
    } catch (e) {
      setMsg({ type:'error', text: e.response?.data?.detail || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const loadHistory = async () => {
    const r = await api.get(`/admin/instructions/${type}/history`);
    setHistory(r.data);
    setShowHistory(true);
  };

  const restoreVersion = async (item) => {
    const r = await api.get(`/admin/instructions/${type}`);
    // Just load the content — we can set it as current draft
    setContent(item.preview.replace('...', ''));
    setShowHistory(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <span className="card-title">{title}</span>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{description}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {meta?.version && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>v{meta.version}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={loadHistory}>
            <Clock size={13} /> History
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview(!preview)}>
            {preview ? <EyeOff size={13} /> : <Eye size={13} />}
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? '…' : <><Save size={13} /> Save Version</>}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ margin: '12px 24px 0', padding: '8px 12px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: msg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)', color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${msg.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}` }}>
          {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      <div className="card-body">
        {preview ? (
          <div style={{ minHeight: 200, padding: '16px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
            {content || <em style={{ color: 'var(--text-3)' }}>Nothing to preview — write some content first.</em>}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              Supports plain text and basic Markdown (# headings, **bold**, *italic*, - bullet points)
            </div>
            <textarea
              className="input"
              rows={12}
              placeholder={`Enter ${title.toLowerCase()} here…`}
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
        )}
      </div>

      {showHistory && (
        <div style={{ margin: '0 24px 20px', background: 'var(--surface-2)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            Version History
            <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(false)}>Close</button>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No saved versions yet.</div>
          ) : history.map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>v{v.id}</span>
                <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{new Date(v.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span style={{ color: 'var(--text-2)', marginLeft: 8 }}>by {v.created_by}</span>
                {v.is_active && <span className="badge badge-green" style={{ marginLeft: 8 }}>Current</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
