import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import Timer from '../../components/Timer';
import { ChevronLeft, ChevronRight, CheckCircle2, Zap } from 'lucide-react';

const SEG_INFO = {
  1: { label: 'Knowledge Assessment', color: '#4F46E5', bg: '#EEF2FF' },
  2: { label: 'Role Competency', color: '#7C3AED', bg: '#F5F3FF' },
  3: { label: 'Scenario Response', color: '#D97706', bg: '#FFFBEB' },
};

export default function Assessment() {
  const { sessionToken: token } = useParams();
  const navigate = useNavigate();
  const [segData, setSegData] = useState(null);
  const [segment, setSegment] = useState(1);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const autoSaveRef = useRef();
  const expiredRef = useRef(false);

  const loadSeg = useCallback(async (seg) => {
    setLoading(true); expiredRef.current = false;
    try {
      const r = await api.get(`/candidate/segment/${token}/${seg}`);
      setSegData(r.data);
      setSegment(seg); setCurrent(0);
      const init = {};
      (r.data.saved_responses || []).forEach(s => {
        init[s.question_id] = s;
      });
      setAnswers(init);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadSeg(1); }, [loadSeg]);

  // Auto-save
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (segData && Object.keys(answers).length) {
        api.post(`/candidate/save-progress/${token}`, {
          segment: segment,
          responses: Object.values(answers),
        }).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [segData, answers, segment, token]);

  const setAnswer = (qid, patch) => setAnswers(a => ({ ...a, [qid]: { ...(a[qid] || { question_id: qid }), ...patch } }));

  const submitSeg = useCallback(async (fromTimer = false) => {
    if (submitting || (fromTimer && expiredRef.current)) return;
    if (fromTimer) expiredRef.current = true;
    setSubmitting(true);
    try {
      const responses = (segData?.questions || []).map(q => ({
        question_id: q.id,
        ...(answers[q.id] || {}),
      }));
      await api.post(`/candidate/submit-segment/${token}`, { segment, responses });
      if (segment < 3) { await loadSeg(segment + 1); }
      else { navigate('/thankyou'); }
    } catch (err) {
      alert(err.response?.data?.detail || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  }, [submitting, segData, segment, token, answers, loadSeg, navigate]);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div className="spinner-lg spinner" />
      <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Loading segment…</div>
    </div>
  );

  const questions = segData?.questions || [];
  const q = questions[current];
  const ans = q ? answers[q.id] || {} : {};
  const answered = Object.keys(answers).filter(k => {
    const a = answers[k];
    return a.selected_answer || a.free_text_response;
  }).length;
  const info = SEG_INFO[segment] || SEG_INFO[1];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="var(--primary)" />
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: 'var(--text)' }}>TalentLens</span>
          </div>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          {/* Segment steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[1,2,3].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className={`seg-dot ${s < segment ? 'done' : s === segment ? 'active' : ''}`}>
                  {s < segment ? <CheckCircle2 size={12} color="#fff" /> : s}
                </div>
                {s < 3 && <div style={{ width: 24, height: 2, background: s < segment ? 'var(--success)' : 'var(--border)', borderRadius: 1 }} />}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: info.color }}>{info.label}</span>
        </div>
        {segData?.timer_seconds && (
          <Timer
            totalSeconds={segData.timer_seconds}
            onExpire={() => submitSeg(true)}
          />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Q nav sidebar */}
        <div style={{ width: 80, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '16px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
            {answered}/{questions.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            {questions.map((q2, i) => {
              const a2 = answers[q2.id] || {};
              const isDone = a2.selected_answer || a2.free_text_response;
              return (
                <button key={q2.id}
                  className={`q-nav-btn ${i === current ? 'current' : isDone ? 'answered' : ''}`}
                  onClick={() => setCurrent(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {q && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ background: info.bg, color: info.color, borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                    Q {current + 1} / {questions.length}
                  </span>
                  {q.difficulty && (
                    <span className={`badge ${q.difficulty === 'high' ? 'badge-red' : q.difficulty === 'medium' ? 'badge-amber' : 'badge-green'}`}>
                      {q.difficulty}
                    </span>
                  )}
                </div>

                {/* Question text */}
                {segment < 3 ? (
                  <>
                    <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text)', lineHeight: 1.65, marginBottom: 24 }}>
                      {q.question_text}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {['A','B','C','D'].map(letter => (
                        <div key={letter}
                          className={`mcq-option ${ans.selected_answer === letter ? 'selected' : ''}`}
                          onClick={() => setAnswer(q.id, { selected_answer: letter })}>
                          <div className="mcq-letter">{letter}</div>
                          <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{q[`option_${letter.toLowerCase()}`]}</span>
                        </div>
                      ))}
                    </div>
                    {segment === 2 && (
                      <div style={{ marginTop: 20 }}>
                        <label className="label">Rationale (optional)</label>
                        <textarea className="input" rows={3} placeholder="Why did you choose this answer?"
                          value={ans.rationale_text || ''}
                          onChange={e => setAnswer(q.id, { rationale_text: e.target.value })} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Scenario</div>
                      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.7 }}>{q.scenario_text}</div>
                    </div>
                    <div>
                      <label className="label">Your Response <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <textarea className="input" rows={8}
                        placeholder="Describe your approach, reasoning, and what actions you would take…"
                        value={ans.free_text_response || ''}
                        onChange={e => setAnswer(q.id, { free_text_response: e.target.value })}
                        style={{ minHeight: 200 }} />
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Aim for a thorough, structured response. The AI evaluates relevance, context, and reasoning.</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        {/* Progress bar */}
        <div style={{ flex: 1, maxWidth: 240 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{answered} of {questions.length} answered</div>
          <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${questions.length ? (answered/questions.length)*100 : 0}%`, height: '100%', background: 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>
            <ChevronLeft size={16} /> Prev
          </button>
          {current < questions.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setCurrent(c => c + 1)}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-success" onClick={() => submitSeg(false)} disabled={submitting}>
              {submitting
                ? <><span className="spinner" style={{width:14,height:14}} />Submitting…</>
                : <><CheckCircle2 size={15} />{segment < 3 ? 'Submit & Next Segment' : 'Submit Assessment'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
