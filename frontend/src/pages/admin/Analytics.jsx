import { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';
import { TrendingUp, Users, Award, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const COLORS = ['#4F46E5', '#7C3AED', '#0284C7', '#059669', '#D97706', '#DC2626'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  if (!data) return <div style={{ padding: 40, color: 'var(--text-2)' }}>Failed to load analytics.</div>;

  const { overview, segment_averages, score_distribution, by_requisition, daily_registrations, final_status_breakdown, violation_summary } = data;

  const statusColors = { selected: '#059669', rejected: '#DC2626', pending: '#D97706', on_hold: '#0284C7' };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400 }}>Analytics</div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>Recruitment pipeline intelligence</div>
        </div>
      </div>

      <div className="admin-content page-fade">
        {/* KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
          {[
            { label:'Total Candidates', value: overview.total, icon: Users, color:'#4F46E5', bg:'#EEF2FF' },
            { label:'Evaluated', value: overview.evaluated, icon: Award, color:'#7C3AED', bg:'#F5F3FF' },
            { label:'Average Score', value: `${overview.avg_score}%`, icon: TrendingUp, color:'#0284C7', bg:'#F0F9FF' },
            { label:'Pass Rate (≥70%)', value: `${overview.pass_rate}%`, icon: CheckCircle2, color:'#059669', bg:'#ECFDF5' },
            { label:'Submitted', value: overview.submitted, icon: CheckCircle2, color:'#D97706', bg:'#FFFBEB' },
            { label:'Terminated (Malpractice)', value: overview.terminated_for_malpractice, icon: XCircle, color:'#DC2626', bg:'#FEF2F2' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card" style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:11, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={20} color={color} strokeWidth={1.8} />
              </div>
              <div>
                <div className="stat-value">{value ?? '—'}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
          {/* Score distribution */}
          <div className="card">
            <div className="card-header"><span className="card-title">Score Distribution</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={score_distribution} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="range" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                  <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid var(--border)' }} />
                  <Bar dataKey="count" fill="#4F46E5" radius={[4,4,0,0]} name="Candidates" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Segment averages */}
          <div className="card">
            <div className="card-header"><span className="card-title">Segment-wise Average Scores</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name:'Seg 1\nKnowledge', score: segment_averages.seg1 },
                  { name:'Seg 2\nRole Fit', score: segment_averages.seg2 },
                  { name:'Seg 3\nScenario', score: segment_averages.seg3 },
                ]} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text-3)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize:11, fill:'var(--text-3)' }} />
                  <Tooltip formatter={v => [`${v}%`]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                  <Bar dataKey="score" fill="#7C3AED" radius={[4,4,0,0]} name="Avg Score %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
          {/* Daily registrations */}
          <div className="card">
            <div className="card-header"><span className="card-title">Registrations — Last 30 Days</span></div>
            <div className="card-body">
              {daily_registrations.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text-3)', padding:'40px 0', fontSize:13 }}>No registration data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={daily_registrations} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize:10, fill:'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
                    <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={false} name="Registrations" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Final status donut */}
          <div className="card">
            <div className="card-header"><span className="card-title">Final Decisions</span></div>
            <div className="card-body">
              {final_status_breakdown.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text-3)', padding:'40px 0', fontSize:13 }}>No decisions yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={final_status_breakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({status,percent}) => `${status} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {final_status_breakdown.map((entry, i) => (
                        <Cell key={i} fill={statusColors[entry.status] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Candidates by requisition */}
        {by_requisition.length > 0 && (
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span className="card-title">Candidates by Requisition</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={by_requisition.slice(0,10)} layout="vertical" margin={{ top:5, right:30, bottom:5, left:80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:11, fill:'var(--text-3)' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="req_id" tick={{ fontSize:11, fill:'var(--text-2)' }} width={75} />
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} formatter={(v, _, props) => [v, props.payload.title || props.payload.req_id]} />
                  <Bar dataKey="count" fill="#059669" radius={[0,4,4,0]} name="Candidates" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Violation summary */}
        {violation_summary.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Proctoring Violation Summary</span>
              <span className="badge badge-red">{violation_summary.reduce((a,v) => a + v.count, 0)} total events</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Event Type</th><th>Count</th><th>% of Total</th></tr></thead>
              <tbody>
                {violation_summary.map(v => {
                  const total = violation_summary.reduce((a,x) => a + x.count, 0);
                  return (
                    <tr key={v.type}>
                      <td><span className="badge badge-amber">{v.type.replace(/_/g,' ')}</span></td>
                      <td style={{ fontWeight:600 }}>{v.count}</td>
                      <td style={{ color:'var(--text-2)' }}>{((v.count/total)*100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
