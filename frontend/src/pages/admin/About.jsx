import { useState, useEffect } from 'react';
import { Pencil, X, Save, Plus, Trash2, CheckCircle } from 'lucide-react';
import api from '../../api/client';

// ── Default content (seeds the DB first time) ─────────────────────────────
const DEFAULT = {
  purpose: `This assessment is purpose-built to identify production engineering talent capable of operating mission-critical wealth-management platforms. Questions are grounded in real-world Sev-1 scenarios drawn from advisor platforms, trading infrastructure, and enterprise middleware estates — not theoretical textbook problems. The goal is to surface engineers who think like senior production engineers, not administrators.`,
  assessment_areas: [
    { title:'Deep Troubleshooting',          desc:'Isolate failure domains across infra/app/network/storage layers' },
    { title:'Production Incident Reasoning', desc:'Handle high-severity incidents under regulatory pressure' },
    { title:'Architecture Understanding',    desc:'HA/DR design, hybrid cloud, distributed middleware estates' },
    { title:'Performance Tuning',            desc:'OS internals, JVM diagnostics, kernel/resource bottlenecks' },
    { title:'Root-Cause Thinking',           desc:'Avoid false positives; map blast radius; lead outage bridges' },
    { title:'Resiliency Engineering',        desc:'Recovery strategy, automation, SRE observability' },
  ],
  target_roles: ['Production Engineering SMEs','Enterprise SREs','Wealth-Tech Infrastructure Specialists'],
  capability_items: [
    'Run mission-critical advisor platforms',
    'Handle high-severity incidents under regulatory pressure',
    'Understand transaction integrity and client-impact blast radius',
    'Operate large-scale distributed middleware estates',
    'Diagnose intermittent failures across infra/app/network/storage layers',
    'Handle latency-sensitive financial workloads',
    'Support hybrid cloud + legacy enterprise environments',
    'Lead bridges during Sev-1 outages',
    'Make risk-aware operational decisions',
    'Think like senior production engineers, not administrators',
  ],
  scenarios: [
    { title:'Trading Batch Delays',                  desc:'Identifying bottlenecks causing overnight batch jobs to miss windows' },
    { title:'Market Open Surge Events',              desc:'Handling infrastructure spikes at peak market-open time' },
    { title:'Advisor Portal Latency',                desc:'Diagnosing slow advisor-facing UI under load — storage, app, or network?' },
    { title:'End-of-Day Reconciliation Failures',    desc:'Tracing transaction integrity issues in reconciliation pipelines' },
    { title:'Wealth Reporting Degradation',          desc:'Root-causing reporting platform slowdowns for advisors and clients' },
    { title:'Regulatory Reporting Impact',           desc:'Ensuring compliance delivery is unaffected during incidents' },
    { title:'Certificate Expiry During Trading Hours', desc:'Emergency TLS rotation without disrupting live trading systems' },
    { title:'Advisor Onboarding Resiliency',         desc:'Maintaining availability of onboarding flows during outages' },
  ],
  clusters: [
    { cluster:'Linux Kernel & OS Internals',       qs:60, focus:'CPU scheduling, NUMA, memory pressure, I/O wait, kernel debugging' },
    { cluster:'Middleware & JVM Engineering',       qs:70, focus:'GC, heap/thread analysis, connection pooling, clustered failures' },
    { cluster:'Wealth-Tech Production Scenarios',  qs:40, focus:'Advisor platforms, transaction integrity, session consistency' },
    { cluster:'Enterprise Networking',             qs:50, focus:'TCP internals, asymmetric routing, SSL/TLS, LB behavior' },
    { cluster:'Storage & Database Infrastructure', qs:50, focus:'SAN latency, replication, backup contention, IOPS diagnostics' },
    { cluster:'Cloud, Containers & Kubernetes',    qs:50, focus:'Hybrid cloud ops, Kubernetes failures, autoscaling' },
    { cluster:'Incident Command & RCA',            qs:40, focus:'Sev-1 leadership, blast radius, dependency mapping' },
    { cluster:'SRE / Observability Engineering',   qs:40, focus:'SLIs/SLOs, tracing, telemetry, synthetic monitoring' },
    { cluster:'Security Engineering',             qs:35, focus:'PAM, zero trust, certificate failures, secrets handling' },
    { cluster:'Automation & IaC',                 qs:30, focus:'Terraform drift, Ansible orchestration, CI/CD failures' },
    { cluster:'Windows Enterprise Infrastructure',qs:20, focus:'AD replication, Kerberos, GPO failures' },
    { cluster:'Messaging & Distributed Systems',  qs:15, focus:'Kafka, MQ, transaction sequencing' },
  ],
  core_stems: [
    '"What would you do and why?"',
    '"What is the most likely root cause?"',
    '"Which metric matters most here?"',
    '"What is the blast radius?"',
    '"Which layer do you isolate first?"',
    '"Why did this fail despite appearing healthy?"',
  ],
};

// ── Tiny helpers ──────────────────────────────────────────────────────────
const Input = ({ value, onChange, style }) => (
  <input className="input" value={value} onChange={e => onChange(e.target.value)}
    style={{ marginBottom:6, ...style }} />
);
const Textarea = ({ value, onChange, rows=3 }) => (
  <textarea className="input" rows={rows} value={value}
    onChange={e => onChange(e.target.value)}
    style={{ resize:'vertical', marginBottom:6 }} />
);

export default function About() {
  const [data,    setData]    = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    api.get('/admin/site-content/about')
      .then(r => {
        const content = (r.data.content && Object.keys(r.data.content).length)
          ? r.data.content : DEFAULT;
        setData(content);
      })
      .catch(() => setData(DEFAULT));
  }, []);

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(data))); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/site-content/about', { content: draft });
      setData(draft); setEditing(false); setDraft(null);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert('Save failed.'); }
    finally { setSaving(false); }
  };

  // helpers to mutate draft
  const setField = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const setListItem = (key, i, val) => setDraft(d => {
    const arr = [...d[key]]; arr[i] = val; return { ...d, [key]: arr };
  });
  const setObjField = (key, i, field, val) => setDraft(d => {
    const arr = [...d[key]]; arr[i] = { ...arr[i], [field]: val }; return { ...d, [key]: arr };
  });
  const addItem = (key, blank) => setDraft(d => ({ ...d, [key]: [...d[key], blank] }));
  const removeItem = (key, i) => setDraft(d => {
    const arr = [...d[key]]; arr.splice(i, 1); return { ...d, [key]: arr };
  });

  if (!data) return <div style={{ padding:60, textAlign:'center' }}><div className="spinner" /></div>;

  const D = editing ? draft : data;
  const total = D.clusters.reduce((s, c) => s + (parseInt(c.qs) || 0), 0);

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="admin-topbar">
        <div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22 }}>About This Assessment</div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>I&O Enterprise Production Engineering · LPL Financial GCC India</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {editing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}><X size={14}/> Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : <><Save size={14}/> Save Changes</>}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={startEdit}>
              {saved ? <><CheckCircle size={14}/> Saved</> : <><Pencil size={14}/> Edit Page</>}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ background:'#FEF3C7', borderBottom:'2px solid #FCD34D',
          padding:'10px 28px', fontSize:13, color:'#92400E' }}>
          ✏️ Edit mode — changes are live in this view. Click <strong>Save Changes</strong> to persist.
        </div>
      )}

      <div style={{ fontFamily:"Inter,'Segoe UI',sans-serif" }}>

        {/* ── Hero ── */}
        <div style={{ background:'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4338CA 100%)',
          color:'#fff', padding:'48px 48px 40px', position:'relative', overflow:'hidden' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em',
            textTransform:'uppercase', opacity:0.6, marginBottom:12 }}>
            I&O · Enterprise Production Engineering
          </div>
          <h1 style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:36,
            fontWeight:400, margin:'0 0 10px', lineHeight:1.2 }}>
            Assessment Question Bank
          </h1>
          <p style={{ fontSize:15, opacity:0.75, margin:'0 0 28px', maxWidth:620, lineHeight:1.6 }}>
            Wealth-Tech · Enterprise Operations · Production Engineering · Apps Engineering Support
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[{ n:`${total}+`, l:'Total questions' },{ n:'12', l:'Technical clusters' },
              { n:'3', l:'Assessment segments' },{ n:'Sev-1', l:'Incident-grade difficulty' }
            ].map(({ n, l }) => (
              <div key={l} style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)',
                borderRadius:10, padding:'10px 20px', textAlign:'center',
                border:'1px solid rgba(255,255,255,0.18)' }}>
                <div style={{ fontSize:22, fontWeight:700 }}>{n}</div>
                <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'36px 48px', maxWidth:1100 }}>

          {/* ── Purpose ── */}
          <section style={{ marginBottom:40 }}>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:10 }}>🎯 Purpose</h2>
            {editing ? (
              <Textarea value={draft.purpose} rows={5}
                onChange={v => setField('purpose', v)} />
            ) : (
              <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.8, maxWidth:780, margin:0 }}>{D.purpose}</p>
            )}
          </section>

          {/* ── Assessment Areas ── */}
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>🔍 What Is Being Assessed</h2>
              {editing && <button className="btn btn-ghost btn-sm" onClick={() => addItem('assessment_areas', { title:'New Area', desc:'Description' })}><Plus size={13}/> Add</button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {D.assessment_areas.map((a, i) => (
                <div key={i} style={{ padding:'16px 18px', borderRadius:10,
                  background:'var(--surface)', border:'1px solid var(--border)',
                  position:'relative' }}>
                  {editing ? (
                    <>
                      <Input value={draft.assessment_areas[i].title}
                        onChange={v => setObjField('assessment_areas', i, 'title', v)}
                        style={{ fontWeight:700, fontSize:13 }}/>
                      <Textarea value={draft.assessment_areas[i].desc}
                        onChange={v => setObjField('assessment_areas', i, 'desc', v)} rows={2}/>
                      <button onClick={() => removeItem('assessment_areas', i)}
                        style={{ position:'absolute', top:8, right:8, background:'none',
                          border:'none', cursor:'pointer', color:'#fca5a5' }}>
                        <Trash2 size={12}/>
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>{a.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6 }}>{a.desc}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Target Roles ── */}
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>👤 Target Roles</h2>
              {editing && <button className="btn btn-ghost btn-sm" onClick={() => addItem('target_roles', 'New Role')}><Plus size={13}/> Add</button>}
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
              {D.target_roles.map((r, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  {editing ? (
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Input value={draft.target_roles[i]} onChange={v => setListItem('target_roles', i, v)}
                        style={{ width:220, marginBottom:0 }}/>
                      <button onClick={() => removeItem('target_roles', i)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#fca5a5' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  ) : (
                    <span style={{ padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600,
                      background:'#F5F3FF', color:'#6D28D9', border:'1px solid #DDD6FE' }}>{r}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:10, fontWeight:600 }}>
              With wealth-tech as the operating premise, the question bank tests whether a candidate can:
            </div>
            {editing && <button className="btn btn-ghost btn-sm" style={{ marginBottom:8 }}
              onClick={() => addItem('capability_items', 'New capability')}><Plus size={13}/> Add capability</button>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 24px' }}>
              {D.capability_items.map((item, i) => (
                <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'5px 0', fontSize:13, color:'var(--text-2)' }}>
                  <span style={{ color:'#10B981', flexShrink:0 }}>✓</span>
                  {editing ? (
                    <div style={{ display:'flex', flex:1, gap:4, alignItems:'center' }}>
                      <Input value={draft.capability_items[i]} onChange={v => setListItem('capability_items', i, v)}
                        style={{ flex:1, marginBottom:0 }}/>
                      <button onClick={() => removeItem('capability_items', i)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#fca5a5' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  ) : item}
                </div>
              ))}
            </div>
          </section>

          {/* ── Scenarios ── */}
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>🏦 Wealth-Tech Operational Scenarios</h2>
              {editing && <button className="btn btn-ghost btn-sm"
                onClick={() => addItem('scenarios', { title:'New Scenario', desc:'Description' })}><Plus size={13}/> Add</button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              {D.scenarios.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px',
                  borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)',
                  position:'relative' }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>⚡</span>
                  <div style={{ flex:1 }}>
                    {editing ? (
                      <>
                        <Input value={draft.scenarios[i].title}
                          onChange={v => setObjField('scenarios', i, 'title', v)}
                          style={{ fontWeight:600, marginBottom:4 }}/>
                        <Textarea value={draft.scenarios[i].desc}
                          onChange={v => setObjField('scenarios', i, 'desc', v)} rows={2}/>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>{s.title}</div>
                        <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>{s.desc}</div>
                      </>
                    )}
                  </div>
                  {editing && <button onClick={() => removeItem('scenarios', i)}
                    style={{ position:'absolute', top:8, right:8, background:'none',
                      border:'none', cursor:'pointer', color:'#fca5a5' }}>
                    <Trash2 size={12}/>
                  </button>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Cluster table ── */}
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>📊 Question Bank by Cluster</h2>
              {editing && <button className="btn btn-ghost btn-sm"
                onClick={() => addItem('clusters', { cluster:'New Cluster', qs:0, focus:'Focus areas' })}><Plus size={13}/> Add row</button>}
            </div>
            <div className="card" style={{ overflow:'hidden', padding:0 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#312E81', color:'#fff' }}>
                    <th style={{ padding:'12px 16px', textAlign:'left' }}>Cluster</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', width:60 }}>Qs</th>
                    <th style={{ padding:'12px 16px', textAlign:'left' }}>Focus Areas</th>
                    {editing && <th style={{ width:40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {D.clusters.map((c, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8F7FF',
                      borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'10px 16px' }}>
                        {editing ? <Input value={draft.clusters[i].cluster}
                          onChange={v => setObjField('clusters', i, 'cluster', v)}
                          style={{ marginBottom:0 }}/> : <span style={{ fontWeight:600 }}>{c.cluster}</span>}
                      </td>
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        {editing ? <Input value={String(draft.clusters[i].qs)}
                          onChange={v => setObjField('clusters', i, 'qs', parseInt(v)||0)}
                          style={{ width:60, textAlign:'center', marginBottom:0 }}/> :
                          <span style={{ fontWeight:700, color:'#6366F1', fontSize:15 }}>{c.qs}</span>}
                      </td>
                      <td style={{ padding:'10px 16px', color:'var(--text-2)' }}>
                        {editing ? <Input value={draft.clusters[i].focus}
                          onChange={v => setObjField('clusters', i, 'focus', v)}
                          style={{ marginBottom:0 }}/> : c.focus}
                      </td>
                      {editing && <td style={{ padding:'10px 8px' }}>
                        <button onClick={() => removeItem('clusters', i)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#fca5a5' }}>
                          <Trash2 size={12}/>
                        </button>
                      </td>}
                    </tr>
                  ))}
                  <tr style={{ background:'#312E81', color:'#fff' }}>
                    <td style={{ padding:'12px 16px', fontWeight:700 }}>Total</td>
                    <td style={{ padding:'12px 16px', textAlign:'center', fontWeight:800, fontSize:17 }}>{total}</td>
                    <td style={{ padding:'12px 16px', opacity:0.7, fontSize:12 }}>
                      Across {D.clusters.length} technical domains
                    </td>
                    {editing && <td></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Core stems ── */}
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>💬 Core Question Stems</h2>
              {editing && <button className="btn btn-ghost btn-sm"
                onClick={() => addItem('core_stems', '"New question stem?"')}><Plus size={13}/> Add</button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {D.core_stems.map((s, i) => (
                <div key={i} style={{ padding:'12px 14px', borderRadius:8, position:'relative',
                  background:'linear-gradient(135deg,#F5F3FF,#EEF2FF)', border:'1px solid #DDD6FE' }}>
                  {editing ? (
                    <div style={{ display:'flex', gap:4, alignItems:'flex-start' }}>
                      <Input value={draft.core_stems[i]} onChange={v => setListItem('core_stems', i, v)}
                        style={{ flex:1, marginBottom:0 }}/>
                      <button onClick={() => removeItem('core_stems', i)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#fca5a5', flexShrink:0 }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize:13, fontWeight:500, color:'#4338CA', fontStyle:'italic' }}>{s}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
