import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Activity, Users, BarChart2, BookOpen, Briefcase,
  Shield, Settings, UserCog, MessageSquare, ChevronRight,
  TrendingUp, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import api from '../../api/client';

const FEATURES = [
  {
    to: '/admin/live', icon: Activity, color: '#10B981',
    title: 'Live Monitor',
    desc: 'Watch all active assessments in real time. See webcam thumbnails, violation counts and integrity scores as candidates take the test. Terminate a session manually if needed.',
  },
  {
    to: '/admin/candidates', icon: Users, color: '#6366F1',
    title: 'Candidates',
    desc: 'Full candidate list with search, filters by status and decision. View detailed evaluation results, proctoring snapshots, and the integrity event log. Export the entire list as CSV.',
  },
  {
    to: '/admin/analytics', icon: BarChart2, color: '#8B5CF6',
    title: 'Analytics',
    desc: 'Score distributions, segment-level performance trends, and pipeline conversion rates. Understand how your candidate pool is performing at a glance.',
  },
  {
    to: '/admin/questions', icon: BookOpen, color: '#F59E0B',
    title: 'Question Bank',
    desc: 'Manage Segment 1, 2 and 3 assessment questions. Import in bulk via Excel, tag by batch and category, purge outdated sets, and view Round 2 questions in the same interface.',
  },
  {
    to: '/admin/inperson', icon: MessageSquare, color: '#EC4899',
    title: 'In-person Interview',
    desc: 'A curated question repository for face-to-face interviews. Browse by topic tag, add questions with expected answers, and import in bulk. Used by interview panellists.',
  },
  {
    to: '/admin/requisitions', icon: Briefcase, color: '#14B8A6',
    title: 'Requisitions',
    desc: 'Create and manage job requisitions that candidates apply against. Each requisition defines the role, experience bracket and segment configuration for the assessment.',
  },
  {
    to: '/admin/proctoring', icon: Shield, color: '#EF4444',
    title: 'Proctoring',
    desc: 'Enable or disable proctoring globally. When OFF, candidates skip the camera entirely — ideal for in-person supervised sessions. Calibrate detection sensitivity when ON.',
  },
  {
    to: '/admin/settings', icon: Settings, color: '#64748B',
    title: 'Settings',
    desc: 'Configure system-wide parameters such as assessment time limits, segment weights, score thresholds for auto-evaluation, and platform branding.',
  },
  {
    to: '/admin/users', icon: UserCog, color: '#0EA5E9',
    title: 'User Management',
    desc: 'Create and manage admin users. Assign roles (Super Admin, Admin, Question Admin, Interviewer), activate or deactivate accounts, and reset passwords.',
    superAdminOnly: true,
  },
];

export default function AdminHome() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const features = FEATURES.filter(f => !f.superAdminOnly || isSuperAdmin);

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, fontWeight:400 }}>
            Welcome back, {user?.full_name?.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)', marginTop:2 }}>
            Here's an overview of everything you can do in TalentLens
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/candidates')}>
          View Candidates <ChevronRight size={14} />
        </button>
      </div>

      <div className="admin-content page-fade">

        {/* Quick stats */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:32 }}>
            {[
              { label:'Total registered', value:stats.total_candidates, Icon:Users,        color:'#6366F1' },
              { label:'Evaluated',        value:stats.evaluated,        Icon:CheckCircle,  color:'#10B981' },
              { label:'Pending review',   value:stats.pending_evaluation,Icon:Clock,       color:'#F59E0B' },
              { label:'Selected',         value:stats.selected,         Icon:TrendingUp,   color:'#8B5CF6' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="card"
                style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:10,
                  background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ fontSize:26, fontWeight:700, color:'var(--text)' }}>{value}</div>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature grid */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>
            What you can do
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {features.map(({ to, icon:Icon, color, title, desc }) => (
              <div key={to} className="card"
                onClick={() => navigate(to)}
                style={{ padding:20, cursor:'pointer', transition:'box-shadow 0.15s',
                  ':hover':{ boxShadow:'0 4px 16px rgba(0,0,0,0.08)' } }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10,
                    background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{title}</span>
                  <ChevronRight size={14} color="var(--text-3)" style={{ marginLeft:'auto' }} />
                </div>
                <p style={{ fontSize:13, color:'var(--text-2)', margin:0, lineHeight:1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
