import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Search, Filter, ChevronLeft, ChevronRight, Loader, Trash2, Upload } from 'lucide-react';

const statusBadge = (s) => {
  const m = { REGISTERED:'badge-gray', IN_PROGRESS:'badge-amber', SUBMITTED:'badge-sky', EVALUATED:'badge-indigo', selected:'badge-green', rejected:'badge-red', pending:'badge-amber', on_hold:'badge-amber' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s?.replace('_',' ')}</span>;
};
const scoreColor = (v) => !v ? 'var(--text-3)' : v>=70 ? 'var(--success)' : v>=50 ? 'var(--warning)' : 'var(--danger)';

const STATUSES = ['', 'REGISTERED', 'IN_PROGRESS', 'SUBMITTED', 'EVALUATED'];

export default function CandidateList() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], total: 0, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: 20 });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const r = await api.get(`/admin/candidates?${params}`);
      setData(r.data);
    } finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleStatus = (v) => { setStatus(v); setPage(1); };

  const deleteCandidate = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this candidate and all their data?')) return;
    await api.delete(`/admin/candidates/${sessionId}`);
    load();
  };

  const doBulkImport = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await api.post('/candidate/bulk-import', fd, { headers: {'Content-Type':'multipart/form-data'} });
      setImportResult(r.data); load();
    } catch (ex) {
      setImportResult({ message: ex.response?.data?.detail || 'Import failed.', created: 0 });
    }
    e.target.value = '';
  };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>Candidates</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 1 }}>
            {data.total} total candidates
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={doBulkImport} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
            <Upload size={14} /> Bulk Import
          </button>
        </div>
      </div>

      <div className="admin-content page-fade">
        {importResult && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: importResult.created > 0 ? 'var(--success-light)' : 'var(--warning-light)', color: importResult.created > 0 ? 'var(--success)' : 'var(--warning)', border: `1px solid ${importResult.created > 0 ? 'var(--success-border)' : 'var(--warning-border)'}` }}>
            {importResult.message}
          </div>
        )}
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
            <Search size={14} className="search-icon" />
            <input
              className="input" placeholder="Search by name, email, reference…"
              value={search} onChange={e => handleSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-3)" />
            <select className="input" style={{ width: 180 }} value={status} onChange={e => handleStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader size={24} color="var(--primary)" className="spinner" />
            </div>
          )}
          {!loading && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr>
                    <th>Reference</th><th>Name</th><th>Email</th><th>Role</th>
                    <th>Exp</th><th>Status</th><th>Score</th><th>Submitted</th><th>AI Verdict</th><th>Decision</th><th></th>
                  </tr></thead>
                  <tbody>
                    {data.items.map(c => (
                      <tr key={c.session_id} style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/candidates/${c.session_id}`)}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{c.reference_code}</td>
                        <td style={{ fontWeight: 500 }}>{c.full_name}</td>
                        <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{c.email}</td>
                        <td>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.role_name}</div>
                          {c.requisition && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>{c.requisition.req_id}</div>}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{c.years_of_experience ? `${c.years_of_experience}y` : '—'}</td>
                        <td>{statusBadge(c.status)}</td>
                        <td style={{ fontWeight: 600, color: scoreColor(c.overall_score) }}>
                          {c.overall_score != null ? `${c.overall_score.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN') : c.registered_at ? new Date(c.registered_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td>
                          {c.ai_verdict
                            ? <span className={`badge ${c.ai_verdict === 'SHORTLIST' ? 'badge-green' : c.ai_verdict === 'HOLD' ? 'badge-amber' : 'badge-red'}`}>{c.ai_verdict}</span>
                            : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>{c.final_status ? statusBadge(c.final_status) : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>—</span>}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-danger btn-sm"
                            onClick={e => { e.stopPropagation(); deleteCandidate(e, c.session_id); }}
                            title="Delete candidate">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                                        {data.items.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
                        No candidates found
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.total_pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page} of {data.total_pages}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.total_pages}>
                      Next <ChevronRight size={14} />
                    </button>
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
