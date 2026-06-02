import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, Settings, UserCog,
  LogOut, Zap, Briefcase, BarChart2, Activity, MessageSquare, Home, Shield, KeyRound, Info,
} from 'lucide-react';
import api from '../api/client';

// ── Change-password modal ────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password:'', new_password:'', confirm:'' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const [ok,     setOk]     = useState(false);

  const save = async () => {
    setErr('');
    if (form.new_password !== form.confirm) { setErr('New passwords do not match.'); return; }
    if (form.new_password.length < 6)       { setErr('Password must be at least 6 characters.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/users/me/change-password', {
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to change password.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999,
      background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:14, padding:28, width:380,
        boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:20,
          display:'flex', alignItems:'center', gap:8 }}>
          <KeyRound size={16} color="var(--primary)" /> Change Password
        </div>
        {ok ? (
          <div style={{ textAlign:'center', padding:'16px 0', color:'var(--success)', fontWeight:600 }}>
            ✓ Password changed successfully
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              <div>
                <label className="label">Current password</label>
                <input type="password" className="input"
                  value={form.current_password}
                  onChange={e => setForm(f => ({...f, current_password:e.target.value}))} />
              </div>
              <div>
                <label className="label">New password</label>
                <input type="password" className="input"
                  value={form.new_password}
                  onChange={e => setForm(f => ({...f, new_password:e.target.value}))} />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input type="password" className="input"
                  value={form.confirm}
                  onChange={e => setForm(f => ({...f, confirm:e.target.value}))} />
              </div>
            </div>
            {err && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:12 }}>{err}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Change Password'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const allNavItems = [
  { to: '/admin/about',     label: 'About',              icon: Info,            exact: true, roles: ['admin','super_admin','interviewer','qadmin'] },
  { to: '/admin/home',      label: 'Home',               icon: Home,            exact: true, roles: ['admin','super_admin'] },
  { to: '/admin',           label: 'Dashboard',          icon: LayoutDashboard, exact: true, roles: ['admin','super_admin'] },
  { to: '/admin/live',      label: 'Live Monitor',        icon: Activity,        roles: ['admin','super_admin'] },
  { to: '/admin/analytics', label: 'Analytics',           icon: BarChart2,       roles: ['admin','super_admin'] },
  { to: '/admin/candidates',label: 'Candidates',          icon: Users,           roles: ['admin','super_admin','interviewer'] },
  { to: '/admin/requisitions',label:'Requisitions',       icon: Briefcase,       roles: ['admin','super_admin'] },
  { to: '/admin/questions', label: 'Question Bank',       icon: BookOpen,        roles: ['admin','super_admin'] },
  { to: '/admin/inperson',  label: 'In-person Interview', icon: MessageSquare,   roles: ['admin','super_admin','qadmin'] },
  { to: '/admin/settings',  label: 'Settings',            icon: Settings,        roles: ['admin','super_admin'] },
  { to: '/admin/proctoring',label: 'Proctoring',           icon: Shield,          roles: ['admin','super_admin'] },
  // qadmin-only home
  { to: '/admin/qadmin-home', label: 'Home', icon: Home, exact: true, roles: ['qadmin'] },
];

export default function AdminLayout() {
  const { user, logout, isAdmin, isSuperAdmin, isQAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPwModal, setShowPwModal] = useState(false);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  // Redirect admin/super_admin to home page when landing on /admin root
  useEffect(() => {
    if ((isAdmin || isSuperAdmin) && window.location.pathname === '/admin') {
      navigate('/admin/home', { replace: true });
    }
    if (isQAdmin && window.location.pathname === '/admin') {
      navigate('/admin/qadmin-home', { replace: true });
    }
  }, [isAdmin, isSuperAdmin, isQAdmin]);

  const role = user?.role || '';
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : isQAdmin ? 'Question Admin' : 'Interviewer';
  const roleBg = isSuperAdmin ? 'badge-violet' : isAdmin ? 'badge-indigo' : isQAdmin ? 'badge-amber' : 'badge-gray';
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <div className="admin-wrap">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.01em' }}>
                TalentLens
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Assessment Platform</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px 8px' }}>
            Navigation
          </div>
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            
            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            );
          })}

          {isSuperAdmin && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 12px 8px', marginTop: 4, borderTop: '1px solid var(--border)' }}>
                Admin
              </div>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <UserCog size={16} strokeWidth={1.8} />
                <span>User Management</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--primary)',
              flexShrink: 0,
            }}>
              {user?.full_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              <span className={`badge ${roleBg}`} style={{ fontSize: 10, padding: '1px 7px' }}>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-2)' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
        <div style={{ position:'sticky', top:0, zIndex:10, background:'rgba(248,247,244,0.92)',
          backdropFilter:'blur(8px)', borderBottom:'1px solid var(--border)',
          padding:'8px 28px', display:'flex', justifyContent:'flex-end',
          alignItems:'center', gap:6 }}>
          <button onClick={() => navigate('/admin/home')} className="btn btn-ghost btn-sm"
            style={{ color:'var(--text-2)', gap:5 }}>
            <Home size={14} /> Home
          </button>
          <button onClick={() => setShowPwModal(true)} className="btn btn-ghost btn-sm"
            style={{ color:'var(--text-2)', gap:5 }}>
            <KeyRound size={14} /> Change Password
          </button>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm"
            style={{ color:'var(--text-2)', gap:5 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
