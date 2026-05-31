import { useState, useEffect, useRef } from 'react';
import { Tag, Plus, ChevronDown, ChevronUp, Upload, Download, Trash2 } from 'lucide-react';
import api from '../../api/client';

export default function InPersonQuestions() {
  const [tags,         setTags]         = useState([]);
  const [questions,    setQuestions]     = useState([]);
  const [activeTag,    setActiveTag]     = useState(null);
  const [expanded,     setExpanded]      = useState({});
  const [showAdd,      setShowAdd]       = useState(false);
  const [saving,       setSaving]        = useState(false);
  const [saved,        setSaved]         = useState(false);
  const [importing,    setImporting]     = useState(false);
  const [importResult, setImportResult]  = useState(null);
  const [form, setForm] = useState({ question:'', answer:'', tag:'', newTag:'' });
  const [error, setError] = useState('');
  const fileRef = useRef();

  const loadTags = () =>
    api.get('/inperson/tags').then(r => setTags(r.data)).catch(() => {});

  const loadQuestions = (tag = null) =>
    api.get('/inperson/questions', { params: tag ? { tag } : {} })
       .then(r => setQuestions(r.data)).catch(() => {});

  useEffect(() => { loadTags(); loadQuestions(); }, []);

  // ── Fix 1: Download template via api client (sends JWT) ──────────
  const downloadTemplate = async () => {
    try {
      const r = await api.get('/inperson/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'inperson_questions_template.xlsx';
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Failed to download template.'); }
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post('/inperson/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(r.data);
      await loadTags(); await loadQuestions(activeTag);
    } catch (e) {
      setImportResult({ error: e.response?.data?.detail || 'Import failed.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleTag = (tag) => {
    const next = activeTag === tag ? null : tag;
    setActiveTag(next); loadQuestions(next);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Fix 4: Delete individual question ───────────────────────────
  const deleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/inperson/questions/${id}`);
    await loadTags(); await loadQuestions(activeTag);
  };

  // ── Fix 4: Delete all questions in a tag ───────────────────────
  const deleteByTag = async (tag) => {
    if (!confirm(`Delete ALL questions tagged "${tag}"?`)) return;
    await api.delete(`/inperson/questions/by-tag/${encodeURIComponent(tag)}`);
    if (activeTag === tag) setActiveTag(null);
    await loadTags(); await loadQuestions(activeTag === tag ? null : activeTag);
  };

  // ── Fix 3: Purge all ───────────────────────────────────────────
  const purgeAll = async () => {
    if (!confirm('Delete ALL in-person interview questions? This cannot be undone.')) return;
    await api.delete('/inperson/questions');
    setActiveTag(null); await loadTags(); await loadQuestions();
  };

  const handleAdd = async () => {
    setError('');
    const tag = form.newTag.trim() || form.tag;
    if (!form.question.trim()) { setError('Question is required.'); return; }
    if (!form.answer.trim())   { setError('Answer is required.');   return; }
    if (!tag)                  { setError('Tag is required.');       return; }
    setSaving(true);
    try {
      await api.post('/inperson/questions', {
        question: form.question.trim(), answer: form.answer.trim(), tag,
      });
      setSaved(true);
      setForm({ question:'', answer:'', tag:'', newTag:'' });
      setTimeout(() => setSaved(false), 2000);
      await loadTags(); await loadQuestions(activeTag);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const grouped = questions.reduce((acc, q) => {
    (acc[q.tag] = acc[q.tag] || []).push(q);
    return acc;
  }, {});

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400 }}>
            In-person Interview Questions
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:2 }}>
            {questions.length} question{questions.length !== 1 ? 's' : ''}
            {activeTag ? ` in "${activeTag}"` : ' across all tags'}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
            <Download size={14} /> Download Template
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            style={{ display:'none' }} onChange={doImport} />
          <button className="btn btn-secondary btn-sm"
            onClick={() => fileRef.current.click()} disabled={importing}>
            <Upload size={14} /> {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={purgeAll}
            style={{ background:'#FEE2E2', color:'#DC2626', border:'1px solid #FCA5A5' }}>
            <Trash2 size={14} /> Purge All
          </button>
          <button className="btn btn-primary btn-sm"
            onClick={() => { setShowAdd(s => !s); setError(''); }}>
            <Plus size={14} /> Add Question
          </button>
        </div>
      </div>

      <div className="admin-content page-fade">

        {/* Import result */}
        {importResult && (
          <div style={{
            marginBottom:16, padding:'12px 16px', borderRadius:8, fontSize:13,
            background: importResult.error ? 'var(--danger-light)' : '#F0FDF4',
            border: `1px solid ${importResult.error ? 'var(--danger-border)' : '#BBF7D0'}`,
            color: importResult.error ? 'var(--danger)' : '#166534',
          }}>
            {importResult.error || importResult.message}
            {importResult.errors?.length > 0 && (
              <div style={{ marginTop:6, fontSize:12, opacity:0.8 }}>
                {importResult.errors.slice(0,3).map((e,i) =>
                  <div key={i}>Row {e.row}: {e.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add question form */}
        {showAdd && (
          <div className="card" style={{ padding:24, marginBottom:24,
            border:'1px solid var(--primary)40', background:'var(--primary)05' }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16,
              display:'flex', alignItems:'center', gap:8 }}>
              <Plus size={15} color="var(--primary)" /> Add New Question
            </div>
            {error && (
              <div style={{ background:'var(--danger-light)', border:'1px solid var(--danger-border)',
                borderRadius:8, padding:'8px 12px', fontSize:13, color:'var(--danger)', marginBottom:12 }}>
                {error}
              </div>
            )}
            <div style={{ display:'grid', gap:14 }}>
              <div>
                <label className="form-label">Tag</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select className="input" value={form.tag}
                    onChange={e => setForm(f => ({ ...f, tag:e.target.value, newTag:'' }))}>
                    <option value="">— Select existing tag —</option>
                    {tags.map(t => <option key={t.tag} value={t.tag}>{t.tag}</option>)}
                  </select>
                  <span style={{ alignSelf:'center', color:'var(--text-3)', fontSize:13 }}>or</span>
                  <input className="input" placeholder="Create new tag…"
                    value={form.newTag}
                    onChange={e => setForm(f => ({ ...f, newTag:e.target.value, tag:'' }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Question</label>
                <textarea className="input" rows={3} placeholder="Enter the interview question…"
                  value={form.question}
                  onChange={e => setForm(f => ({ ...f, question:e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Expected Answer</label>
                <textarea className="input" rows={4} placeholder="Enter the expected answer / key points…"
                  value={form.answer}
                  onChange={e => setForm(f => ({ ...f, answer:e.target.value }))} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
                  {saved ? '✓ Saved' : saving ? 'Saving…' : <><Plus size={13} /> Save Question</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Tag chips */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>
            Browse by Tag
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            <button onClick={() => handleTag(null)}
              className={`btn btn-sm ${!activeTag ? 'btn-primary' : 'btn-ghost'}`}>
              All ({tags.reduce((s,t) => s + t.count, 0)})
            </button>
            {tags.map(t => (
              <button key={t.tag} onClick={() => handleTag(t.tag)}
                className={`btn btn-sm ${activeTag === t.tag ? 'btn-primary' : 'btn-ghost'}`}
                style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Tag size={11} /> {t.tag}
                <span style={{ fontSize:11, opacity:0.7 }}>({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center', color:'var(--text-3)' }}>
            <Tag size={36} style={{ marginBottom:12, opacity:0.3 }} />
            <div style={{ fontSize:15, fontWeight:500 }}>No questions yet</div>
            <div style={{ fontSize:13, marginTop:6 }}>Add questions using the button above or import from Excel.</div>
          </div>
        ) : (
          Object.entries(grouped).map(([tag, qs]) => (
            <div key={tag} className="card" style={{ marginBottom:16, overflow:'hidden' }}>
              {/* Tag header with delete-tag button */}
              <div style={{ padding:'12px 20px', background:'var(--surface-2)',
                borderBottom:'1px solid var(--border)',
                display:'flex', alignItems:'center', gap:8 }}>
                <Tag size={13} color="var(--primary)" />
                <span style={{ fontWeight:700, fontSize:14, flex:1 }}>{tag}</span>
                <span style={{ fontSize:12, color:'var(--text-3)' }}>
                  {qs.length} question{qs.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => deleteByTag(tag)}
                  title={`Delete all "${tag}" questions`}
                  style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #FCA5A5',
                    background:'#FEF2F2', color:'#DC2626', cursor:'pointer',
                    fontSize:11, display:'flex', alignItems:'center', gap:4, marginLeft:8 }}>
                  <Trash2 size={10} /> Delete tag
                </button>
              </div>

              {/* Questions */}
              {qs.map((q, i) => (
                <div key={q.id} style={{
                  borderBottom: i < qs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'flex-start' }}>
                    <button onClick={() => toggle(q.id)}
                      style={{ flex:1, padding:'14px 20px', background:'none', border:'none',
                        cursor:'pointer', textAlign:'left', display:'flex',
                        alignItems:'flex-start', gap:12 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)',
                        minWidth:24, paddingTop:1 }}>Q{i+1}</span>
                      <span style={{ flex:1, fontSize:14, color:'var(--text)', lineHeight:1.5 }}>
                        {q.question}
                      </span>
                      {expanded[q.id]
                        ? <ChevronUp size={16} color="var(--text-3)" style={{ flexShrink:0 }} />
                        : <ChevronDown size={16} color="var(--text-3)" style={{ flexShrink:0 }} />}
                    </button>
                    {/* Delete individual question */}
                    <button onClick={() => deleteQuestion(q.id)}
                      title="Delete this question"
                      style={{ padding:'14px 12px', background:'none', border:'none',
                        cursor:'pointer', color:'#FCA5A5', flexShrink:0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {expanded[q.id] && (
                    <div style={{ padding:'0 20px 16px 56px' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)',
                        textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                        Expected Answer
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7,
                        padding:'12px 14px', background:'var(--surface-2)',
                        borderRadius:8, border:'1px solid var(--border)',
                        whiteSpace:'pre-wrap' }}>
                        {q.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
