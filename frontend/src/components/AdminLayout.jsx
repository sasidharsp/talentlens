import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, Settings, UserCog,
  LogOut, Zap, Briefcase, BarChart2, Activity, MessageSquare, Home,
} from 'lucide-react';

const allNavItems = [
  { to: '/admin',           label: 'Dashboard',          icon: LayoutDashboard, exact: true, roles: ['admin','super_admin'] },
  { to: '/admin/live',      label: 'Live Monitor',        icon: Activity,        roles: ['admin','super_admin'] },
  { to: '/admin/analytics', label: 'Analytics',           icon: BarChart2,       roles: ['admin','super_admin'] },
  { to: '/admin/candidates',label: 'Candidates',          icon: Users,           roles: ['admin','super_admin','interviewer'] },
  { to: '/admin/requisitions',label:'Requisitions',       icon: Briefcase,       roles: ['admin','super_admin'] },
  { to: '/admin/questions', label: 'Question Bank',       icon: BookOpen,        roles: ['admin','super_admin'] },
  { to: '/admin/inperson',  label: 'In-person Interview', icon: MessageSquare,   roles: ['admin','super_admin','qadmin'] },
  { to: '/admin/settings',  label: 'Settings',            icon: Settings,        roles: ['admin','super_admin'] },
  // qadmin-only home
  { to: '/admin/qadmin-home', label: 'Home', icon: Home, exact: true, roles: ['qadmin'] },
];

export default function AdminLayout() {
  const { user, logout, isAdmin, isSuperAdmin, isQAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  // Redirect qadmin to their home page if landing on /admin root
  useEffect(() => {
    if (isQAdmin && window.location.pathname === '/admin') {
      navigate('/admin/qadmin-home', { replace: true });
    }
  }, [isQAdmin]);

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
        <div style={{ position:'sticky', top:0, zIndex:10, background:'rgba(248,247,244,0.92)',
          backdropFilter:'blur(8px)', borderBottom:'1px solid var(--border)',
          padding:'8px 28px', display:'flex', justifyContent:'flex-end', alignItems:'center' }}>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm"
            style={{ color:'var(--text-2)', gap:6 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
