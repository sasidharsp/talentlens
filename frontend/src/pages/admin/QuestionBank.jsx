import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { downloadFile } from '../../api/download';
import {
  Plus, Upload, Download, Trash2, BookOpen,
  FileSpreadsheet, AlertTriangle, CheckCircle2,
  RefreshCw, X, AlertCircle, Tag, Search
} from 'lucide-react';

const SEG_CONFIG = {
  1: { label: 'Segment 1 — Knowledge MCQ',      color: '#4F46E5', bg: '#EEF2FF' },
  2: { label: 'Segment 2 — Role Competency MCQ', color: '#7C3AED', bg: '#F5F3FF' },
  3: { label: 'Segment 3 — Scenario Response',   color: '#D97706', bg: '#FFFBEB' },
};

const emptyForm = (seg) => seg < 3
  ? { question_text:'', option_a:'', option_b:'', option_c:'', option_d:'',
      correct_answer:'A', difficulty:'medium', category:'', batch_tag:'', role_tags:'', skill_tags:'' }
  : { scenario_text:'', reference_answer:'', difficulty:'medium', batch_tag:'', role_tags:'' };

// ── Purge confirmation modal ──────────────────────────────────────────────────
function PurgeModal({ seg, count, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 32,
        width: 440, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Purge All Questions?</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>Segment {seg} — {SEG_CONFIG[seg].label.split('—')[1].trim()}</div>
          </div>
        </div>
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: 'var(--danger)', lineHeight: 1.6 }}>
          This will <strong>permanently delete all {count} questions</strong> in this segment.
          This cannot be undone. Candidate responses already recorded are not affected.
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          Type <strong>DELETE</strong> below to confirm:
        </div>
        <ConfirmInput onConfirm={onConfirm} onCancel={onCancel} loading={loading} />
      </div>
    </div>
  );
}

function ConfirmInput({ onConfirm, onCancel, loading }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        className="input" placeholder="Type DELETE to confirm"
        value={val} onChange={e => setVal(e.target.value)}
        style={{ borderColor: val === 'DELETE' ? 'var(--danger)' : 'var(--border-2)' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-sm"
          disabled={val !== 'DELETE' || loading}
          onClick={onConfirm}
          style={{
            background: val === 'DELETE' ? 'var(--danger)' : 'var(--surface-2)',
            color: val === 'DELETE' ? '#fff' : 'var(--text-3)',
            border: '1px solid var(--danger-border)',
            cursor: val === 'DELETE' ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Deleting…' : 'Yes, delete all'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Import result banner ──────────────────────────────────────────────────────
function ImportResult({ result, onClose }) {
  if (!result) return null;
  const hasErrors = result.errors?.length > 0;
  return (
    <div style={{
      background: hasErrors ? 'var(--warning-light)' : 'var(--success-light)',
      border: `1px solid ${hasErrors ? 'var(--warning-border)' : 'var(--success-border)'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {hasErrors
            ? <AlertCircle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            : <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: hasErrors ? 'var(--warning)' : 'var(--success)', marginBottom: 4 }}>
              {result.message}
            </div>
            {hasErrors && (
              <div style={{ fontSize: 12, color: '#92400E', marginTop: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Skipped rows:</div>
                {result.errors.map((e, i) => (
                  <div key={i}>Row {e.row}: {e.error}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuestionBank() {
  const [seg, setSeg]           = useState(1);
  const [questions, setQuestions] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(emptyForm(1));
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [purgeModal, setPurgeModal]     = useState(false);
  const [purging, setPurging]           = useState(false);
  // Batch tag state
  const [allTags, setAllTags]       = useState([]);
  const [activeTag, setActiveTag]   = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBatchTag, setImportBatchTag]   = useState('');
  const [importFile, setImportFile]           = useState(null);
  const [importing, setImporting]             = useState(false);
  const fileRef = useRef();

  const loadTags = () => api.get('/admin/questions/batch-tags').then(r => setAllTags(r.data || [])).catch(() => {});

  const load = async (s = seg, p = page, tag = activeTag) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, page_size: 20 });
      if (tag) params.set('batch_tag', tag);
      const r = await api.get(`/admin/questions/seg${s}?${params}`);
      setQuestions(r.data.items || []);
      setTotal(r.data.total || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(seg, 1, ''); setPage(1); setActiveTag(''); setShowAdd(false); setForm(emptyForm(seg)); setImportResult(null); loadTags(); }, [seg]);
  useEffect(() => { load(seg, page, activeTag); }, [page]);

  const filterByTag = (tag) => {
    const newTag = tag === activeTag ? '' : tag;
    setActiveTag(newTag); setPage(1);
    load(seg, 1, newTag);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.role_tags)  payload.role_tags  = form.role_tags.split(',').map(s => s.trim()).filter(Boolean);
      if (form.skill_tags) payload.skill_tags = form.skill_tags.split(',').map(s => s.trim()).filter(Boolean);
      await api.post(`/admin/questions/seg${seg}`, payload);
      setShowAdd(false); setForm(emptyForm(seg)); load(seg, page, activeTag); loadTags();
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/admin/questions/seg${seg}/${id}`);
    load(seg, page, activeTag);
  };

  const doImport = async () => {
    if (!importFile) return;
    if (!importBatchTag.trim()) { alert('Please enter a batch tag.'); return; }
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('batch_tag', importBatchTag.trim());
    fd.append('segment', seg);
    try {
      const r = await api.post(`/admin/questions/import-tagged`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(r.data);
      setShowImportModal(false); setImportFile(null); setImportBatchTag('');
      load(seg, 1, ''); setPage(1); loadTags();
    } catch (ex) {
      setImportResult({ message: ex.response?.data?.detail || 'Import failed.', created: 0, errors: [] });
      setShowImportModal(false);
    } finally { setImporting(false); }
    fileRef.current.value = '';
  };

  const doPurge = async () => {
    setPurging(true);
    try {
      const r = await api.delete(`/admin/questions/seg${seg}/purge`);
      setPurgeModal(false);
      setImportResult({ message: r.data.message, imported: 0, errors: [] });
      load(seg, 1, ''); setPage(1); loadTags();
    } finally { setPurging(false); }
  };

  const cfg    = SEG_CONFIG[seg];
  const isSeg3 = seg === 3;

  return (
    <div>
      {purgeModal && (
        <PurgeModal
          seg={seg} count={total}
          onConfirm={doPurge} onCancel={() => setPurgeModal(false)}
          loading={purging}
        />
      )}

      {/* Import modal with batch tag */}
      {showImportModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:32, width:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
              <Tag size={18} color="var(--primary)" /> Import — Batch Tag Required
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:20, lineHeight:1.6 }}>
              All questions in <strong>{importFile?.name}</strong> will be tagged together.<br/>
              Use the batch tag to find and filter this group later.
            </div>
            <label className="label">
              Batch Tag <span style={{color:'var(--danger)'}}>*</span>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:400, marginLeft:4 }}>e.g. BFSI-Java-L2-Jun2025</span>
            </label>
            <input className="input" placeholder="Enter a unique tag for this batch…"
              value={importBatchTag} onChange={e => setImportBatchTag(e.target.value)}
              style={{ marginBottom:12, fontFamily:'monospace', fontWeight:600, letterSpacing:'0.03em' }} autoFocus />
            {allTags.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6, fontWeight:600 }}>Or reuse an existing tag:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {allTags.map(t => (
                    <button key={t} type="button" onClick={() => setImportBatchTag(t)}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background: importBatchTag===t ? 'var(--primary)' : 'var(--primary-light)',
                        color: importBatchTag===t ? '#fff' : 'var(--primary)', border:'1px solid var(--primary-border)', cursor:'pointer', fontFamily:'monospace' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn btn-primary" onClick={doImport} disabled={importing || !importBatchTag.trim()}>
                {importing ? <><span className="spinner" style={{width:14,height:14}}/>Importing…</> : <><Upload size={14}/> Import</>}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowImportModal(false); setImportFile(null); fileRef.current.value=''; }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>Question Bank</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{total} questions in current segment</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Template download */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadFile(`/api/admin/questions/seg${seg}/template`, `TalentLens_Segment${seg}_Template.xlsx`)}
            title="Download blank Excel template for this segment"
          >
            <FileSpreadsheet size={14} /> Download Template
          </button>

          {/* Import — triggers modal for batch tag */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); setShowImportModal(true); } }} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
            <Upload size={14} /> Import Excel
          </button>

          {/* Export */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadFile(`/api/admin/questions/seg${seg}/export`, `talentlens_seg${seg}_export.xlsx`)}
          >
            <Download size={14} /> Export
          </button>

          {/* Purge */}
          {total > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => setPurgeModal(true)}
              title="Delete all questions in this segment"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
            >
              <RefreshCw size={14} /> Purge All
            </button>
          )}

          {/* Add */}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
            <Plus size={14} /> Add Question
          </button>
        </div>
      </div>

      <div className="admin-content page-fade">
        {/* Segment tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => setSeg(s)} style={{
              padding: '9px 20px', border: 'none', cursor: 'pointer', background: 'none',
              fontSize: 14, fontWeight: 500,
              color: seg === s ? 'var(--primary)' : 'var(--text-2)',
              borderBottom: seg === s ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}>
              {SEG_CONFIG[s].label.split('—')[0].trim()}
            </button>
          ))}
        </div>

        {/* Import result */}
        <ImportResult result={importResult} onClose={() => setImportResult(null)} />

        {/* Batch tag filter chips */}
        {allTags.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Tag size={12} /> Batch Tags
              </div>
              <button
                onClick={() => filterByTag('')}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, cursor: 'pointer',
                  background: !activeTag ? 'var(--primary)' : 'var(--surface-2)',
                  color: !activeTag ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${!activeTag ? 'var(--primary)' : 'var(--border)'}`,
                  fontWeight: !activeTag ? 700 : 400 }}>
                All
              </button>
              {allTags.map(tag => (
                <button key={tag}
                  onClick={() => filterByTag(tag)}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'monospace',
                    background: activeTag === tag ? 'var(--primary)' : 'var(--surface-2)',
                    color: activeTag === tag ? '#fff' : 'var(--primary)',
                    border: `1px solid ${activeTag === tag ? 'var(--primary)' : 'var(--primary-border)'}`,
                    fontWeight: activeTag === tag ? 700 : 400 }}>
                  {tag}
                </button>
              ))}
              {activeTag && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  — showing {total} questions in <strong>{activeTag}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Template hint banner */}
        {total === 0 && !loading && (
          <div style={{
            background: 'var(--primary-light)', border: '1px solid var(--primary-border)',
            borderRadius: 10, padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--primary)',
          }}>
            <FileSpreadsheet size={18} style={{ flexShrink: 0 }} />
            <span>
              No questions yet. <strong>Download the template</strong> above, fill in your questions,
              save as .xlsx, then click <strong>Import Excel</strong> to upload.
            </span>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="card" style={{ marginBottom: 20, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={15} color={cfg.color} /> New Question — {cfg.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {isSeg3 ? (
                <>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Scenario Text <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea className="input" rows={4} value={form.scenario_text} onChange={e => setForm(f => ({ ...f, scenario_text: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Reference Answer <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea className="input" rows={4} value={form.reference_answer} onChange={e => setForm(f => ({ ...f, reference_answer: e.target.value }))} placeholder="Ideal answer used as AI evaluation benchmark" />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Question Text <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea className="input" rows={3} value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))} />
                  </div>
                  {['a', 'b', 'c', 'd'].map(l => (
                    <div key={l}>
                      <label className="label">Option {l.toUpperCase()} <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input className="input" value={form[`option_${l}`]} onChange={e => setForm(f => ({ ...f, [`option_${l}`]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label className="label">Correct Answer <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select className="input" value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}>
                      {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Databases, Networking" />
                  </div>
                  {seg === 2 && (
                    <>
                      <div>
                        <label className="label">Role Tags <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(comma-separated)</span></label>
                        <input className="input" value={form.role_tags} onChange={e => setForm(f => ({ ...f, role_tags: e.target.value }))} placeholder="Java Developer, QA Engineer" />
                      </div>
                      <div>
                        <label className="label">Skill Tags <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(comma-separated)</span></label>
                        <input className="input" value={form.skill_tags} onChange={e => setForm(f => ({ ...f, skill_tags: e.target.value }))} />
                      </div>
                    </>
                  )}
                </>
              )}
              <div>
                <label className="label">Difficulty <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select className="input" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="label">
                  Batch Tag
                  <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:400, marginLeft:4 }}>— groups this question for easy search</span>
                </label>
                <input className="input" placeholder="e.g. BFSI-Java-L2-Jun2025"
                  value={form.batch_tag} onChange={e => setForm(f => ({...f, batch_tag: e.target.value}))}
                  list="batch-tag-suggestions" style={{ fontFamily:'monospace' }} />
                <datalist id="batch-tag-suggestions">
                  {allTags.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              {isSeg3 && (
                <div>
                  <label className="label">Role Tags <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(comma-separated)</span></label>
                  <input className="input" value={form.role_tags} onChange={e => setForm(f => ({ ...f, role_tags: e.target.value }))} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Question'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner" />
            </div>
          ) : (
            <>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{isSeg3 ? 'Scenario' : 'Question'}</th>
                    <th>Difficulty</th><th>Batch Tag</th>
                    <th>{isSeg3 ? 'Role Tags' : 'Category'}</th>
                    {!isSeg3 && <th style={{ width: 60 }}>Answer</th>}
                    <th style={{ width: 60 }}>Used</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.id}>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{(page - 1) * 20 + i + 1}</td>
                      <td style={{ maxWidth: 400 }}>
                        <div style={{
                          fontSize: 13, color: 'var(--text)', overflow: 'hidden',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {isSeg3 ? q.scenario_text : q.question_text}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${q.difficulty === 'high' ? 'badge-red' : q.difficulty === 'medium' ? 'badge-amber' : 'badge-green'}`}>
                          {q.difficulty}
                        </span>
                        </td>
                        <td>
                          {q.batch_tag
                            ? <button onClick={() => filterByTag(q.batch_tag)} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--primary-border)', cursor:'pointer', fontFamily:'monospace' }}>{q.batch_tag}</button>
                            : <span style={{ color:'var(--text-3)', fontSize:12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {isSeg3 ? (q.role_tags || []).join(', ') || '—' : q.category || '—'}
                      </td>
                      {!isSeg3 && (
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{q.correct_answer}</td>
                      )}
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{q.usage_count || 0}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => del(q.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {questions.length === 0 && (
                    <tr>
                      <td colSpan={isSeg3 ? 6 : 7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
                        No questions yet — download the template and import to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {total > 20 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page} · {total} total</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Prev</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
