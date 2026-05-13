import { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  Plus, ToggleLeft, ToggleRight, Briefcase,
  MapPin, Building2, Hash, Users, AlertCircle
} from 'lucide-react';

export default function Requisitions() {
  const [reqs, setReqs]       = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]        = useState({ req_id:'', title:'', department:'', location:'', description:'' });
  const [saving, setSaving]    = useState(false);
  const [err, setErr]          = useState('');

  const load = () => api.get('/admin/requisitions').then(r => setReqs(r.data));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.req_id.trim() || !form.title.trim()) {
      setErr('Req ID and Title are required.'); return;
    }
    setSaving(true); setErr('');
    try {
      await api.post('/admin/requisitions', form);
      setForm({ req_id:'', title:'', department:'', location:'', description:'' });
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to create requisition.');
    } finally { setSaving(false); }
  };

  const toggle = async (r) => {
    await api.patch(`/admin/requisitions/${r.id}`, { is_active: !r.is_active });
    load();
  };

  const active   = reqs.filter(r => r.is_active);
  const inactive = reqs.filter(r => !r.is_active);

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, fontWeight: 400 }}>
            Requisitions
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 1 }}>
            {active.length} active · {inactive.length} inactive
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(s => !s); setErr(''); }}>
          <Plus size={14} /> New Requisition
        </button>
      </div>

      <div className="admin-content page-fade">

        {/* How it works hint */}
        <div style={{
          background: 'var(--primary-light)', border: '1px solid var(--primary-border)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, color: 'var(--primary)',
        }}>
          <Briefcase size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Requisitions appear in the candidate registration dropdown under <strong>"Applying For"</strong>.
            Create one per job opening. Candidates are tracked under the requisition they applied for,
            all the way through evaluation and interview rounds.
          </span>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={15} color="var(--primary)" /> Create New Requisition
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="label">
                  Req ID <span style={{ color: 'var(--danger)' }}>*</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6, fontWeight: 400 }}>e.g. REQ-2024-001</span>
                </label>
                <input
                  className="input" placeholder="REQ-2024-001"
                  value={form.req_id}
                  onChange={e => set('req_id', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.04em' }}
                />
              </div>
              <div>
                <label className="label">Job Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="input" placeholder="e.g. Senior Java Developer" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input" placeholder="e.g. Engineering, Operations" value={form.department} onChange={e => set('department', e.target.value)} />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" placeholder="e.g. Bangalore, Remote" value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Description <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(internal notes / JD summary)</span></label>
                <textarea className="input" rows={3} placeholder="Brief role description, key skills required…" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
            {err && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>
                <AlertCircle size={13} /> {err}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>
                {saving ? 'Creating…' : 'Create Requisition'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setErr(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active requisitions */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Active Requisitions</span>
            <span className="badge badge-green">{active.length} open</span>
          </div>
          {active.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
              No active requisitions. Create one above to enable candidate registration.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Req ID</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Candidates</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--primary-border)' }}>
                        {r.req_id}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                      {r.department
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />{r.department}</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                      {r.location
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{r.location}</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: r.candidate_count > 0 ? 'var(--primary)' : 'var(--text-3)' }}>
                        <Users size={13} /> {r.candidate_count}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => toggle(r)}
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger-border)', gap: 5 }}
                        title="Deactivate — removes from registration dropdown"
                      >
                        <ToggleRight size={14} /> Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inactive requisitions */}
        {inactive.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--text-2)' }}>Closed / Inactive</span>
              <span className="badge badge-gray">{inactive.length}</span>
            </div>
            <table className="tbl">
              <thead>
                <tr><th>Req ID</th><th>Title</th><th>Department</th><th>Location</th><th>Candidates</th><th></th></tr>
              </thead>
              <tbody>
                {inactive.map(r => (
                  <tr key={r.id} style={{ opacity: 0.65 }}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)' }}>
                        {r.req_id}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{r.title}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{r.department || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{r.location || '—'}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>{r.candidate_count}</td>
                    <td>
                      <button className="btn btn-success btn-sm" onClick={() => toggle(r)} style={{ gap: 5 }}>
                        <ToggleLeft size={14} /> Reactivate
                      </button>
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
