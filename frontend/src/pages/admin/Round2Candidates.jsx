import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Award, TrendingUp, TrendingDown, Minus, ArrowRight, Users } from 'lucide-react';
import { renderMarkdown } from '../../utils/renderMarkdown';

const statusBadge = s => {
  const m = { INVITED:'badge-sky', IN_PROGRESS:'badge-amber', SUBMITTED:'badge-indigo', EVALUATED:'badge-green' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s}</span>;
};
const verdictColor = v => ({ HIRE:'var(--success)', STRONG_HOLD:'var(--primary)', HOLD:'var(--warning)', REJECT:'var(--danger)' }[v] || 'var(--text-2)');

export default function Round2Candidates() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // detail view
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/round2/candidates').then(r => { setItems(r.data.items||[]); setTotal(r.data.total||0); setLoading(false); });
  }, []);

  const openDetail = async (item) => {
    setSelected(item);
    const r = await api.get(`/admin/round2/candidates/${item.r2_session_id}`);
    setDetail(r.data);
  };

  const scoreColor = s => s==null?'var(--text-3)':s>=70?'var(--success)':s>=50?'var(--warning)':'var(--danger)';
  const progression = (r1, r2) => {
    if (r1==null||r2==null) return null;
    const diff = r2-r1;
    if (Math.abs(diff)<2) return <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--text-2)',fontSize:12}}><Minus size={12}/> Flat</span>;
    return diff>0
      ? <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--success)',fontSize:12,fontWeight:600}}><TrendingUp size={12}/>+{diff.toFixed(1)}%</span>
      : <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--danger)',fontSize:12,fontWeight:600}}><TrendingDown size={12}/>{diff.toFixed(1)}%</span>;
  };

  if (loading) return <div style={{padding:60,textAlign:'center'}}><div className="spinner-lg spinner"/></div>;

  return (
    <div>
      <div className="admin-topbar">
        <div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,fontWeight:400,display:'flex',alignItems:'center',gap:8}}>
            <Award size={20} color="#7C3AED"/> Round 2 Candidates
          </div>
          <div style={{fontSize:13,color:'var(--text-2)'}}>{total} invited · {items.filter(i=>i.r2_status==='EVALUATED').length} evaluated</div>
        </div>
      </div>

      <div className="admin-content page-fade" style={{display:'grid',gridTemplateColumns:selected?'1fr 480px':'1fr',gap:20}}>
        {/* List */}
        <div>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Candidate</th><th>Role</th><th>Status</th><th>R1 Score</th><th>R2 Score</th><th>Trend</th><th>Verdict</th><th></th></tr></thead>
              <tbody>
                {items.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:'40px 24px',color:'var(--text-3)',fontSize:14}}>
                    No Round 2 candidates yet. Invite candidates from their individual candidate detail pages.
                  </td></tr>
                ) : items.map(item=>(
                  <tr key={item.r2_session_id} style={{cursor:'pointer',background:selected?.r2_session_id===item.r2_session_id?'var(--primary-light)':'transparent'}}
                    onClick={()=>openDetail(item)}>
                    <td>
                      <div style={{fontWeight:500}}>{item.full_name}</div>
                      <div style={{fontSize:11,color:'var(--text-3)',fontFamily:'monospace'}}>{item.reference_code}</div>
                    </td>
                    <td style={{fontSize:13,color:'var(--text-2)'}}>{item.role}</td>
                    <td>{statusBadge(item.r2_status)}</td>
                    <td style={{fontWeight:600,color:scoreColor(item.r1_score)}}>{item.r1_score!=null?`${item.r1_score.toFixed(1)}%`:'—'}</td>
                    <td style={{fontWeight:600,color:scoreColor(item.r2_score)}}>{item.r2_score!=null?`${item.r2_score.toFixed(1)}%`:'—'}</td>
                    <td>{progression(item.r1_score,item.r2_score)}</td>
                    <td>{item.r2_verdict?<span style={{fontWeight:700,fontSize:12,color:verdictColor(item.r2_verdict)}}>{item.r2_verdict}</span>:'—'}</td>
                    <td><ArrowRight size={14} color="var(--text-3)"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && detail && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={()=>{setSelected(null);setDetail(null);}}>
              ← Close
            </button>

            {/* Score comparison */}
            <div className="card" style={{padding:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <Users size={15}/> {detail.candidate.full_name}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div style={{background:'var(--surface-2)',borderRadius:10,padding:'12px 14px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Round 1</div>
                  <div style={{fontSize:28,fontWeight:800,color:scoreColor(detail.r1_comparison.r1_score)}}>
                    {detail.r1_comparison.r1_score!=null?`${detail.r1_comparison.r1_score.toFixed(1)}%`:'—'}
                  </div>
                  {detail.r1_comparison.r1_verdict&&<span style={{fontSize:11,fontWeight:700,color:verdictColor(detail.r1_comparison.r1_verdict)}}>{detail.r1_comparison.r1_verdict}</span>}
                </div>
                <div style={{background:detail.evaluation?'var(--primary-light)':'var(--surface-2)',borderRadius:10,padding:'12px 14px',textAlign:'center',border:detail.evaluation?'1px solid var(--primary-border)':'none'}}>
                  <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Round 2</div>
                  <div style={{fontSize:28,fontWeight:800,color:scoreColor(detail.evaluation?.overall_score)}}>
                    {detail.evaluation?.overall_score!=null?`${detail.evaluation.overall_score.toFixed(1)}%`:'—'}
                  </div>
                  {detail.evaluation?.ai_recommendation?.recommendation&&(
                    <span style={{fontSize:11,fontWeight:700,color:verdictColor(detail.evaluation.ai_recommendation.recommendation)}}>
                      {detail.evaluation.ai_recommendation.recommendation}
                    </span>
                  )}
                </div>
              </div>
              {progression(detail.r1_comparison.r1_score, detail.evaluation?.overall_score) && (
                <div style={{textAlign:'center',fontSize:13}}>
                  Progression: {progression(detail.r1_comparison.r1_score, detail.evaluation?.overall_score)}
                </div>
              )}
            </div>

            {/* AI Recommendation */}
            {detail.evaluation?.ai_recommendation && (() => {
              const rec = detail.evaluation.ai_recommendation;
              const colors = {HIRE:'var(--success)',STRONG_HOLD:'var(--primary)',HOLD:'var(--warning)',REJECT:'var(--danger)'};
              const color = colors[rec.recommendation]||'var(--text)';
              return (
                <div className="card" style={{padding:20}}>
                  <div style={{fontWeight:800,fontSize:20,color,marginBottom:6}}>{rec.recommendation}</div>
                  <div style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>Confidence: <strong style={{color:rec.confidence==='HIGH'?'var(--success)':rec.confidence==='LOW'?'var(--danger)':'var(--warning)'}}>{rec.confidence}</strong></div>
                  <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:12,fontStyle:'italic'}}>"{rec.summary}"</div>
                  {rec.r1_vs_r2&&<div style={{fontSize:13,color:'var(--text)',background:'var(--surface-2)',borderRadius:8,padding:'8px 12px',marginBottom:12}}>📊 {rec.r1_vs_r2}</div>}
                  {rec.final_recommendation_rationale&&<div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6}}>{rec.final_recommendation_rationale}</div>}
                </div>
              );
            })()}

            {/* Responses */}
            {detail.responses.length>0&&(
              <div className="card" style={{padding:20}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Responses</div>
                {detail.responses.map((resp,i)=>{
                  const evalD = detail.evaluation?.question_details?.find(d=>d.question_id===resp.question_id);
                  return (
                    <div key={i} style={{borderBottom:'1px solid var(--border)',paddingBottom:14,marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#7C3AED',marginBottom:6}}>Q{resp.question_order}</div>
                      <div style={{fontSize:12,color:'var(--text-2)',marginBottom:8,lineHeight:1.5}}>{renderMarkdown(resp.scenario_text)}</div>
                      <div style={{fontSize:13,color:'var(--text)',background:'var(--surface-2)',borderRadius:8,padding:'8px 12px',lineHeight:1.6,marginBottom:8}}>
                        {resp.free_text_response||<em style={{color:'var(--text-3)'}}>No response</em>}
                      </div>
                      {evalD&&!evalD.pending_review&&(
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#7C3AED',background:'#F5F3FF',padding:'2px 8px',borderRadius:6,border:'1px solid #DDD6FE'}}>{evalD.score}/10</span>
                          {evalD.gaps?.slice(0,2).map((g,j)=><span key={j} style={{fontSize:11,color:'var(--danger)',background:'var(--danger-light)',padding:'2px 8px',borderRadius:6,border:'1px solid var(--danger-border)'}}>Gap: {g}</span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Force evaluate button */}
            {detail.r2_session.status==='SUBMITTED'&&(
              <button className="btn btn-primary" onClick={async()=>{
                await api.post(`/admin/round2/candidates/${selected.r2_session_id}/evaluate`);
                openDetail(selected);
              }}>Evaluate Now</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
