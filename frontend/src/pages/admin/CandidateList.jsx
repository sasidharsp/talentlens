import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowRight, Loader } from 'lucide-react';

const statusBadge = (s) => {
  const m = { REGISTERED:'badge-gray', IN_PROGRESS:'badge-amber', SUBMITTED:'badge-sky', EVALUATED:'badge-indigo', selected:'badge-green', rejected:'badge-red', pending:'badge-amber', on_hold:'badge-amber' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s?.replace('_',' ')}</span>;
};
const scoreColor = (v) => !v ? 'var(--text-3)' : v>=70 ? 'var(--success)' : v>=50 ? 'var(--warning)' : 'var(--danger)';

const STATUSES = ['', 'REGISTERED', 'IN_PROGRESS', 'SUBMITTED', 'EVALUATED'];

export default function CandidateList() {
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>Candidates</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 1 }}>
            {data.total} total candidates
          </div>
        </div>
      </div>

      <div className="admin-content page-fade">
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
                    <th>Exp</th><th>Status</th><th>Score</th><th>Decision</th><th></th>
                  </tr></thead>
                  <tbody>
                    {data.items.map(c => (
                      <tr key={c.session_id} style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/candidates/${c.session_id}`)}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{c.reference_code}</td>
                        <td style={{ fontWeight: 500 }}>{c.full_name}</td>
                        <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{c.email}</td>
                        <td style={{ color: 'var(--text-2)' }}>{c.role_name}</td>
                        <td style={{ color: 'var(--text-2)' }}>{c.years_of_experience}y</td>
                        <td>{statusBadge(c.status)}</td>
                        <td style={{ fontWeight: 600, color: scoreColor(c.overall_score) }}>
                          {c.overall_score != null ? `${c.overall_score.toFixed(1)}%` : '—'}
                        </td>
                        <td>{c.final_status ? statusBadge(c.final_status) : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>—</span>}</td>
                        <td><ArrowRight size={14} color="var(--text-3)" /></td>
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
              {data.pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page} of {data.pages}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pages}>
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
