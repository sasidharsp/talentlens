/**
 * LiveMonitor — Real-time view of all active R1 assessment sessions
 * Route: /admin/live
 * Polls /admin/live-sessions every 5 seconds
 * Admin can view violation events and manually terminate any session
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Users, Shield, AlertTriangle, Eye, Smartphone,
  MonitorOff, Mic, Clock, CheckCircle, XCircle, Activity,
  Zap, BookOpen, Brain, Lightbulb, StopCircle,
} from 'lucide-react';
import api from '../../api/client';

// ── Score ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score = 100, size = 58 }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = ((score / 100) * circ).toFixed(1);
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1F2937" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{
          fill: color, fontSize: size * 0.25, fontWeight: 700,
          transform: `rotate(90deg) translate(0,-${size/2}px)`,
          transformOrigin: `${size/2}px ${size/2}px`, fontFamily: 'monospace',
        }}>
        {score}
      </text>
    </svg>
  );
}

const VIOL_ICONS = {
  phone_detected:    { Icon: Smartphone,    c: '#EF4444' },
  gaze_away:         { Icon: Eye,           c: '#F59E0B' },
  head_turn:         { Icon: Eye,           c: '#F59E0B' },
  face_not_detected: { Icon: Eye,           c: '#EF4444' },
  multiple_faces:    { Icon: Users,         c: '#DC2626' },
  tab_switch:        { Icon: MonitorOff,    c: '#EF4444' },
  audio_detected:    { Icon: Mic,           c: '#8B5CF6' },
  admin_terminated:  { Icon: StopCircle,    c: '#EF4444' },
  default:           { Icon: AlertTriangle, c: '#F59E0B' },
};

const SEG_ICONS = [null, BookOpen, Brain, Lightbulb];

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

function elapsed(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ── Candidate card ─────────────────────────────────────────────────────────
function CandidateCard({ session, onNavigate, onTerminate }) {
  const [confirming, setConfirming] = useState(false);
  const [terminating, setTerminating] = useState(false);

  const score        = session.integrity_score ?? 100;
  const isTerminated = session.proctoring_status === 'terminated';
  const isActive     = !isTerminated && session.status === 'IN_PROGRESS';
  const borderColor  = isTerminated ? '#EF444440'
    : score >= 80 ? '#10B98130' : score >= 50 ? '#F59E0B50' : '#EF444450';
  const SegIcon = SEG_ICONS[session.current_segment] || BookOpen;

  const handleTerminate = async () => {
    if (!confirming) { setConfirming(true); return; }
    setTerminating(true);
    try {
      await onTerminate(session.session_id);
    } finally { setTerminating(false); setConfirming(false); }
  };

  return (
    <div style={{
      background: '#0F172A', border: `1px solid ${borderColor}`,
      borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Status strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: isTerminated ? '#EF4444' : score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
        {/* Thumbnail */}
        <div style={{
          width: 64, height: 48, borderRadius: 8, overflow: 'hidden',
          background: '#1E293B', flexShrink: 0,
          border: '1px solid #334155', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => onNavigate(session.session_id)}>
          {session.latest_thumbnail
            ? <img src={session.latest_thumbnail} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            : <Eye size={20} color="#334155" />}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onNavigate(session.session_id)}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#F1F5F9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.full_name}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {session.reference_code} · {session.role}
          </div>
          <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {isTerminated ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#EF4444',
                background: '#EF444420', border: '1px solid #EF444440',
                borderRadius: 20, padding: '2px 8px',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <XCircle size={9} /> Terminated
              </span>
            ) : isActive ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#10B981',
                background: '#10B98115', border: '1px solid #10B98130',
                borderRadius: 20, padding: '2px 8px',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity size={9} style={{ animation: 'livePulse 1.5s infinite' }} /> Live
              </span>
            ) : null}
            {isActive && (
              <span style={{ fontSize: 10, color: '#94A3B8',
                display: 'flex', alignItems: 'center', gap: 3 }}>
                <SegIcon size={10} color="#6366F1" /> Seg {session.current_segment}
              </span>
            )}
          </div>
        </div>

        <ScoreRing score={score} size={54} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#1E293B', borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 16, fontWeight: 700,
            color: (session.violation_count||0) === 0 ? '#10B981'
              : (session.violation_count||0) < 5 ? '#F59E0B' : '#EF4444' }}>
            {session.violation_count || 0}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>VIOLATIONS</div>
        </div>
        <div style={{ background: '#1E293B', borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1',
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} color="#475569" /> {elapsed(session.started_at)}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>ELAPSED</div>
        </div>
      </div>

      {/* Last violation */}
      {session.last_event_type && session.last_event_type !== 'evidence_snapshot' && session.last_event_type !== 'session_start' && (() => {
        const { Icon, c } = VIOL_ICONS[session.last_event_type] || VIOL_ICONS.default;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', background: '#1E293B', borderRadius: 8, fontSize: 11 }}>
            <Icon size={12} color={c} />
            <span style={{ flex: 1, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.last_event_type.replace(/_/g, ' ')}
            </span>
            <span style={{ color: '#475569', fontSize: 10, flexShrink: 0 }}>
              {timeAgo(session.last_event_at)}
            </span>
          </div>
        );
      })()}

      {/* Terminate button */}
      {isActive && (
        <button onClick={handleTerminate} disabled={terminating}
          style={{
            width: '100%', padding: '7px', borderRadius: 8, border: 'none',
            cursor: terminating ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: confirming ? '#EF4444' : '#EF444420',
            color: confirming ? '#fff' : '#EF4444',
            transition: 'all 0.2s',
          }}>
          <StopCircle size={13} />
          {terminating ? 'Terminating…' : confirming ? 'Confirm terminate session?' : 'Terminate session'}
        </button>
      )}
      {confirming && !terminating && (
        <button onClick={() => setConfirming(false)}
          style={{ width:'100%', padding:'5px', background:'transparent',
            border:'none', color:'#64748B', fontSize:11, cursor:'pointer' }}>
          Cancel
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LiveMonitor() {
  const navigate     = useNavigate();
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [lastRefresh,setLastRefresh]= useState(null);
  const [filter,     setFilter]     = useState('all');
  const intervalRef  = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/live-sessions');
      setSessions(data.sessions || []);
      setLastRefresh(new Date());
    } catch (e) { console.error('LiveMonitor', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetch]);

  const terminate = async (sessionId) => {
    await api.post(`/admin/candidates/${sessionId}/terminate`, { reason: 'Manually terminated by admin' });
    fetch();
  };

  const live       = sessions.filter(s => !['terminated','SUBMITTED'].includes(s.proctoring_status) && s.status === 'IN_PROGRESS').length;
  const flagged    = sessions.filter(s => (s.integrity_score ?? 100) < 80).length;
  const terminated = sessions.filter(s => s.proctoring_status === 'terminated').length;
  const avgScore   = sessions.length
    ? Math.round(sessions.reduce((a,s) => a + (s.integrity_score ?? 100), 0) / sessions.length)
    : 100;

  const filtered = sessions.filter(s => {
    if (filter === 'live')       return s.status === 'IN_PROGRESS' && s.proctoring_status !== 'terminated';
    if (filter === 'flagged')    return (s.integrity_score ?? 100) < 80;
    if (filter === 'terminated') return s.proctoring_status === 'terminated';
    return true;
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'60vh', gap:12, color:'#64748B' }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }} />
      Loading live sessions…
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ background:'#020817', minHeight:'100vh', padding:'24px 28px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#F1F5F9', margin:0,
            display:'flex', alignItems:'center', gap:10 }}>
            <Activity size={22} color="#10B981" />
            Live Assessment Monitor
          </h1>
          <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>
            Auto-refreshes every 5s
            {lastRefresh && ` · Last update: ${lastRefresh.toLocaleTimeString()}`}
          </div>
        </div>
        <button onClick={fetch}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
            background:'#1E293B', border:'1px solid #334155', borderRadius:8,
            color:'#CBD5E1', cursor:'pointer', fontSize:13 }}>
          <RefreshCw size={14} /> Refresh now
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Live now',   value:live,       color:'#10B981', Icon:Activity       },
          { label:'Avg score',  value:`${avgScore}%`, color:'#6366F1', Icon:Shield     },
          { label:'Flagged',    value:flagged,    color:'#F59E0B', Icon:AlertTriangle   },
          { label:'Terminated', value:terminated, color:'#EF4444', Icon:XCircle         },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{ background:'#0F172A', border:'1px solid #1E293B',
            borderRadius:12, padding:'16px 20px',
            display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:40, height:40, borderRadius:10,
              background:`${color}18`, display:'flex', alignItems:'center',
              justifyContent:'center', flexShrink:0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:12, color:'#475569' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[
          { key:'all',        label:`All (${sessions.length})`   },
          { key:'live',       label:`Live (${live})`             },
          { key:'flagged',    label:`⚠ Flagged (${flagged})`     },
          { key:'terminated', label:`Terminated (${terminated})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding:'6px 14px', borderRadius:8, fontSize:13, cursor:'pointer',
              fontWeight: filter === key ? 600 : 400,
              border:`1px solid ${filter === key ? '#6366F1' : '#334155'}`,
              background: filter === key ? '#6366F120' : 'transparent',
              color: filter === key ? '#818CF8' : '#64748B' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 40px', color:'#334155' }}>
          <Zap size={40} style={{ marginBottom:12, opacity:0.4 }} />
          <div style={{ fontSize:16, fontWeight:600, color:'#475569', marginBottom:6 }}>
            {filter === 'live' ? 'No candidates currently in assessment' : 'No sessions found'}
          </div>
          <div style={{ fontSize:13, color:'#334155' }}>
            This panel updates automatically every 5 seconds
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:16 }}>
        {filtered.map(s => (
          <CandidateCard key={s.session_id} session={s}
            onNavigate={id => navigate(`/admin/candidates/${id}`)}
            onTerminate={terminate}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
