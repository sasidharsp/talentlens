/**
 * EyeProctor.jsx — Strict real-time eye/gaze proctoring via MediaPipe Face Mesh
 *
 * Detection:
 *  • gaze_away        – iris deviates from screen center (H or V)
 *  • head_turn        – head rotated sideways (nose offset from face center)
 *  • face_not_detected – no face visible for > 2s
 *  • multiple_faces   – more than one person detected
 *  • tab_switch       – document.visibilitychange
 *  • fullscreen_exit  – user exits required fullscreen
 *
 * Props:
 *  token         {string}   – session token for backend logging
 *  apiClient     {axios}    – configured axios instance
 *  apiPath       {string}   – endpoint path e.g. "/round2/proctor-event"
 *  onTerminate   {fn}       – called when violation count hits AUTO_TERMINATE_AT
 *  requireFullscreen {bool} – whether to enforce fullscreen (default: true)
 *  children      {node}     – the assessment UI wrapped by this component
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Eye, EyeOff, Users, MonitorOff, Maximize2 } from 'lucide-react';

// ─── MediaPipe Face Mesh landmark indices ────────────────────────────────────
const LM = {
  L_OUTER:  33,   L_INNER: 133,  L_TOP: 159, L_BOT: 145, L_IRIS: 468,
  R_OUTER: 263,   R_INNER: 362,  R_TOP: 386, R_BOT: 374, R_IRIS: 473,
  NOSE:      1,
  F_LEFT:  234,   F_RIGHT: 454,
};

// ─── Gaze math ───────────────────────────────────────────────────────────────
function calcGaze(lm) {
  const safe = (a, b) => Math.abs(b - a) < 1e-5 ? 1e-5 : b - a;

  // Horizontal iris ratio: 0 = extreme right, 0.5 = center, 1 = extreme left
  const lh = (lm[LM.L_IRIS].x - lm[LM.L_OUTER].x) / safe(lm[LM.L_OUTER].x, lm[LM.L_INNER].x);
  const rh = (lm[LM.R_IRIS].x - lm[LM.R_OUTER].x) / safe(lm[LM.R_OUTER].x, lm[LM.R_INNER].x);
  const hGaze = (lh + rh) / 2;

  // Vertical iris ratio: 0 = top, 0.5 = center, 1 = bottom
  const lv = (lm[LM.L_IRIS].y - lm[LM.L_TOP].y) / safe(lm[LM.L_TOP].y, lm[LM.L_BOT].y);
  const rv = (lm[LM.R_IRIS].y - lm[LM.R_TOP].y) / safe(lm[LM.R_TOP].y, lm[LM.R_BOT].y);
  const vGaze = (lv + rv) / 2;

  // Head turn: nose tip offset from face horizontal center
  const faceW = lm[LM.F_RIGHT].x - lm[LM.F_LEFT].x;
  const faceCx = (lm[LM.F_LEFT].x + lm[LM.F_RIGHT].x) / 2;
  const noseOff = (lm[LM.NOSE].x - faceCx) / (faceW || 1);

  return { hGaze, vGaze, noseOff };
}

// ─── Thresholds ──────────────────────────────────────────────────────────────
const T = {
  H:           0.13,  // |hGaze − 0.5| > this → eyes left/right
  V_UP:        0.09,  // vGaze < 0.5 − this → eyes up
  V_DOWN:      0.17,  // vGaze > 0.5 + this → eyes down
  HEAD:        0.11,  // |noseOff| > this → head turned away
  GRACE:       3,     // consecutive bad frames before event fires
  COOLDOWN:    8000,  // ms before re-logging same event type
  FPS:         2,     // analysis rate (2fps = low CPU)
  MAX_VIOL:    15,    // violations before auto-terminate
};

// ─── Violation metadata ──────────────────────────────────────────────────────
const VIOLS = {
  gaze_away:        { label: 'Looking away from screen',   color: '#F59E0B', Icon: Eye },
  head_turn:        { label: 'Head turned sideways',       color: '#F59E0B', Icon: Eye },
  face_not_detected:{ label: 'Face not visible',           color: '#EF4444', Icon: EyeOff },
  multiple_faces:   { label: 'Multiple people detected',   color: '#EF4444', Icon: Users },
  tab_switch:       { label: 'Switched tabs / minimised',  color: '#EF4444', Icon: MonitorOff },
  fullscreen_exit:  { label: 'Exited fullscreen',          color: '#8B5CF6', Icon: Maximize2 },
};

// ─── Load MediaPipe Face Mesh from CDN ───────────────────────────────────────
const MEDIAPIPE_VERSION = '0.4.1633559619';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_VERSION}`;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initFaceMesh(onResults) {
  await loadScript(`${CDN}/face_mesh.js`);

  const fm = new window.FaceMesh({
    locateFile: f => `${CDN}/${f}`,
  });
  fm.setOptions({
    maxNumFaces:      2,
    refineLandmarks:  true,   // enables iris tracking (landmarks 468–477)
    minDetectionConfidence: 0.6,
    minTrackingConfidence:  0.6,
  });
  fm.onResults(onResults);
  await fm.initialize();
  return fm;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EyeProctor({
  token,
  apiClient,
  apiPath,
  onTerminate,
  requireFullscreen = true,
  children,
}) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const faceMeshRef   = useRef(null);
  const streamRef     = useRef(null);
  const animRef       = useRef(null);
  const lastAnalyzeRef= useRef(0);
  const badFrames     = useRef({});   // { type: count }
  const lastLoggedRef = useRef({});   // { type: timestamp }
  const violCountRef  = useRef(0);

  const [status, setStatus]       = useState('loading'); // loading | ready | error
  const [warning, setWarning]     = useState(null);      // { type, label, color, Icon } | null
  const [violCount, setViolCount] = useState(0);
  const [needsFS, setNeedsFS]     = useState(false);
  const [modelLoading, setModelLoading] = useState(true);

  // ── Log to backend ──────────────────────────────────────────────────────
  const logEvent = useCallback((type, extra = {}) => {
    const now = Date.now();
    if ((lastLoggedRef.current[type] || 0) + T.COOLDOWN > now) return; // cooldown
    lastLoggedRef.current[type] = now;

    violCountRef.current += 1;
    setViolCount(violCountRef.current);

    if (apiClient && apiPath && token) {
      apiClient.post(`${apiPath}/${token}`, {
        event_type: type,
        timestamp: new Date().toISOString(),
        violation_number: violCountRef.current,
        ...extra,
      }).catch(() => {});
    }

    // Show warning banner
    const meta = VIOLS[type] || { label: type, color: '#EF4444', Icon: AlertTriangle };
    setWarning({ type, ...meta });
    setTimeout(() => setWarning(w => w?.type === type ? null : w), 4000);

    // Auto-terminate
    if (violCountRef.current >= T.MAX_VIOL && onTerminate) {
      onTerminate(`Auto-terminated: ${violCountRef.current} proctoring violations`);
    }
  }, [token, apiClient, apiPath, onTerminate]);

  // ── Face Mesh results handler ───────────────────────────────────────────
  const handleResults = useCallback(results => {
    const faces = results.multiFaceLandmarks || [];

    if (faces.length === 0) {
      badFrames.current.face = (badFrames.current.face || 0) + 1;
      badFrames.current.gaze = 0;
      badFrames.current.head = 0;
      badFrames.current.multi = 0;
      if (badFrames.current.face >= T.GRACE) {
        logEvent('face_not_detected');
        badFrames.current.face = 0;
      }
      return;
    }
    badFrames.current.face = 0;

    // Multiple faces
    if (faces.length > 1) {
      badFrames.current.multi = (badFrames.current.multi || 0) + 1;
      if (badFrames.current.multi >= T.GRACE) {
        logEvent('multiple_faces', { face_count: faces.length });
        badFrames.current.multi = 0;
      }
    } else {
      badFrames.current.multi = 0;
    }

    const lm = faces[0];
    if (lm.length < 478) return; // iris landmarks not available yet

    const { hGaze, vGaze, noseOff } = calcGaze(lm);

    // Draw debug overlay on canvas (small, top-right)
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw iris dots
      const scaleX = canvas.width, scaleY = canvas.height;
      const drawDot = (idx, color) => {
        const p = lm[idx];
        ctx.beginPath();
        ctx.arc(p.x * scaleX, p.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };
      // Key landmarks
      [LM.L_OUTER, LM.L_INNER, LM.R_OUTER, LM.R_INNER].forEach(i => drawDot(i, 'rgba(0,200,255,0.6)'));
      drawDot(LM.L_IRIS, '#00FF88');
      drawDot(LM.R_IRIS, '#00FF88');
      drawDot(LM.NOSE, '#FF8800');
    }

    // ── Gaze check ─────────────────────────────────────────────────────────
    const hOff = Math.abs(hGaze - 0.5);
    const vOff = hGaze < 0.5 - T.V_UP ? 'up' : hGaze > 0.5 + T.V_DOWN ? 'down' : null;
    const lookingAway = hOff > T.H || vOff !== null;
    const headTurned  = Math.abs(noseOff) > T.HEAD;

    if (lookingAway || headTurned) {
      const key = headTurned && !lookingAway ? 'head' : 'gaze';
      badFrames.current[key] = (badFrames.current[key] || 0) + 1;
      if (badFrames.current[key] >= T.GRACE) {
        const dir = hGaze < 0.5 - T.H ? 'right' : hGaze > 0.5 + T.H ? 'left'
                  : vOff === 'up' ? 'up' : vOff === 'down' ? 'down'
                  : noseOff > 0 ? 'right' : 'left';
        logEvent(headTurned && !lookingAway ? 'head_turn' : 'gaze_away', {
          direction: dir,
          h_gaze: hGaze.toFixed(3),
          v_gaze: vGaze.toFixed(3),
          nose_offset: noseOff.toFixed(3),
        });
        badFrames.current[key] = 0;
      }
    } else {
      badFrames.current.gaze = 0;
      badFrames.current.head = 0;
    }
  }, [logEvent]);

  // ── Camera + MediaPipe init ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let fm = null;

    (async () => {
      try {
        setModelLoading(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        video.muted = true;
        video.setAttribute('muted', '');
        video.srcObject = stream;
        await new Promise(res => { video.onloadedmetadata = res; });
        await video.play();

        fm = await initFaceMesh(handleResults);
        if (cancelled) return;
        faceMeshRef.current = fm;
        setModelLoading(false);
        setStatus('ready');

        // ── Analysis loop at T.FPS ────────────────────────────────────────
        const interval = 1000 / T.FPS;
        const loop = async ts => {
          if (cancelled) return;
          if (ts - lastAnalyzeRef.current >= interval) {
            lastAnalyzeRef.current = ts;
            if (videoRef.current?.readyState >= 2) {
              await faceMeshRef.current?.send({ image: videoRef.current }).catch(() => {});
            }
          }
          animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          console.error('EyeProctor init error:', err);
          setStatus('error');
          setModelLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [handleResults]);

  // ── Tab visibility ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.hidden) logEvent('tab_switch');
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [logEvent]);

  // ── Fullscreen enforcement ──────────────────────────────────────────────
  useEffect(() => {
    if (!requireFullscreen) return;
    const requestFS = () => {
      document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const handleFSChange = () => {
      if (!document.fullscreenElement) {
        setNeedsFS(true);
        logEvent('fullscreen_exit');
      } else {
        setNeedsFS(false);
      }
    };
    // Request on mount
    requestFS();
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, [requireFullscreen, logEvent]);

  // ── Severity colour ─────────────────────────────────────────────────────
  const severityColor = violCount === 0 ? '#10B981'
    : violCount < 5  ? '#F59E0B'
    : violCount < 10 ? '#EF4444'
    : '#7F1D1D';

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>

      {/* Hidden analysis video */}
      <video
        ref={videoRef}
        autoPlay muted playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 320, height: 240 }}
      />

      {/* Debug overlay canvas — small, top-right corner */}
      <canvas
        ref={canvasRef}
        width={160} height={120}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 9998,
          width: 80, height: 60,
          borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.5)',
          opacity: modelLoading ? 0 : 1,
          transition: 'opacity 0.3s',
        }}
        title="Eye tracking active"
      />

      {/* Proctor status pill — top-left */}
      <div style={{
        position: 'fixed', top: 10, left: 10, zIndex: 9998,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.7)', borderRadius: 20,
        padding: '4px 10px', fontSize: 11, color: '#fff',
        border: `1px solid ${severityColor}40`,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: modelLoading ? '#6B7280' : severityColor,
          flexShrink: 0,
          boxShadow: modelLoading ? 'none' : `0 0 6px ${severityColor}`,
          animation: modelLoading ? 'none' : 'pulse 2s infinite',
        }} />
        {modelLoading ? 'Loading eye tracker…' : status === 'error' ? 'Eye tracker unavailable' :
          `Proctoring active${violCount > 0 ? ` · ${violCount} flag${violCount > 1 ? 's' : ''}` : ''}`}
      </div>

      {/* Warning banner */}
      {warning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          padding: '14px 20px',
          background: warning.color,
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
          fontWeight: 600, fontSize: 15,
          boxShadow: `0 2px 20px ${warning.color}88`,
          animation: 'slideDown 0.25s ease',
        }}>
          <warning.Icon size={20} />
          <span>⚠ {warning.label} — this has been logged</span>
          <span style={{ marginLeft: 'auto', opacity: 0.8, fontSize: 12, fontWeight: 400 }}>
            Violation {violCount} / {T.MAX_VIOL}
          </span>
        </div>
      )}

      {/* Fullscreen prompt */}
      {needsFS && requireFullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, textAlign: 'center', color: '#fff', padding: 40,
        }}>
          <Maximize2 size={48} color="#8B5CF6" />
          <div style={{ fontSize: 22, fontWeight: 700 }}>Fullscreen Required</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', maxWidth: 400 }}>
            This assessment must be taken in fullscreen mode. Exiting fullscreen has been flagged.
            Please return to fullscreen to continue.
          </div>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            style={{
              marginTop: 8, padding: '12px 28px',
              background: '#8B5CF6', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Return to Fullscreen
          </button>
        </div>
      )}

      {/* Violation counter sidebar strip */}
      {violCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 9998,
          background: 'rgba(0,0,0,0.75)', borderRadius: 10,
          padding: '8px 12px', fontSize: 11, color: '#fff',
          border: `1px solid ${severityColor}60`,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: severityColor }}>
            {violCount >= T.MAX_VIOL - 3 ? '⚠ Final Warning' : 'Proctoring flags'}
          </div>
          <div style={{ color: '#9CA3AF' }}>
            {violCount} of {T.MAX_VIOL} · {T.MAX_VIOL - violCount} remaining
          </div>
          {violCount >= T.MAX_VIOL - 3 && (
            <div style={{ color: '#EF4444', marginTop: 4, fontWeight: 600 }}>
              Session will be terminated!
            </div>
          )}
        </div>
      )}

      {/* The actual assessment UI */}
      <div style={{ paddingTop: warning ? 52 : 0, transition: 'padding-top 0.25s' }}>
        {children}
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
