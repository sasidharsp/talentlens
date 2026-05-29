import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import ProctoringWrapper from '../../components/ProctoringWrapper';
import Timer from '../../components/Timer';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { ChevronRight, Award, Send, CheckCircle2, Clock } from 'lucide-react';

const QUESTION_SECONDS = 5 * 60; // 5 minutes per question

export default function Round2Assessment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.post(`/round2/start/${token}`)
      .then(r => {
        setQuestions(r.data.questions || []);
        const init = {};
        (r.data.questions || []).forEach(q => { init[q.question_id] = q.existing_response || ''; });
        setResponses(init);
        setLoading(false);
      })
      .catch(e => {
        alert(e.response?.data?.detail || 'Failed to load assessment.');
        navigate('/round2');
      });
  }, [token]);

  const saveCurrentAndNext = useCallback(async () => {
    const q = questions[current];
    if (!q) return;
    // Auto-save current response
    await api.post(`/round2/save-response/${token}`, {
      question_id: q.question_id,
      response: responses[q.question_id] || '',
    }).catch(() => {});

    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      submitAll();
    }
  }, [current, questions, responses, token]);

  const submitAll = async () => {
    setSubmitting(true);
    const allResponses = questions.map(q => ({
      question_id: q.question_id,
      response: responses[q.question_id] || '',
    }));
    try {
      await api.post(`/round2/submit/${token}`, { responses: allResponses });
      navigate('/round2/thankyou');
    } catch(e) {
      alert(e.response?.data?.detail || 'Submission failed.');
      setSubmitting(false);
    }
  };

  const handleTerminate = useCallback((reason) => {
    api.post(`/round2/terminate/${token}`, { reason }).catch(() => {});
    navigate('/round2/thankyou?terminated=true');
  }, [token]);

  const handleTimerEnd = useCallback(() => {
    // Auto-advance when time runs out
    saveCurrentAndNext();
  }, [saveCurrentAndNext]);

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div className="spinner-lg spinner" />
      <div style={{ fontSize:14, color:'var(--text-2)' }}>Loading Round 2 assessment…</div>
    </div>
  );

  const q = questions[current];
  if (!q) return null;
  const progress = ((current) / questions.length) * 100;
  const isLast = current === questions.length - 1;

  return (
    <ProctoringWrapper token={token} onTerminate={handleTerminate}
      logEvent={(type, details) => api.post(`/round2/proctor-event/${token}`, { event_type: type, details }).catch(() => {})}>
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'var(--bg)' }}>

        {/* Top bar */}
        <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Award size={18} color="#7C3AED" />
            <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:'var(--text)' }}>Round 2 Assessment</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ fontSize:13, color:'var(--text-2)' }}>
              Question <strong>{current + 1}</strong> of <strong>{questions.length}</strong>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--surface-2)', borderRadius:8, padding:'4px 12px' }}>
              <Clock size={13} color="#7C3AED" />
              <Timer
                key={`${token}-${current}`}
                durationSeconds={QUESTION_SECONDS}
                onExpire={handleTimerEnd}
              />
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:4, background:'var(--surface-2)', flexShrink:0 }}>
          <div style={{ height:'100%', background:'#7C3AED', width:`${((current+1)/questions.length)*100}%`, transition:'width 0.5s ease' }} />
        </div>

        {/* Question + answer */}
        <div style={{ flex:1, overflow:'auto', display:'flex', justifyContent:'center', padding:'32px 24px' }}>
          <div style={{ width:'100%', maxWidth:720 }}>
            {/* Question number badge */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15, flexShrink:0 }}>
                {current + 1}
              </div>
              <div style={{ height:1, flex:1, background:'var(--border)' }} />
              <span style={{ fontSize:12, color:'var(--text-3)' }}>5 min per question</span>
            </div>

            {/* Scenario */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'24px 28px', marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Scenario</div>
              <div style={{ fontSize:16, color:'var(--text)', lineHeight:1.75 }}>
                {renderMarkdown(q.scenario_text)}
              </div>
            </div>

            {/* Response textarea */}
            <div>
              <label className="label" style={{ marginBottom:8 }}>
                Your Response
                <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:400, marginLeft:6 }}>— be structured and specific, draw from your experience</span>
              </label>
              <textarea className="input" rows={10}
                placeholder="Structure your answer: situation → analysis → action → outcome…"
                value={responses[q.question_id] || ''}
                onChange={e => setResponses(r => ({ ...r, [q.question_id]: e.target.value }))}
                style={{ minHeight:220, resize:'vertical', lineHeight:1.7 }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6, fontSize:12, color:'var(--text-3)' }}>
                <span>{(responses[q.question_id] || '').length} characters</span>
                <span>{isLast ? 'This is the final question' : `${questions.length - current - 1} question(s) remaining`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div style={{ background:'var(--surface)', borderTop:'1px solid var(--border)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontSize:13, color:'var(--text-3)' }}>
            Progress: {current + 1} / {questions.length}
          </div>
          <button className="btn btn-lg" disabled={submitting}
            onClick={saveCurrentAndNext}
            style={{ gap:10, background:'#7C3AED', color:'#fff', border:'none', minWidth:180, justifyContent:'center' }}>
            {submitting
              ? <><span className="spinner" style={{width:16,height:16,borderTopColor:'#fff'}}/>Submitting…</>
              : isLast
                ? <><Send size={16}/> Submit Round 2</>
                : <>Next Question <ChevronRight size={16}/></>}
          </button>
        </div>
      </div>
    </ProctoringWrapper>
  );
}
