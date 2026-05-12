import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Plus, Upload, Download, Trash2, BookOpen } from 'lucide-react';

const SEG_CONFIG = {
  1: { label: 'Segment 1 — Knowledge MCQ', color: '#4F46E5', fields: ['question_text','option_a','option_b','option_c','option_d','correct_answer','difficulty','category'] },
  2: { label: 'Segment 2 — Role Competency MCQ', color: '#7C3AED', fields: ['question_text','option_a','option_b','option_c','option_d','correct_answer','difficulty','category','role_tags','skill_tags'] },
  3: { label: 'Segment 3 — Scenario Response', color: '#D97706', fields: ['scenario_text','reference_answer','difficulty','role_tags'] },
};

const emptyForm = (seg) => seg < 3
  ? { question_text:'', option_a:'', option_b:'', option_c:'', option_d:'', correct_answer:'A', difficulty:'medium', category:'', role_tags:'', skill_tags:'' }
  : { scenario_text:'', reference_answer:'', difficulty:'medium', role_tags:'' };

export default function QuestionBank() {
  const [seg, setSeg] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm(1));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const load = async (s = seg, p = page) => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/questions/seg${s}?page=${p}&page_size=20`);
      setQuestions(r.data.items || []); setTotal(r.data.total || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(seg, 1); setPage(1); setShowAdd(false); setForm(emptyForm(seg)); }, [seg]);
  useEffect(() => { load(seg, page); }, [page]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.role_tags) payload.role_tags = form.role_tags.split(',').map(s=>s.trim()).filter(Boolean);
      if (form.skill_tags) payload.skill_tags = form.skill_tags.split(',').map(s=>s.trim()).filter(Boolean);
      await api.post(`/admin/questions/seg${seg}`, payload);
      setShowAdd(false); setForm(emptyForm(seg)); load(seg, page);
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Soft-delete this question?')) return;
    await api.delete(`/admin/questions/seg${seg}/${id}`);
    load(seg, page);
  };

  const doImport = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await api.post(`/admin/questions/seg${seg}/import`, fd, { headers: {'Content-Type':'multipart/form-data'} });
      alert(`Imported ${r.data.imported} questions.`); load(seg, page);
    } catch (ex) { alert(ex.response?.data?.detail || 'Import failed.'); }
    e.target.value = '';
  };

  const cfg = SEG_CONFIG[seg];
  const isSeg3 = seg === 3;

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>Question Bank</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{total} questions in current segment</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display:'none' }} onChange={doImport} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}><Upload size={14}/> Import Excel</button>
          <a className="btn btn-secondary btn-sm" href={`/api/admin/questions/seg${seg}/export`} download><Download size={14}/> Export</a>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}><Plus size={14}/> Add Question</button>
        </div>
      </div>

      <div className="admin-content page-fade">
        {/* Segment tabs */}
        <div style={{ display:'flex', gap:4, marginBottom: 20, borderBottom:'1px solid var(--border)', paddingBottom: 0 }}>
          {[1,2,3].map(s => (
            <button key={s} onClick={() => setSeg(s)} style={{
              padding:'9px 20px', border:'none', cursor:'pointer', background:'none', fontSize:14, fontWeight:500,
              color: seg===s ? 'var(--primary)' : 'var(--text-2)',
              borderBottom: seg===s ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, transition:'all 0.15s',
            }}>
              {SEG_CONFIG[s].label.split('—')[0].trim()}
            </button>
          ))}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card" style={{ marginBottom: 20, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text)', display:'flex',alignItems:'center',gap:8 }}>
              <BookOpen size={15} color={cfg.color}/> New Question — {cfg.label}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              {isSeg3 ? (
                <>
                  <div style={{ gridColumn:'1/-1' }}><label className="label">Scenario Text *</label><textarea className="input" rows={4} value={form.scenario_text} onChange={e=>setForm(f=>({...f,scenario_text:e.target.value}))}/></div>
                  <div style={{ gridColumn:'1/-1' }}><label className="label">Reference Answer *</label><textarea className="input" rows={4} value={form.reference_answer} onChange={e=>setForm(f=>({...f,reference_answer:e.target.value}))}/></div>
                </>
              ) : (
                <>
                  <div style={{ gridColumn:'1/-1' }}><label className="label">Question Text *</label><textarea className="input" rows={3} value={form.question_text} onChange={e=>setForm(f=>({...f,question_text:e.target.value}))}/></div>
                  {['a','b','c','d'].map(l => (
                    <div key={l}><label className="label">Option {l.toUpperCase()} *</label><input className="input" value={form[`option_${l}`]} onChange={e=>setForm(f=>({...f,[`option_${l}`]:e.target.value}))}/></div>
                  ))}
                  <div><label className="label">Correct Answer</label>
                    <select className="input" value={form.correct_answer} onChange={e=>setForm(f=>({...f,correct_answer:e.target.value}))}>
                      {['A','B','C','D'].map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  {seg===2 && <div><label className="label">Role Tags (comma-sep)</label><input className="input" value={form.role_tags} onChange={e=>setForm(f=>({...f,role_tags:e.target.value}))} placeholder="Java Developer, QA"/></div>}
                  {seg===2 && <div><label className="label">Skill Tags</label><input className="input" value={form.skill_tags} onChange={e=>setForm(f=>({...f,skill_tags:e.target.value}))}/></div>}
                  <div><label className="label">Category</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></div>
                </>
              )}
              <div><label className="label">Difficulty</label>
                <select className="input" value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              {isSeg3 && <div><label className="label">Role Tags (comma-sep)</label><input className="input" value={form.role_tags} onChange={e=>setForm(f=>({...f,role_tags:e.target.value}))}/></div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="card">
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>#</th>
                <th>{isSeg3 ? 'Scenario' : 'Question'}</th>
                <th>Difficulty</th>
                <th>{isSeg3 ? 'Role Tags' : 'Category'}</th>
                {!isSeg3 && <th>Answer</th>}
                <th>Used</th>
                <th></th>
              </tr></thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.id}>
                    <td style={{ color:'var(--text-3)', fontSize:12 }}>{(page-1)*20+i+1}</td>
                    <td style={{ maxWidth:380, color:'var(--text)', fontSize:13 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                        {isSeg3 ? q.scenario_text : q.question_text}
                      </div>
                    </td>
                    <td><span className={`badge ${q.difficulty==='high'?'badge-red':q.difficulty==='medium'?'badge-amber':'badge-green'}`}>{q.difficulty}</span></td>
                    <td style={{ fontSize:12, color:'var(--text-2)' }}>
                      {isSeg3 ? (q.role_tags||[]).join(', ')||'—' : q.category||'—'}
                    </td>
                    {!isSeg3 && <td style={{ fontWeight:700, color:'var(--primary)' }}>{q.correct_answer}</td>}
                    <td style={{ color:'var(--text-3)', fontSize:12 }}>{q.usage_count||0}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => del(q.id)}><Trash2 size={13}/></button>
                    </td>
                  </tr>
                ))}
                {questions.length===0 && <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No questions yet. Add or import above.</td></tr>}
              </tbody>
            </table>
          )}
          {total > 20 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>Page {page} · {total} total</span>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>p-1)} disabled={page===1}>Prev</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>p+1)} disabled={page*20>=total}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
