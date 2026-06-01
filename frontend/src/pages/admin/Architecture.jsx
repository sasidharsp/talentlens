import { useState, useEffect } from 'react';
import { Pencil, X, Save, CheckCircle } from 'lucide-react';
import api from '../../api/client';

const DEFAULT_LAYERS = [
  { id:'fe', emoji:'⚛️', title:'Frontend — React 18 + Vite', subtitle:'Served by nginx on Railway · lpltalentlens.com', color:'#2563eb', bg:'#eff6ff', border:'#93c5fd', textColor:'#1d4ed8',
    desc:'Everything the user sees — candidate portal and admin portal — built as a React SPA. Vite bundles into static files that nginx serves.',
    items:[
      { name:'React Router', desc:'Handles all page navigation without page reloads' },
      { name:'AuthContext', desc:'Global auth state — JWT token, user role, login/logout' },
      { name:'api/client.js', desc:'Axios with base URL + auto auth header. All API calls go through here' },
      { name:'ProctoringWrapper', desc:'Wraps assessment pages — MediaPipe + COCO-SSD, webcam, violation logging' },
      { name:'AdminLayout', desc:'Sidebar + topbar for all admin pages. Role-based nav items' },
      { name:'renderMarkdown', desc:'Renders bullet points, bold, code in question text' },
    ]},
  { id:'api', emoji:'⚡', title:'Backend — Python FastAPI + Uvicorn', subtitle:'talentlens-production-6cef.up.railway.app', color:'#4338ca', bg:'#f5f3ff', border:'#c4b5fd', textColor:'#3730a3',
    desc:'The brain of the platform. Receives all API requests, validates auth tokens, applies business logic, queries the database, and returns JSON. Each feature has its own router file.',
    items:[
      { name:'main.py', desc:'Entry point — registers all routers, runs DB migrations on startup' },
      { name:'auth.py', desc:'JWT creation & validation. require_admin, require_any_staff guards' },
      { name:'routers/admin.py', desc:'All /api/admin/* endpoints — candidates, users, dashboard, proctoring' },
      { name:'routers/candidates.py', desc:'All /api/candidate/* — registration, segments, submission, proctor config' },
      { name:'routers/questions.py', desc:'Question bank CRUD for Seg 1, 2, 3 with import/export/template' },
      { name:'routers/inperson.py', desc:'In-person question bank — tags, CRUD, bulk import, template' },
      { name:'services/evaluator.py', desc:'Calls Claude API to evaluate MCQ and scenario responses' },
      { name:'models.py', desc:'SQLAlchemy ORM — all database tables defined here' },
    ]},
  { id:'db', emoji:'🗄️', title:'Database — PostgreSQL', subtitle:'Railway managed · 12 tables', color:'#d97706', bg:'#fffbeb', border:'#fcd34d', textColor:'#92400e',
    desc:'All persistent data — candidate sessions, questions, responses, proctoring events, and site content — stored here. Managed by Railway.',
    items:[
      { name:'users', desc:'Admin users — email, hashed_password, role, is_active, last_login' },
      { name:'candidate_sessions', desc:'One row per candidate — status, scores, decision, webcam photo' },
      { name:'questions_seg1/2/3', desc:'MCQ + scenario question banks per segment' },
      { name:'segment_responses', desc:'Candidate answers, scores, AI feedback per segment' },
      { name:'proctoring_events', desc:'Violation log — type, weight, timestamp, snapshot' },
      { name:'proctoring_config', desc:'Single-row global settings — enabled flag, thresholds' },
      { name:'inperson_questions', desc:'607-question in-person interview bank by tag' },
      { name:'site_content', desc:'Editable page content — About, Architecture page data' },
    ]},
  { id:'ext', emoji:'🤖', title:'External Services', subtitle:'Claude API + ML CDN models', color:'#7c3aed', bg:'#faf5ff', border:'#c4b5fd', textColor:'#5b21b6',
    desc:'AI evaluation and ML-powered proctoring rely on external services loaded on-demand.',
    items:[
      { name:'Anthropic Claude API', desc:'claude-sonnet-4-5 — evaluates candidate answers, generates scores and feedback' },
      { name:'MediaPipe FaceMesh CDN', desc:'@mediapipe/face_mesh@0.4 — face landmark detection for gaze tracking' },
      { name:'TensorFlow COCO-SSD CDN', desc:'Object detection — identifies mobile phones in webcam feed' },
      { name:'Railway', desc:'PaaS hosting all tiers. Auto-deploys from GitHub on push' },
    ]},
];

const DEFAULT_FLOW = [
  { color:'#3b82f6', title:'User Action in Browser', desc:'Admin or candidate triggers an action. React calls api.post() via the Axios client.', code:'src/api/client.js → Axios + JWT header' },
  { color:'#6366f1', title:'HTTPS to Railway Backend', desc:"Request hits the FastAPI server. Uvicorn's ASGI router matches URL path + HTTP method to the correct route handler.", code:'app/main.py → include_router() registers all routes' },
  { color:'#8b5cf6', title:'Authentication Guard', desc:"Before the route runs, FastAPI's dependency injection checks the JWT. Invalid → 401. Valid → current_user object injected.", code:'app/auth.py → require_any_staff / require_admin' },
  { color:'#10b981', title:'Route Handler Executes', desc:'The specific function in the router file runs — receives current_user, request body (Pydantic-validated), and a DB session.', code:'app/routers/admin.py → def list_candidates(db, current_user)' },
  { color:'#f59e0b', title:'Database Query via SQLAlchemy', desc:'Handler calls db.query(Model).filter().all(). SQLAlchemy converts to SQL and executes against PostgreSQL.', code:'app/models.py → ORM models map to DB tables' },
  { color:'#f43f5e', title:'AI Evaluation (if applicable)', desc:'For answer submissions, evaluator.py sends answer + context to Claude API. Score + feedback stored back to DB.', code:'app/services/evaluator.py → Anthropic API' },
  { color:'#0ea5e9', title:'JSON Response', desc:'FastAPI serialises Python dict/list to JSON with appropriate HTTP status code.', code:'FastAPI auto-serialisation → {data} or {detail: "error"}' },
  { color:'#312e81', title:'React State Update', desc:'Axios promise resolves. React setState triggers re-render. UI reflects new data. On error → shows error message.', code:'.then(r => setData(r.data)).catch(e => setError(…))' },
];

const DEFAULT = { layers: DEFAULT_LAYERS, flow: DEFAULT_FLOW };

export default function Architecture() {
  const [data,       setData]       = useState(null);
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState(null);
  const [openLayers, setOpenLayers] = useState({});
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [activeTab,  setActiveTab]  = useState('overview');

  useEffect(() => {
    api.get('/admin/site-content/architecture')
      .then(r => {
        const c = r.data.content;
        setData(c && c.layers ? c : DEFAULT);
      })
      .catch(() => setData(DEFAULT));
  }, []);

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(data))); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/site-content/architecture', { content: draft });
      setData(draft); setEditing(false); setDraft(null);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert('Save failed.'); } finally { setSaving(false); }
  };

  const toggleLayer = id => setOpenLayers(o => ({ ...o, [id]: !o[id] }));

  const setLayerField = (li, field, val) => setDraft(d => {
    const layers = [...d.layers];
    layers[li] = { ...layers[li], [field]: val };
    return { ...d, layers };
  });
  const setItemField = (li, ii, field, val) => setDraft(d => {
    const layers = [...d.layers];
    const items = [...layers[li].items];
    items[ii] = { ...items[ii], [field]: val };
    layers[li] = { ...layers[li], items };
    return { ...d, layers };
  });
  const setFlowField = (fi, field, val) => setDraft(d => {
    const flow = [...d.flow];
    flow[fi] = { ...flow[fi], [field]: val };
    return { ...d, flow };
  });

  if (!data) return <div style={{ padding:60, textAlign:'center' }}><div className="spinner"/></div>;
  const D = editing ? draft : data;

  const TABS = ['overview','flow','diagram'];

  return (
    <div>
      {/* Topbar */}
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22 }}>System Architecture</div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>How TalentLens is built and how requests flow through it</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {editing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}><X size={14}/> Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : <><Save size={14}/> Save Changes</>}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={startEdit}>
              {saved ? <><CheckCircle size={14}/> Saved</> : <><Pencil size={14}/> Edit Content</>}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ background:'#FEF3C7', borderBottom:'2px solid #FCD34D',
          padding:'10px 28px', fontSize:13, color:'#92400E' }}>
          ✏️ Edit mode active — editing layer descriptions and flow steps. SVG diagram is auto-generated.
        </div>
      )}

      {/* Tab nav */}
      <div style={{ background:'#fff', borderBottom:'1px solid var(--border)',
        padding:'0 28px', display:'flex', gap:0 }}>
        {[['overview','🏗️ Overview'],['flow','🔄 Request Flow'],['diagram','🗺️ Diagram']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ padding:'14px 20px', fontSize:13, fontWeight:500, background:'none',
              border:'none', borderBottom:`2px solid ${activeTab===id ? 'var(--primary)' : 'transparent'}`,
              color: activeTab===id ? 'var(--primary)' : 'var(--text-3)', cursor:'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="admin-content page-fade">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, marginBottom:6 }}>System Architecture</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:28 }}>Three-layer architecture deployed on Railway. Click any layer to expand.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {D.layers.map((layer, li) => (
                <div key={layer.id} style={{ borderRadius:12, overflow:'hidden',
                  border:`1px solid ${layer.border}`, background:layer.bg }}>
                  <div onClick={() => toggleLayer(layer.id)}
                    style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:layer.color,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {layer.emoji}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:layer.textColor }}>{layer.title}</div>
                      <div style={{ fontSize:12, color:layer.textColor, opacity:0.7 }}>{layer.subtitle}</div>
                    </div>
                    <span style={{ fontSize:12, transform: openLayers[layer.id] ? 'rotate(180deg)' : 'none',
                      transition:'transform 0.2s' }}>▼</span>
                  </div>
                  {openLayers[layer.id] && (
                    <div style={{ padding:'0 20px 20px' }}>
                      {editing ? (
                        <textarea className="input" rows={3} value={draft.layers[li].desc}
                          onChange={e => setLayerField(li, 'desc', e.target.value)}
                          style={{ marginBottom:12, resize:'vertical' }}/>
                      ) : (
                        <p style={{ fontSize:13, color:layer.textColor, marginBottom:12 }}>{layer.desc}</p>
                      )}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                        {layer.items.map((item, ii) => (
                          <div key={ii} style={{ background:'rgba(255,255,255,0.7)', borderRadius:8,
                            padding:'10px 12px', border:'1px solid rgba(0,0,0,0.06)' }}>
                            {editing ? (
                              <>
                                <input className="input" value={draft.layers[li].items[ii].name}
                                  onChange={e => setItemField(li, ii, 'name', e.target.value)}
                                  style={{ marginBottom:4, fontWeight:700, fontSize:12 }}/>
                                <textarea className="input" rows={2} value={draft.layers[li].items[ii].desc}
                                  onChange={e => setItemField(li, ii, 'desc', e.target.value)}
                                  style={{ resize:'none', fontSize:11 }}/>
                              </>
                            ) : (
                              <>
                                <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{item.name}</div>
                                <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.4 }}>{item.desc}</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FLOW TAB ── */}
        {activeTab === 'flow' && (
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, marginBottom:6 }}>How a Request Gets Routed</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:28 }}>Every API call — from browser click to database and back</div>
            <div style={{ display:'flex', flexDirection:'column', gap:0, maxWidth:700 }}>
              {D.flow.map((step, fi) => (
                <div key={fi} style={{ display:'flex', alignItems:'stretch', gap:0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:48, flexShrink:0 }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', background:step.color,
                      flexShrink:0, marginTop:20, boxShadow:`0 0 0 4px white` }}/>
                    {fi < D.flow.length-1 && <div style={{ width:2, flex:1, minHeight:20,
                      background:'linear-gradient(to bottom,#a5b4fc,#e0e7ff)' }}/>}
                  </div>
                  <div style={{ flex:1, margin:'8px 0', padding:'18px 20px', background:'#fff',
                    borderRadius:12, border:'1px solid var(--border)',
                    boxShadow:'0 2px 8px rgba(99,102,241,0.06)' }}>
                    <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:22, height:22, borderRadius:6, background:'#EEF2FF',
                      color:'var(--primary)', fontSize:11, fontWeight:700, marginBottom:8 }}>
                      {fi+1}
                    </div>
                    {editing ? (
                      <>
                        <input className="input" value={draft.flow[fi].title}
                          onChange={e => setFlowField(fi, 'title', e.target.value)}
                          style={{ fontWeight:700, fontSize:15, marginBottom:6 }}/>
                        <textarea className="input" rows={2} value={draft.flow[fi].desc}
                          onChange={e => setFlowField(fi, 'desc', e.target.value)}
                          style={{ resize:'vertical', marginBottom:6, fontSize:13 }}/>
                        <input className="input" value={draft.flow[fi].code}
                          onChange={e => setFlowField(fi, 'code', e.target.value)}
                          style={{ fontFamily:'monospace', fontSize:11 }}/>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{step.title}</div>
                        <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, marginBottom:6 }}>{step.desc}</div>
                        <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--primary)',
                          background:'#EEF2FF', borderRadius:4, padding:'2px 7px' }}>{step.code}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DIAGRAM TAB ── */}
        {activeTab === 'diagram' && (
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, marginBottom:6 }}>Architecture Diagram</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:20 }}>Auto-generated from architecture data. Edit content in Overview or Flow tabs.</div>
            <div style={{ overflowX:'auto' }}>
              <svg viewBox="0 0 1100 750" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', minWidth:900, fontFamily:'inherit' }}>
                <defs>
                  <marker id="a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/></marker>
                  <marker id="a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/></marker>
                  <marker id="a3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#8b5cf6"/></marker>
                  <marker id="a4" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#10b981"/></marker>
                  <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.10)"/></filter>
                </defs>

                <rect x="10" y="10" width="1080" height="730" rx="16" fill="#f8f7ff" stroke="#e0e7ff" strokeWidth="1.5"/>

                {/* Lane labels */}
                {[['BROWSER / CLIENT',10,30],['REACT (nginx)',270,30],['FASTAPI BACKEND',440,30],['POSTGRESQL',610,30],['EXTERNAL',695,30]].map(([label,y,offset])=>(
                  <text key={label} x="30" y={y+offset} fontSize="10" fontWeight="700" fill="#94a3b8" letterSpacing="0.08em">{label}</text>
                ))}

                {/* Lane dividers */}
                {[62,275,455,625,710].map(y=>(
                  <line key={y} x1="20" y1={y} x2="1090" y2={y} stroke="#e0e7ff" strokeWidth="1" strokeDasharray="4,4"/>
                ))}

                {/* Candidate box */}
                <rect x="30" y="68" width="185" height="190" rx="12" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.5" filter="url(#sh)"/>
                <rect x="30" y="68" width="185" height="30" rx="12" fill="#2563eb"/>
                <rect x="30" y="86" width="185" height="12" fill="#2563eb"/>
                <text x="122" y="88" fontSize="11" fontWeight="700" fill="white" textAnchor="middle">👤 Candidate</text>
                {['Landing / Register','Instructions','Assessment (3 segs)','Round 2','ProctoringWrapper'].map((t,i)=>(
                  <text key={t} x="48" y={112+i*20} fontSize="10" fill="#3730a3">{t}</text>
                ))}

                {/* Admin box */}
                <rect x="225" y="68" width="200" height="190" rx="12" fill="#f5f3ff" stroke="#c4b5fd" strokeWidth="1.5" filter="url(#sh)"/>
                <rect x="225" y="68" width="200" height="30" rx="12" fill="#4338ca"/>
                <rect x="225" y="86" width="200" height="12" fill="#4338ca"/>
                <text x="325" y="88" fontSize="11" fontWeight="700" fill="white" textAnchor="middle">🛡️ Admin Portal</text>
                {['Home · About · Dashboard','Candidates · Live Monitor','Question Bank · Inperson','Proctoring · User Mgmt','Architecture (this page)'].map((t,i)=>(
                  <text key={t} x="242" y={112+i*20} fontSize="10" fill="#3730a3">{t}</text>
                ))}

                {/* React / nginx */}
                <rect x="30" y="280" width="395" height="165" rx="12" fill="white" stroke="#93c5fd" strokeWidth="1.5" filter="url(#sh)"/>
                <rect x="30" y="280" width="395" height="26" rx="12" fill="#2563eb"/>
                <rect x="30" y="294" width="395" height="12" fill="#2563eb"/>
                <text x="228" y="298" fontSize="11" fontWeight="700" fill="white" textAnchor="middle">⚛️ React 18 + Vite → nginx on Railway</text>
                {['Static HTML/JS bundle served by nginx · SPA with React Router',
                  'api/client.js: Axios + baseURL + auto JWT Authorization header',
                  'AuthContext: global role/token state · AdminLayout: nav sidebar',
                  'ProctoringWrapper: webcam + MediaPipe + COCO-SSD',
                  'env: VITE_API_URL → Railway backend URL'
                ].map((t,i)=>(
                  <text key={i} x="48" y={320+i*18} fontSize="10" fill="#374151">{t}</text>
                ))}
                <text x="48" y="432" fontSize="10" fill="#6366f1" fontWeight="600">lpltalentlens.com</text>

                {/* FastAPI */}
                <rect x="30" y="462" width="1050" height="140" rx="12" fill="#312e81" stroke="#4338ca" strokeWidth="2" filter="url(#sh)"/>
                <text x="555" y="485" fontSize="12" fontWeight="700" fill="white" textAnchor="middle">⚡ FastAPI + Uvicorn — talentlens-production-6cef.up.railway.app</text>

                {[
                  {x:48,  label:'main.py', items:['Entry point','Routers','Migrations','Seed data']},
                  {x:190, label:'routers/', items:['admin.py /api/admin','candidates.py','questions.py','inperson.py']},
                  {x:420, label:'auth.py',  items:['JWT encode/decode','require_admin','require_any_staff','Role checks']},
                  {x:620, label:'services/', items:['evaluator.py','Claude API calls','question_selector','Score + feedback']},
                  {x:820, label:'models.py',items:['SQLAlchemy ORM','12 DB tables','db.query()','db.commit()']},
                ].map(({x,label,items})=>(
                  <g key={label}>
                    <rect x={x} y="494" width="155" height="98" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
                    <text x={x+78} y="510" fontSize="10" fontWeight="700" fill="#a5b4fc" textAnchor="middle">{label}</text>
                    {items.map((t,i)=><text key={i} x={x+10} y={526+i*16} fontSize="9" fill="rgba(255,255,255,0.75)">{t}</text>)}
                  </g>
                ))}

                {/* PostgreSQL */}
                <rect x="30" y="616" width="1050" height="75" rx="12" fill="#fffbeb" stroke="#fcd34d" strokeWidth="1.5" filter="url(#sh)"/>
                <text x="555" y="636" fontSize="11" fontWeight="700" fill="#92400e" textAnchor="middle">🗄️ PostgreSQL — Railway Managed</text>
                {['users','candidate_sessions','questions_seg1/2/3','segment_responses','proctoring_events','proctoring_config','inperson_questions','site_content'].map((t,i)=>(
                  <g key={t}>
                    <rect x={48+i*126} y="643" width="118" height="36" rx="6" fill="white" stroke="#fcd34d" strokeWidth="1"/>
                    <text x={107+i*126} y="662" fontSize="9" fontWeight="600" fill="#92400e" textAnchor="middle">{t}</text>
                  </g>
                ))}

                {/* External */}
                <rect x="30" y="707" width="340" height="28" rx="8" fill="#faf5ff" stroke="#c4b5fd" strokeWidth="1"/>
                <text x="200" y="725" fontSize="10" fontWeight="700" fill="#5b21b6" textAnchor="middle">🤖 Anthropic Claude API (claude-sonnet-4-5)</text>
                <rect x="385" y="707" width="260" height="28" rx="8" fill="#f0fdf4" stroke="#6ee7b7" strokeWidth="1"/>
                <text x="515" y="725" fontSize="10" fontWeight="700" fill="#065f46" textAnchor="middle">🧠 MediaPipe + TF COCO-SSD CDN</text>
                <rect x="660" y="707" width="200" height="28" rx="8" fill="#fff7ed" stroke="#fdba74" strokeWidth="1"/>
                <text x="760" y="725" fontSize="10" fontWeight="700" fill="#9a3412" textAnchor="middle">🚀 Railway Platform</text>

                {/* Arrows */}
                <line x1="122" y1="258" x2="122" y2="280" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#a1)"/>
                <line x1="325" y1="258" x2="325" y2="280" stroke="#6366f1" strokeWidth="2" markerEnd="url(#a1)"/>
                <line x1="228" y1="445" x2="228" y2="462" stroke="#6366f1" strokeWidth="2.5" markerEnd="url(#a1)"/>
                <text x="233" y="457" fontSize="9" fill="#6366f1" fontWeight="600">REST API</text>
                <line x1="555" y1="602" x2="555" y2="616" stroke="#f59e0b" strokeWidth="2.5" markerEnd="url(#a2)"/>
                <text x="560" y="612" fontSize="9" fill="#f59e0b" fontWeight="600">SQLAlchemy ORM</text>
                <line x1="700" y1="602" x2="200" y2="707" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#a3)"/>

                {/* Legend */}
                <rect x="880" y="275" width="200" height="110" rx="8" fill="white" stroke="#e0e7ff" strokeWidth="1"/>
                <text x="980" y="294" fontSize="10" fontWeight="700" fill="#312e81" textAnchor="middle">Legend</text>
                <line x1="896" y1="310" x2="930" y2="310" stroke="#6366f1" strokeWidth="2" markerEnd="url(#a1)"/>
                <text x="936" y="314" fontSize="9" fill="#374151">HTTPS / API</text>
                <line x1="896" y1="328" x2="930" y2="328" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#a2)"/>
                <text x="936" y="332" fontSize="9" fill="#374151">Database (ORM)</text>
                <line x1="896" y1="346" x2="930" y2="346" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#a3)"/>
                <text x="936" y="350" fontSize="9" fill="#374151">External API</text>
                <rect x="896" y="358" width="12" height="12" rx="3" fill="#dbeafe" stroke="#93c5fd"/>
                <text x="914" y="369" fontSize="9" fill="#374151">Frontend layer</text>
                <rect x="950" y="358" width="12" height="12" rx="3" fill="#312e81"/>
                <text x="968" y="369" fontSize="9" fill="#374151">Backend layer</text>
              </svg>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
