import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Users, CheckSquare, Clock, Award, XCircle, TrendingUp, ArrowRight } from 'lucide-react';

const statusBadge = (s) => {
  const m = { REGISTERED:'badge-gray', IN_PROGRESS:'badge-amber', SUBMITTED:'badge-sky', EVALUATED:'badge-indigo', selected:'badge-green', rejected:'badge-red', pending:'badge-amber', on_hold:'badge-amber' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s?.replace('_',' ')}</span>;
};
const scoreColor = (v) => !v ? 'var(--text-3)' : v>=70 ? 'var(--success)' : v>=50 ? 'var(--warning)' : 'var(--danger)';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/dashboard/stats').then(r => setStats(r.data));
    api.get('/admin/candidates?page=1&page_size=8').then(r => setRecent(r.data.items || []));
  }, []);

  const statCards = stats ? [
    { label: 'Total Registered', value: stats.total_candidates, icon: Users, color: '#4F46E5', bg: '#EEF2FF' },
    { label: 'Submitted', value: stats.submitted, icon: CheckSquare, color: '#0284C7', bg: '#F0F9FF' },
    { label: 'Pending Evaluation', value: stats.pending_evaluation, icon: Clock, color: '#D97706', bg: '#FFFBEB' },
    { label: 'Evaluated', value: stats.evaluated, icon: Award, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Selected', value: stats.selected, icon: TrendingUp, color: '#059669', bg: '#ECFDF5' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: '#DC2626', bg: '#FEF2F2' },
  ] : [];

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 1 }}>Recruitment pipeline overview</div>
        </div>
      </div>
      <div className="admin-content page-fade">
        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={color} strokeWidth={1.8} />
              </div>
              <div>
                <div className="stat-value">{value ?? '—'}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent candidates */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Candidates</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/candidates')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Reference</th><th>Name</th><th>Role</th><th>Exp</th>
                <th>Status</th><th>Score</th><th>Decision</th><th></th>
              </tr></thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.session_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/candidates/${c.session_id}`)}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{c.reference_code}</td>
                    <td style={{ fontWeight: 500 }}>{c.full_name}</td>
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
                {recent.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No candidates yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
