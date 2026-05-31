import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Plus, UserCog, Pencil, X } from 'lucide-react';

const ROLES = ['super_admin','admin','qadmin','interviewer'];
const ROLE_COLOR = { super_admin:'badge-violet', admin:'badge-indigo', qadmin:'badge-amber', interviewer:'badge-gray' };
const EMPTY_FORM = { email:'', full_name:'', password:'', role:'interviewer' };

export default function UserManagement() {
  const [users,    setUsers]    = useState([]);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editUser, setEditUser] = useState(null); // user object being edited
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ full_name:'', role:'', password:'' });
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [editErr,  setEditErr]  = useState('');

  const load = () => api.get('/admin/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  // ── Create user ──────────────────────────────────────────────────
  const createUser = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/admin/users', form);
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  // ── Open edit form ───────────────────────────────────────────────
  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name, role: u.role, password: '' });
    setEditErr('');
    setShowAdd(false); // close add form if open
  };

  // ── Save edits ───────────────────────────────────────────────────
  const saveEdit = async () => {
    setSaving(true); setEditErr('');
    try {
      const payload = { full_name: editForm.full_name, role: editForm.role };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await api.patch(`/admin/users/${editUser.id}`, payload);
      setEditUser(null);
      load();
    } catch (e) {
      setEditErr(e.response?.data?.detail || 'Update failed.');
    } finally { setSaving(false); }
  };

  // ── Toggle active ────────────────────────────────────────────────
  const toggleActive = async (u) => {
    await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active });
    load();
  };

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, fontWeight:400 }}>
            User Management
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>{users.length} users</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditUser(null); }}>
          <Plus size={14} /> Add User
        </button>
      </div>

      <div className="admin-content page-fade">

        {/* ── Add user form ── */}
        {showAdd && (
          <div className="card" style={{ marginBottom:20, padding:24 }}>
            <div style={{ fontWeight:600, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <UserCog size={16} color="var(--primary)" /> Create New User
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name:e.target.value }))} />
              </div>
              <div>
                <label className="label">Email (login ID)</label>
                <input type="email" className="input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email:e.target.value }))} />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password:e.target.value }))} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role:e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
            {err && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:10 }}>{err}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={createUser} disabled={saving}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Edit user form ── */}
        {editUser && (
          <div className="card" style={{ marginBottom:20, padding:24,
            border:'1px solid var(--primary)40', background:'var(--primary)05' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                <Pencil size={15} color="var(--primary)" /> Edit User
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name:e.target.value }))} />
              </div>
              <div>
                <label className="label">Email (login ID — cannot change)</label>
                <input className="input" value={editUser.email} disabled
                  style={{ opacity:0.5, cursor:'not-allowed', background:'var(--surface-2)' }} />
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" value={editForm.password}
                  placeholder="Leave blank to keep current password"
                  onChange={e => setEditForm(f => ({ ...f, password:e.target.value }))} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role:e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>

            {editErr && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:10 }}>{editErr}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Users table ── */}
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}
                  style={{ background: editUser?.id === u.id ? 'var(--primary)05' : '' }}>
                  <td style={{ fontWeight:500 }}>{u.full_name}</td>
                  <td style={{ color:'var(--text-2)', fontSize:13 }}>{u.email}</td>
                  <td>
                    <span className={`badge ${ROLE_COLOR[u.role] || 'badge-gray'}`}>
                      {u.role?.replace('_',' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-3)', fontFamily:'monospace' }}>
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(u)}
                        style={{ padding:'4px 10px' }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
