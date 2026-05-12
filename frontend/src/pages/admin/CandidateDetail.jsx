import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/client';
import {
  ArrowLeft, Download, Zap, Lock, Plus, CheckCircle2,
  Clock, Circle, User, Calendar, MessageSquare, Star,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

const statusBadge = (s) => {
  const m = { REGISTERED:'badge-gray', IN_PROGRESS:'badge-amber', SUBMITTED:'badge-sky',
    EVALUATED:'badge-indigo', selected:'badge-green', rejected:'badge-red',
    pending:'badge-amber', on_hold:'badge-amber', proceed:'badge-green', reject:'badge-red', hold:'badge-amber' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s?.replace('_',' ')}</span>;
};

const scoreColor = (v) => !v ? 'var(--text)' : v>=70 ? 'var(--success)' : v>=50 ? 'var(--warning)' : 'var(--danger)';

function ScoreBar({ value, color }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(value||0, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── Lifecycle Round component ────────────────────────────────────────────────
function RoundSection({ roundNumber, roundLabel, entries, sessionId, currentUser, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ interviewer_name: currentUser?.full_name || '', score: '', outcome: '', feedback_text: '', round_date: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);

  const latestOutcome = entries.length ? entries[entries.length - 1].outcome : null;

  const dotClass = entries.length === 0 ? 'pending' : latestOutcome === 'proceed' ? 'done' : latestOutcome === 'reject' ? '' : 'active';
  const dotStyle = latestOutcome === 'reject' ? { borderColor: 'var(--danger)', background: 'var(--danger)', color: '#fff' } : {};

  const save = async () => {
    if (!form.feedback_text.trim()) { setErr('Feedback is required.'); return; }
    setSaving(true); setErr('');
    try {
      await api.post(`/admin/candidates/${sessionId}/rounds`, {
        round_number: roundNumber,
        interviewer_name: form.interviewer_name || currentUser?.full_name,
        score: form.score ? parseInt(form.score) : null,
        outcome: form.outcome || null,
        feedback_text: form.feedback_text,
        round_date: form.round_date || null,
      });
      setForm({ interviewer_name: currentUser?.full_name || '', score: '', outcome: '', feedback_text: '', round_date: '' });
      setShowForm(false);
      onAdded();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to save entry.');
    } finally { setSaving(false); }
  };

  return (
    <div className="timeline-item">
      <div className={`timeline-dot ${dotClass}`} style={dotStyle}>
        {entries.length > 0 && latestOutcome === 'proceed' && <CheckCircle2 size={12} color="#fff" />}
        {entries.length > 0 && latestOutcome === 'reject' && <span style={{ fontSize: 9, fontWeight: 800 }}>✕</span>}
        {(entries.length === 0 || (!latestOutcome || latestOutcome === 'hold')) && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)' }}>{roundNumber}</span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{roundLabel}</span>
          {entries.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>}
          {latestOutcome && statusBadge(latestOutcome)}
        </div>

        {/* Existing entries — immutable */}
        {entries.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {open ? 'Hide' : 'Show'} {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </button>

            {open && entries.map((e, i) => (
              <div key={e.id || i} className="entry-card entry-card-locked" style={{ marginBottom: 8 }}>
                <div className="entry-meta">
                  <User size={11} />
                  <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>{e.interviewer_name || 'Unknown'}</span>
                  <span>·</span>
                  <Calendar size={11} />
                  <span>{fmt(e.created_at)}</span>
                  {e.score && <><span>·</span><Star size={11} /><span style={{ color: 'var(--warning)', fontWeight: 600 }}>{e.score}/10</span></>}
                  <span className="lock-badge" style={{ marginLeft: 'auto' }}><Lock size={9} /> Locked</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {e.feedback_text}
                </div>
                {e.outcome && <div style={{ marginTop: 8 }}>{statusBadge(e.outcome)}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Add entry form */}
        {!showForm ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add entry
          </button>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={14} color="var(--primary)" /> New Entry — {roundLabel}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Interviewer Name</label>
                <input className="input" value={form.interviewer_name}
                  onChange={e => setForm(f => ({ ...f, interviewer_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Interview Date</label>
                <input type="date" className="input" value={form.round_date}
                  onChange={e => setForm(f => ({ ...f, round_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Score (1–10)</label>
                <input type="number" className="input" min="1" max="10" placeholder="Optional"
                  value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} />
              </div>
              <div>
                <label className="label">Outcome</label>
                <select className="input" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                  <option value="">— Select —</option>
                  <option value="proceed">Proceed to next round</option>
                  <option value="hold">On hold</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Feedback / Comments <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea className="input" rows={4} placeholder="Detailed interview feedback, observations, and recommendation…"
                value={form.feedback_text} onChange={e => setForm(f => ({ ...f, feedback_text: e.target.value }))} />
            </div>
            {err && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={13} />{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Lock size={13} />Save & Lock Entry</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setErr(''); }}>Cancel</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={10} /> Once saved, this entry cannot be edited. Use "Add entry" to append additional notes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Final Decision component ─────────────────────────────────────────────────
function FinalDecision({ sessionId, currentStatus, onUpdated, isAdmin }) {
  const [form, setForm] = useState({ final_status: currentStatus?.final_status || 'pending', notes: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/candidates/${sessionId}/status`, form);
      setOpen(false); onUpdated();
    } finally { setSaving(false); }
  };

  const dotClass = currentStatus?.final_status === 'selected' ? 'done' : currentStatus?.final_status === 'rejected' ? '' : 'pending';
  const dotStyle = currentStatus?.final_status === 'rejected' ? { borderColor: 'var(--danger)', background: 'var(--danger)', color: '#fff' } : {};

  return (
    <div className="timeline-item">
      <div className={`timeline-dot ${dotClass}`} style={dotStyle}>
        {currentStatus?.final_status === 'selected' && <CheckCircle2 size={12} color="#fff" />}
        {currentStatus?.final_status === 'rejected' && <span style={{ fontSize: 9, fontWeight: 800 }}>✕</span>}
        {(!currentStatus?.final_status || currentStatus?.final_status === 'pending' || currentStatus?.final_status === 'on_hold') && <Star size={10} color="var(--text-3)" />}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Final Decision</span>
          {currentStatus?.final_status && statusBadge(currentStatus.final_status)}
        </div>

        {currentStatus?.notes && (
          <div className="entry-card entry-card-locked" style={{ marginBottom: 10 }}>
            <div className="entry-meta">
              <span>{fmtDate(currentStatus.updated_at)}</span>
              <span className="lock-badge" style={{ marginLeft: 'auto' }}><Lock size={9} /> Admin decision</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{currentStatus.notes}</div>
          </div>
        )}

        {isAdmin && (
          !open ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> {currentStatus?.final_status && currentStatus.final_status !== 'pending' ? 'Update decision' : 'Set final decision'}
            </button>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: 16, maxWidth: 480 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Set Final Decision</div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label className="label">Decision</label>
                  <select className="input" value={form.final_status} onChange={e => setForm(f => ({ ...f, final_status: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="selected">Selected ✓</option>
                    <option value="on_hold">On Hold</option>
                    <option value="rejected">Rejected ✗</option>
                  </select>
                </div>
                <div>
                  <label className="label">Notes / Remarks</label>
                  <textarea className="input" rows={3} placeholder="Reason for decision, next steps…"
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Decision'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CandidateDetail() {
  const { sessionId: id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const load = () => {
    setLoadError('');
    api.get(`/admin/candidates/${id}`)
      .then(r => setData(r.data))
      .catch(e => setLoadError(e.response?.data?.detail || 'Failed to load candidate. Please try again.'));
  };
  useEffect(() => { load(); }, [id]);

  const triggerEval = async () => {
    setEvaluating(true);
    try { await api.post(`/admin/candidates/${id}/evaluate`); await load(); }
    catch { alert('Evaluation failed.'); }
    finally { setEvaluating(false); }
  };

  const downloadResume = () => window.open(`/api/admin/candidates/${id}/resume`, '_blank');

  if (loadError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16 }}>
      <div style={{ color: 'var(--danger)', fontSize: 15, fontWeight: 500 }}>{loadError}</div>
      <button className="btn btn-secondary" onClick={load}>Try again</button>
    </div>
  );
  if (!data) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner-lg spinner" /></div>;

  const { candidate, session, evaluation, rounds = [], status_record } = data;

  // Group rounds by round_number
  const roundMap = {};
  (rounds || []).forEach(r => {
    if (!roundMap[r.round_number]) roundMap[r.round_number] = [];
    roundMap[r.round_number].push(r);
  });

  const ROUND_LABELS = { 2: 'Round 2 — Technical / HR Interview', 3: 'Round 3 — Panel / Senior Interview', 4: 'Round 4 — Leadership Interview' };
  const isEvaluated = session?.status === 'EVALUATED';

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'responses', label: 'Assessment Responses' },
    { key: 'lifecycle', label: `Lifecycle${rounds.length ? ` (${rounds.length})` : ''}` },
  ];

  return (
    <div>
      {/* Top bar */}
      <div className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/candidates')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, fontWeight: 400 }}>{candidate?.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{candidate?.reference_code} · {candidate?.role?.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {statusBadge(session?.status)}
          {candidate?.resume_path && (
            <button className="btn btn-secondary btn-sm" onClick={downloadResume}><Download size={14} /> Resume</button>
          )}
          {session?.status === 'SUBMITTED' && isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={triggerEval} disabled={evaluating}>
              {evaluating ? <><span className="spinner" style={{ width: 14, height: 14 }} />Evaluating…</> : <><Zap size={14} />Run AI Evaluation</>}
            </button>
          )}
        </div>
      </div>

      <div className="admin-content page-fade">
        {/* Score summary bar */}
        {evaluation && (
          <div className="card" style={{ marginBottom: 20, padding: '16px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              {[
                { label: 'Segment 1 — Knowledge', score: evaluation.seg1_score, detail: `${evaluation.seg1_correct}/${evaluation.seg1_total} correct` },
                { label: 'Segment 2 — Role Fit', score: evaluation.seg2_score, detail: `${evaluation.seg2_correct}/${evaluation.seg2_total} correct` },
                { label: 'Segment 3 — Scenario', score: evaluation.seg3_score, detail: 'AI scored' },
                { label: 'Overall Score', score: evaluation.overall_score, bold: true },
              ].map(({ label, score, detail, bold }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: bold ? 28 : 22, fontWeight: 700, color: scoreColor(score) }}>
                    {score != null ? `${score.toFixed(1)}%` : '—'}
                  </div>
                  {detail && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{detail}</div>}
                  {score != null && <ScoreBar value={score} color={scoreColor(score)} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '9px 18px', border: 'none', cursor: 'pointer', background: 'none',
                fontSize: 14, fontWeight: 500,
                color: activeTab === t.key ? 'var(--primary)' : 'var(--text-2)',
                borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Personal Information</span></div>
              <div className="card-body">
                {[
                  ['Full Name', candidate?.full_name],
                  ['Email', candidate?.email],
                  ['Mobile', candidate?.mobile],
                  ['Applied Role', candidate?.role?.name],
                  ['Experience', `${candidate?.years_of_experience} years`],
                  ['Current Organisation', candidate?.current_organization || '—'],
                  ['Qualification', candidate?.highest_qualification || '—'],
                  ['LinkedIn', candidate?.linkedin_url ? <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: 13 }}>View Profile</a> : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', flexShrink: 0, width: 160 }}>{k}</span>
                    <span style={{ fontSize: 14, color: 'var(--text)', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Assessment Timeline</span></div>
              <div className="card-body">
                {[
                  ['Registered', candidate?.created_at],
                  ['Instructions Accepted', session?.instructions_accepted_at],
                  ['Seg 1 Start', session?.seg1_start_time],
                  ['Seg 1 End', session?.seg1_end_time],
                  ['Seg 2 Start', session?.seg2_start_time],
                  ['Seg 2 End', session?.seg2_end_time],
                  ['Seg 3 Start', session?.seg3_start_time],
                  ['Seg 3 End', session?.seg3_end_time],
                  ['Submitted', session?.submitted_at],
                  ['Evaluated At', evaluation?.evaluated_at],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{k}</span>
                    <span style={{ fontSize: 13, color: v ? 'var(--text)' : 'var(--text-3)', fontFamily: v ? 'monospace' : 'inherit' }}>
                      {v ? fmt(v) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Responses tab */}
        {activeTab === 'responses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(seg => {
              const segResponses = (data.responses || []).filter(r => r.segment_number === seg);
              if (segResponses.length === 0) return (
                <div key={seg} className="card" style={{ padding: '24px', color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
                  Segment {seg} — No responses recorded
                </div>
              );
              return (
                <div key={seg} className="card">
                  <div className="card-header">
                    <span className="card-title">Segment {seg} — {seg === 1 ? 'Knowledge MCQ' : seg === 2 ? 'Role-Fit MCQ' : 'Scenario Response'}</span>
                    {seg < 3 && evaluation && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(seg === 1 ? evaluation.seg1_score : evaluation.seg2_score) }}>
                        {seg === 1 ? `${evaluation.seg1_correct}/${evaluation.seg1_total}` : `${evaluation.seg2_correct}/${evaluation.seg2_total}`} correct
                      </span>
                    )}
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {segResponses.map((r, i) => (
                      <div key={r.id || i} style={{ borderBottom: i < segResponses.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < segResponses.length - 1 ? 14 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
                          Q{i + 1}. {r.question_text}
                        </div>
                        {seg < 3 ? (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                              Answered: <strong style={{ color: 'var(--text)' }}>{r.selected_answer || '—'}</strong>
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                              Correct: <strong style={{ color: 'var(--success)' }}>{r.correct_answer}</strong>
                            </span>
                            {r.is_correct != null && (
                              <span className={`badge ${r.is_correct ? 'badge-green' : 'badge-red'}`}>
                                {r.is_correct ? '✓ Correct' : '✗ Wrong'}
                              </span>
                            )}
                            {r.rationale_text && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, width: '100%' }}><em>Rationale:</em> {r.rationale_text}</div>}
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, lineHeight: 1.6 }}>
                              {r.free_text_response || <em style={{ color: 'var(--text-3)' }}>No response</em>}
                            </div>
                            {evaluation?.seg3_details?.find(d => d.question_id === r.question_id) && (() => {
                              const det = evaluation.seg3_details.find(d => d.question_id === r.question_id);
                              return (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {['relevance', 'context', 'semantics'].map(k => det[k] != null && (
                                    <div key={k} style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                                      <div style={{ fontSize: 11, color: 'var(--primary)', textTransform: 'capitalize', fontWeight: 600 }}>{k}</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{det[k]}/10</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lifecycle tab */}
        {activeTab === 'lifecycle' && (
          <div style={{ maxWidth: 700 }}>
            {!isEvaluated && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--warning)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} />
                Candidate must complete AI evaluation before interview rounds can be recorded.
              </div>
            )}

            <div className="timeline">
              {/* Step 1 — Assessment */}
              <div className="timeline-item">
                <div className="timeline-dot done"><CheckCircle2 size={12} color="#fff" /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Round 1 — Online Assessment</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    Submitted {fmt(session?.submitted_at)}
                    {evaluation && <> · Score: <strong style={{ color: scoreColor(evaluation.overall_score) }}>{evaluation.overall_score?.toFixed(1)}%</strong></>}
                  </div>
                </div>
              </div>

              {/* Rounds 2, 3, 4 */}
              {[2, 3, 4].map(rn => (
                isEvaluated && (
                  <RoundSection
                    key={rn}
                    roundNumber={rn}
                    roundLabel={ROUND_LABELS[rn] || `Round ${rn} Interview`}
                    entries={roundMap[rn] || []}
                    sessionId={id}
                    currentUser={user}
                    onAdded={load}
                  />
                )
              ))}

              {/* Final decision */}
              {isEvaluated && (
                <FinalDecision
                  sessionId={id}
                  currentStatus={status_record}
                  onUpdated={load}
                  isAdmin={isAdmin}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
