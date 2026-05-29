import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Upload, Plus, Trash2, Tag, FileSpreadsheet, Download, Award, Search } from 'lucide-react';
import { downloadFile } from '../../api/download';
import { renderMarkdown } from '../../utils/renderMarkdown';

export default function Round2Questions() {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [allTags, setAllTags] = useState([]);
  const [activeTag, setActiveTag] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ scenario_text:'', reference_answer:'', difficulty:'high', batch_tag:'', category:'' });
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importTag, setImportTag] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const load = (p=page, tag=activeTag, q=search) => {
    const params = new URLSearchParams({ page:p, page_size:20 });
    if (tag) params.set('batch_tag', tag);
    if (q) params.set('search', q);
    api.get(`/admin/round2/questions?${params}`).then(r => { setQuestions(r.data.items||[]); setTotal(r.data.total||0); });
  };
  const loadTags = () => api.get('/admin/round2/questions/batch-tags').then(r => setAllTags(r.data||[])).catch(()=>{});

  useEffect(() => { load(1); loadTags(); }, []);

  const filterByTag = tag => { const t=tag===activeTag?'':tag; setActiveTag(t); setPage(1); load(1,t,search); };
  const doSearch = q => { setSearch(q); setPage(1); load(1,activeTag,q); };

  const save = async () => {
    if (!form.scenario_text.trim()) return;
    setSaving(true);
    try { await api.post('/admin/round2/questions', form); setShowAdd(false); setForm({scenario_text:'',reference_answer:'',difficulty:'high',batch_tag:'',category:''}); load(1); loadTags(); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/admin/round2/questions/${id}`); load(page);
  };

  const doImport = async () => {
    if (!importFile || !importTag.trim()) return;
    setImporting(true);
    const fd = new FormData(); fd.append('file', importFile); fd.append('batch_tag', importTag);
    try {
      const r = await api.post('/admin/round2/questions/import', fd, { headers:{'Content-Type':'multipart/form-data'} });
      setResult(r.data); setShowImportModal(false); setImportFile(null); setImportTag('');
      load(1); loadTags();
    } catch(e) { setResult({ message: e.response?.data?.detail||'Import failed.', created:0, errors:[] }); setShowImportModal(false); }
    finally { setImporting(false); fileRef.current.value=''; }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
        onChange={e => { if(e.target.files[0]){ setImportFile(e.target.files[0]); setShowImportModal(true); }}} />

      {/* Import modal */}
      {showImportModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'var(--surface)',borderRadius:14,padding:32,width:440,boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <Tag size={18} color="#7C3AED"/> Import R2 Questions
            </div>
            <label className="label">Batch Tag <span style={{color:'var(--danger)'}}>*</span></label>
            <input className="input" placeholder="e.g. Middleware-R2-Jun2025"
              value={importTag} onChange={e=>setImportTag(e.target.value)} style={{marginBottom:12,fontFamily:'monospace',fontWeight:600}} autoFocus/>
            {allTags.length>0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Existing tags:</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {allTags.map(t=>(
                    <button key={t} type="button" onClick={()=>setImportTag(t)}
                      style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:importTag===t?'#7C3AED':'var(--primary-light)',color:importTag===t?'#fff':'var(--primary)',border:'1px solid var(--primary-border)',cursor:'pointer',fontFamily:'monospace'}}>
                      {t}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" onClick={doImport} disabled={importing||!importTag.trim()} style={{background:'#7C3AED',borderColor:'#7C3AED'}}>
                {importing?'Importing…':<><Upload size={14}/> Import</>}
              </button>
              <button className="btn btn-ghost" onClick={()=>{setShowImportModal(false);setImportFile(null);fileRef.current.value='';}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-topbar">
        <div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,fontWeight:400,display:'flex',alignItems:'center',gap:8}}>
            <Award size={20} color="#7C3AED"/> Round 2 Question Bank
          </div>
          <div style={{fontSize:13,color:'var(--text-2)'}}>{total} active questions</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>downloadFile('/api/admin/round2/questions/template','TalentLens_Round2_Template.csv')}>
            <FileSpreadsheet size={14}/> Template
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current.click()}>
            <Upload size={14}/> Import
          </button>
          <button className="btn btn-sm" style={{background:'#7C3AED',color:'#fff',border:'none'}} onClick={()=>setShowAdd(s=>!s)}>
            <Plus size={14}/> Add Question
          </button>
        </div>
      </div>

      <div className="admin-content page-fade">
        {result && (
          <div style={{background:result.errors?.length?'var(--warning-light)':'var(--success-light)',border:`1px solid ${result.errors?.length?'var(--warning-border)':'var(--success-border)'}`,borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:result.errors?.length?'var(--warning)':'var(--success)'}}>
            {result.message}
            {result.errors?.map((e,i)=><div key={i} style={{fontSize:12}}>Row {e.row}: {e.error}</div>)}
          </div>
        )}

        {/* Batch tag filter */}
        {allTags.length>0 && (
          <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}><Tag size={12}/> Batches</div>
            <button onClick={()=>filterByTag('')} style={{fontSize:12,padding:'4px 12px',borderRadius:99,cursor:'pointer',background:!activeTag?'#7C3AED':'var(--surface-2)',color:!activeTag?'#fff':'var(--text-2)',border:`1px solid ${!activeTag?'#7C3AED':'var(--border)'}`,fontWeight:!activeTag?700:400}}>All</button>
            {allTags.map(tag=>(
              <button key={tag} onClick={()=>filterByTag(tag)} style={{fontSize:12,padding:'4px 12px',borderRadius:99,cursor:'pointer',fontFamily:'monospace',background:activeTag===tag?'#7C3AED':'var(--surface-2)',color:activeTag===tag?'#fff':'#7C3AED',border:`1px solid ${activeTag===tag?'#7C3AED':'#DDD6FE'}`,fontWeight:activeTag===tag?700:400}}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="search-wrap" style={{marginBottom:16,maxWidth:380}}>
          <Search size={14} className="search-icon"/>
          <input className="input" placeholder="Search scenarios…" value={search} onChange={e=>doSearch(e.target.value)} style={{paddingLeft:36}}/>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card" style={{marginBottom:20,padding:24}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <Award size={15} color="#7C3AED"/> New Round 2 Question
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <label className="label">Scenario / Question <span style={{color:'var(--danger)'}}>*</span></label>
                <textarea className="input" rows={4} value={form.scenario_text} onChange={e=>setForm(f=>({...f,scenario_text:e.target.value}))} placeholder="Describe the scenario the candidate should respond to…"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label className="label">Reference Answer / Rubric <span style={{color:'var(--danger)'}}>*</span></label>
                <textarea className="input" rows={4} value={form.reference_answer} onChange={e=>setForm(f=>({...f,reference_answer:e.target.value}))} placeholder="Ideal answer or key points for evaluation…"/>
              </div>
              <div>
                <label className="label">Difficulty</label>
                <select className="input" value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="label">Batch Tag</label>
                <input className="input" value={form.batch_tag} onChange={e=>setForm(f=>({...f,batch_tag:e.target.value}))} list="r2-tags" style={{fontFamily:'monospace'}}/>
                <datalist id="r2-tags">{allTags.map(t=><option key={t} value={t}/>)}</datalist>
              </div>
              <div><label className="label">Category</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Incident Management"/></div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-sm" style={{background:'#7C3AED',color:'#fff',border:'none'}} onClick={save} disabled={saving}>{saving?'Saving…':'Save Question'}</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Questions table */}
        <div className="card">
          <div className="card-header"><span className="card-title">Questions</span><span className="badge badge-violet">{total}</span></div>
          {questions.length===0 ? (
            <div style={{padding:'40px 24px',textAlign:'center',color:'var(--text-3)',fontSize:14}}>
              No questions yet. Import from Excel or add individually above.
            </div>
          ) : (
            <table className="tbl">
              <thead><tr><th>#</th><th>Scenario</th><th>Difficulty</th><th>Batch</th><th>Category</th><th></th></tr></thead>
              <tbody>
                {questions.map((q,i)=>(
                  <tr key={q.id}>
                    <td style={{color:'var(--text-3)',fontSize:12}}>{(page-1)*20+i+1}</td>
                    <td style={{maxWidth:420}}>
                      <div style={{fontSize:13,color:'var(--text)',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                        {q.scenario_text}
                      </div>
                    </td>
                    <td><span className={`badge ${q.difficulty==='high'?'badge-red':'badge-amber'}`}>{q.difficulty}</span></td>
                    <td>{q.batch_tag?<span style={{fontSize:11,fontFamily:'monospace',padding:'2px 8px',borderRadius:99,background:'#F5F3FF',color:'#7C3AED',border:'1px solid #DDD6FE'}}>{q.batch_tag}</span>:'—'}</td>
                    <td style={{fontSize:12,color:'var(--text-2)'}}>{q.category||'—'}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={()=>del(q.id)}><Trash2 size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
