import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Plus, UserCog } from 'lucide-react';

const ROLES = ['super_admin','admin','interviewer'];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email:'', full_name:'', password:'', role:'interviewer' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api.get('/admin/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/admin/users', form);
      setForm({ email:'', full_name:'', password:'', role:'interviewer' });
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active });
    load();
  };

  const roleColor = { super_admin: 'badge-violet', admin: 'badge-indigo', interviewer: 'badge-gray' };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>User Management</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{users.length} users</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Add User
        </button>
      </div>
      <div className="admin-content page-fade">
        {showForm && (
          <div className="card" style={{ marginBottom: 20, padding: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCog size={16} color="var(--primary)" /> Create New User
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e => setForm(f=>({...f,full_name:e.target.value}))} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} /></div>
              <div><label className="label">Role</label>
                <select className="input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
            {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="card">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{u.email}</td>
                  <td><span className={`badge ${roleColor[u.role]||'badge-gray'}`}>{u.role?.replace('_',' ')}</span></td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
