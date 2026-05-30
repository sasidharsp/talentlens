import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { downloadFile } from '../../api/download';
import {
  Plus, ToggleLeft, ToggleRight, Briefcase,
  MapPin, Building2, Users, AlertCircle,
  Upload, Download, Search, Trash2, FileSpreadsheet
} from 'lucide-react';

export default function Requisitions() {
  const [reqs, setReqs]         = useState([]);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm]  = useState(false);
  const [form, setForm]          = useState({ req_id:'', title:'', department:'', location:'', description:'' });
  const [saving, setSaving]      = useState(false);
  const [err, setErr]            = useState('');
  const [importResult, setImportResult] = useState(null);
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = storedUser?.role === 'super_admin';
  const isAdmin = ['admin','super_admin'].includes(storedUser?.role);
  const fileRef = useRef();

  const load = () => api.get('/admin/requisitions').then(r => setReqs(r.data));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.req_id.trim() || !form.title.trim()) { setErr('Req ID and Title are required.'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/admin/requisitions', form);
      setForm({ req_id:'', title:'', department:'', location:'', description:'' });
      setShowForm(false); load();
    } catch (e) { setErr(e.response?.data?.detail || 'Failed to create requisition.'); }
    finally { setSaving(false); }
  };

  const toggle = async (r) => {
    await api.patch(`/admin/requisitions/${r.id}`, { is_active: !r.is_active });
    load();
  };

  const hardDelete = async (r) => {
    if (!window.confirm(`Permanently delete ${r.req_id}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/requisitions/${r.id}/delete`);
      load();
    } catch (e) { alert(e.response?.data?.detail || 'Delete failed.'); }
  };

  const doImport = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setImportResult(null);
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await api.post('/admin/requisitions/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(r.data); load();
    } catch (ex) {
      setImportResult({ message: ex.response?.data?.detail || 'Import failed.', created: 0, errors: [] });
    }
    e.target.value = '';
  };

  const filtered = reqs.filter(r =>
    !search || r.req_id.toLowerCase().includes(search.toLowerCase()) ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.department || '').toLowerCase().includes(search.toLowerCase())
  );
  const active   = filtered.filter(r => r.is_active);
  const inactive = filtered.filter(r => !r.is_active);

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }} onChange={doImport} />

      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400 }}>Requisitions</div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:1 }}>
            {active.length} active · {inactive.length} inactive
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm"
            onClick={() => downloadFile('/api/admin/requisitions/template', 'TalentLens_Requisitions_Template.csv')}>
            <FileSpreadsheet size={14} /> Template
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
            <Upload size={14} /> Import CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(s=>!s); setErr(''); }}>
            <Plus size={14} /> New Requisition
          </button>
        </div>
      </div>

      <div className="admin-content page-fade">
        {/* Info banner */}
        <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary-border)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--primary)' }}>
          <Briefcase size={15} />
          <span>Requisitions appear in the candidate registration dropdown under <strong>"Applying For"</strong>. Import via CSV or create individually.</span>
        </div>

        {/* Import result */}
        {importResult && (
          <div style={{ background: importResult.errors?.length ? 'var(--warning-light)' : 'var(--success-light)', border:`1px solid ${importResult.errors?.length ? 'var(--warning-border)' : 'var(--success-border)'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color: importResult.errors?.length ? 'var(--warning)' : 'var(--success)' }}>
            <div style={{ fontWeight:600, marginBottom: importResult.errors?.length ? 8 : 0 }}>{importResult.message}</div>
            {importResult.errors?.map((e, i) => <div key={i} style={{ fontSize:12 }}>Row {e.row}: {e.error}</div>)}
          </div>
        )}

        {/* Search */}
        <div className="search-wrap" style={{ marginBottom:16, maxWidth:360 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search by Req ID, title, department…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:36 }} />
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card" style={{ marginBottom:20, padding:24 }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <Briefcase size={15} color="var(--primary)" /> Create New Requisition
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div>
                <label className="label">Req ID <span style={{color:'var(--danger)'}}>*</span> <span style={{fontSize:11,color:'var(--text-3)',fontWeight:400}}>e.g. REQ-2024-001</span></label>
                <input className="input" placeholder="REQ-2024-001" value={form.req_id} onChange={e=>set('req_id',e.target.value.toUpperCase())} style={{fontFamily:'monospace',fontWeight:600}} />
              </div>
              <div><label className="label">Designation <span style={{color:'var(--danger)'}}>*</span></label><input className="input" placeholder="e.g. Senior Java Developer" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
              <div><label className="label">Department</label><input className="input" placeholder="e.g. Engineering" value={form.department} onChange={e=>set('department',e.target.value)} /></div>
              <div><label className="label">Location</label><input className="input" placeholder="e.g. Bangalore" value={form.location} onChange={e=>set('location',e.target.value)} /></div>
              <div style={{gridColumn:'1/-1'}}><label className="label">Brief Description</label><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
            </div>
            {err && <div style={{fontSize:13,color:'var(--danger)',marginBottom:10,display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={13}/>{err}</div>}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>{saving?'Creating…':'Create Requisition'}</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setShowForm(false);setErr('');}}>Cancel</button>
            </div>
          </div>
        )}

        {/* Active table */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <span className="card-title">Active Requisitions</span>
            <span className="badge badge-green">{active.length} open</span>
          </div>
          {active.length === 0 ? (
            <div style={{padding:'40px 24px',textAlign:'center',color:'var(--text-3)',fontSize:14}}>No active requisitions.</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Req ID</th><th>Designation</th><th>Department</th><th>Location</th><th>Candidates</th><th></th></tr></thead>
              <tbody>
                {active.map(r => (
                  <tr key={r.id}>
                    <td><span style={{fontFamily:'monospace',fontWeight:700,fontSize:13,color:'var(--primary)',background:'var(--primary-light)',padding:'2px 8px',borderRadius:5,border:'1px solid var(--primary-border)'}}>{r.req_id}</span></td>
                    <td style={{fontWeight:500}}>{r.title}</td>
                    <td style={{color:'var(--text-2)',fontSize:13}}>{r.department ? <span style={{display:'flex',alignItems:'center',gap:4}}><Building2 size={12}/>{r.department}</span> : '—'}</td>
                    <td style={{color:'var(--text-2)',fontSize:13}}>{r.location ? <span style={{display:'flex',alignItems:'center',gap:4}}><MapPin size={12}/>{r.location}</span> : '—'}</td>
                    <td><span style={{fontSize:13,fontWeight:600,color:r.candidate_count>0?'var(--primary)':'var(--text-3)',display:'flex',alignItems:'center',gap:4}}><Users size={13}/>{r.candidate_count}</span></td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm" style={{background:'var(--danger-light)',color:'var(--danger)',border:'1px solid var(--danger-border)'}} onClick={()=>toggle(r)}>
                          <ToggleRight size={14}/> Deactivate
                        </button>
                        {(isSuperAdmin || isAdmin) && (
                          <button className="btn btn-danger btn-sm" onClick={()=>hardDelete(r)} title="Permanently delete">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inactive table */}
        {inactive.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{color:'var(--text-2)'}}>Closed / Inactive</span>
              <span className="badge badge-gray">{inactive.length}</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Req ID</th><th>Designation</th><th>Department</th><th>Candidates</th><th></th></tr></thead>
              <tbody>
                {inactive.map(r => (
                  <tr key={r.id} style={{opacity:0.65}}>
                    <td><span style={{fontFamily:'monospace',fontWeight:700,fontSize:13,color:'var(--text-3)',background:'var(--surface-2)',padding:'2px 8px',borderRadius:5}}>{r.req_id}</span></td>
                    <td style={{color:'var(--text-2)'}}>{r.title}</td>
                    <td style={{fontSize:13,color:'var(--text-3)'}}>{r.department||'—'}</td>
                    <td style={{fontSize:13,fontWeight:600,color:'var(--text-3)'}}>{r.candidate_count}</td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-success btn-sm" onClick={()=>toggle(r)}><ToggleLeft size={14}/> Reactivate</button>
                        {(isSuperAdmin || isAdmin) && (
                          <button className="btn btn-danger btn-sm" onClick={()=>hardDelete(r)}><Trash2 size={13}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
