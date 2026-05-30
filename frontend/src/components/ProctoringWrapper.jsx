import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import { AlertTriangle, Camera, Eye, EyeOff, Shield, XCircle } from 'lucide-react';

const MAX_TAB_VIOLATIONS = 3;
const MAX_GAZE_VIOLATIONS = 3;
const GAZE_THRESHOLD_SECONDS = 3;

export default function ProctoringWrapper({ token, onTerminate, children }) {
  const [violations, setViolations] = useState({ tab: 0, fullscreen: 0, gaze: 0, paste: 0 });
  const [warning, setWarning] = useState(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamError, setWebcamError] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);
  const gazeTimerRef = useRef(null);
  const gazeSecondsRef = useRef(0);
  const terminatedRef = useRef(false);

  // ── Log event to backend ──
  const logEvent = useCallback(async (event_type, details = '') => {
    try {
      const res = await api.post(`/candidate/proctor-event/${token}`, { event_type, details });
      if (res.data?.terminated) {
        doTerminate(res.data.reason || 'Violation limit exceeded');
      }
    } catch (e) { /* silent */ }
  }, [token]);

  // ── Terminate session ──
  const doTerminate = useCallback((reason) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    setTerminated(true);
    // Exit fullscreen
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // Stop webcam
    if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());
    api.post(`/candidate/terminate/${token}`, { reason }).catch(() => {});
    if (onTerminate) onTerminate(reason);
  }, [token, webcamStream, onTerminate]);

  // ── Enter fullscreen ──
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (e) {
      console.warn('Fullscreen not available:', e);
    }
  };

  // ── Init webcam ──
  useEffect(() => {
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setWebcamStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        setWebcamError(true);
        // No camera is not a violation — log informational only, don't count against candidate
        api.post(`/candidate/proctor-event/${token}`, {
          event_type: 'webcam_error',
          details: 'Camera unavailable or permission denied — proctoring continues without video',
        }).catch(() => {});
      }
    };
    initWebcam();
    enterFullscreen();
    logEvent('session_start', 'Proctored assessment started');

    return () => {
      if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Fullscreen change listener ──
  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs && !terminatedRef.current) {
        logEvent('fullscreen_exit', 'Candidate exited fullscreen');
        setViolations(v => ({ ...v, fullscreen: v.fullscreen + 1 }));
        showWarning('⚠️ Fullscreen required — please return to fullscreen mode', 4000);
        // Re-enter after short delay
        setTimeout(() => {
          if (!terminatedRef.current) enterFullscreen();
        }, 2000);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [logEvent]);

  // ── Tab/window visibility detection ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !terminatedRef.current) {
        logEvent('tab_switch', 'Tab switched or window minimised');
        setViolations(v => {
          const newTab = v.tab + 1;
          if (newTab >= MAX_TAB_VIOLATIONS) {
            doTerminate(`Auto-terminated: ${newTab} tab switches detected`);
          } else {
            showWarning(`⚠️ Tab switch detected! Warning ${newTab}/${MAX_TAB_VIOLATIONS}`, 5000);
          }
          return { ...v, tab: newTab };
        });
      }
    };
    const handleBlur = () => {
      if (!terminatedRef.current) {
        logEvent('tab_switch', 'Window focus lost (alt+tab or click away)');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [logEvent, doTerminate]);

  // ── Periodic snapshots for AI phone/absence detection ──
  useEffect(() => {
    if (webcamError) return;

    const captureAndSend = async () => {
      if (terminatedRef.current || !videoRef.current) return;
      const video = videoRef.current;
      if (!video.videoWidth) return; // not ready yet

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

        const res = await api.post(`/candidate/proctor-snapshot/${token}`, { image_data: b64 });
        const { action, flag_reason, notes } = res.data;

        if (action === 'terminate') {
          doTerminate('Auto-terminated: Proctoring violation detected');
        } else if (action === 'warn_phone') {
          showWarning('📱 Mobile device detected! Warning 1/2 — a second detection will terminate your session.', 7000);
          logEvent('phone_detected', notes || 'Phone visible');
        } else if (action === 'warn_gaze') {
          showWarning('👁️ Please keep your eyes on the screen. Looking away has been recorded (1/3).', 5000);
        } else if (action === 'warn_gaze_final') {
          showWarning('⚠️ Final warning — looking away recorded (2/3). One more will terminate your session.', 7000);
        } else if (action === 'warn_absent') {
          showWarning('⚠️ Please remain in front of your camera throughout the assessment.', 5000);
        }
      } catch (e) { /* silent — never let snapshot errors affect assessment */ }
    };

    // Capture every 4–6 seconds (avg 5 sec) — dense visual coverage
    let timeoutId;
    const schedule = () => {
      const delay = 4000 + Math.random() * 2000;
      timeoutId = setTimeout(async () => {
        await captureAndSend();
        if (!terminatedRef.current) schedule();
      }, delay);
    };

    // First snapshot after 20 seconds
    timeoutId = setTimeout(() => { captureAndSend(); schedule(); }, 5000);
    return () => clearTimeout(timeoutId);
  }, [token, webcamError]);
  useEffect(() => {
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        if (!gazeTimerRef.current && !terminatedRef.current) {
          gazeTimerRef.current = setInterval(() => {
            gazeSecondsRef.current += 1;
            if (gazeSecondsRef.current >= GAZE_THRESHOLD_SECONDS) {
              clearInterval(gazeTimerRef.current);
              gazeTimerRef.current = null;
              gazeSecondsRef.current = 0;
              logEvent('gaze_away', 'Gaze away from screen for 3+ seconds');
              setViolations(v => {
                const newGaze = v.gaze + 1;
                if (newGaze >= MAX_GAZE_VIOLATIONS) {
                  doTerminate(`Auto-terminated: ${newGaze} gaze violations`);
                } else {
                  showWarning(`👁️ Please keep your eyes on the screen! (${newGaze}/${MAX_GAZE_VIOLATIONS})`, 4000);
                }
                return { ...v, gaze: newGaze };
              });
            }
          }, 1000);
        }
      }
    };
    const handleMouseEnter = () => {
      if (gazeTimerRef.current) {
        clearInterval(gazeTimerRef.current);
        gazeTimerRef.current = null;
        gazeSecondsRef.current = 0;
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (gazeTimerRef.current) clearInterval(gazeTimerRef.current);
    };
  }, [logEvent, doTerminate]);

  // ── Keyboard shortcut blocking ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      const blocked = (
        e.key === 'F12' ||
        (e.ctrlKey && ['u', 'U', 'c', 'C', 'v', 'V', 'a', 'A'].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) ||
        (e.metaKey && ['c', 'v', 'u', 'a'].includes(e.key.toLowerCase()))
      );
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        logEvent('shortcut_attempt', `Blocked: ${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`);
        setViolations(v => ({ ...v, paste: v.paste + 1 }));
        showWarning('🚫 Keyboard shortcuts are disabled during the assessment', 2500);
      }
    };
    const handleContextMenu = (e) => {
      e.preventDefault();
      logEvent('right_click', 'Right-click attempted');
    };
    const handlePaste = (e) => {
      e.preventDefault();
      logEvent('paste_attempt', 'Paste attempt blocked');
      setViolations(v => ({ ...v, paste: v.paste + 1 }));
      showWarning('🚫 Paste is disabled during the assessment', 2500);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('paste', handlePaste, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('paste', handlePaste, true);
    };
  }, [logEvent]);

  const showWarning = (msg, duration = 3000) => {
    setWarning(msg);
    setTimeout(() => setWarning(null), duration);
  };

  // ── Terminated screen ──
  if (terminated) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', flexDirection: 'column', gap: 20, padding: 40, textAlign: 'center' }}>
        <XCircle size={64} color="var(--danger)" />
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)', fontFamily: "'DM Serif Display',serif" }}>
          Assessment Terminated
        </h1>
        <p style={{ fontSize: 16, color: '#7F1D1D', maxWidth: 480, lineHeight: 1.7 }}>
          Your assessment session has been terminated due to suspected malpractice. The violation has been recorded and flagged for review.
        </p>
        <div style={{ background: '#fff', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '20px 28px', maxWidth: 400 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Violations Recorded</div>
          {[['Tab switches', violations.tab], ['Gaze violations', violations.gaze], ['Fullscreen exits', violations.fullscreen], ['Paste/shortcut attempts', violations.paste]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>{k}</span>
              <span style={{ fontWeight: 700, color: v > 0 ? 'var(--danger)' : 'var(--success)' }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Please contact the assessment coordinator for further guidance.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {children}

      {/* Webcam overlay — bottom LEFT, away from Prev/Next buttons (bottom right) */}
      {!webcamError && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 9999,
          borderRadius: 10, overflow: 'hidden',
          border: '2px solid rgba(0,0,0,0.3)', boxShadow: 'var(--shadow-md)',
          background: '#000', width: 110, height: 80,
          pointerEvents: 'none',
        }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Shield size={8} color={violations.tab + violations.gaze > 0 ? '#FBBF24' : '#34D399'} />
            <span style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
      )}

      {/* No-camera badge — shown instead of video when camera unavailable */}
      {webcamError && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', borderRadius: 8,
          padding: '5px 10px', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <EyeOff size={12} color="#9CA3AF" />
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>No camera</span>
        </div>
      )}

      {/* Violation counter — above webcam, bottom-left */}
      <div style={{
        position: 'fixed', bottom: 168, left: 16, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '5px 10px',
        boxShadow: 'var(--shadow-sm)', pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['Tab', violations.tab, MAX_TAB_VIOLATIONS], ['Gaze', violations.gaze, MAX_GAZE_VIOLATIONS]].map(([label, count, max]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: count > 0 ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>{count}/{max}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 9 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning toast — centre top, non-interactive */}
      {warning && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1814', color: '#fff', padding: '12px 24px',
          borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: 'var(--shadow-lg)', zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 480,
          pointerEvents: 'none',
        }}>
          <AlertTriangle size={18} color="#FBBF24" />
          {warning}
        </div>
      )}
    </div>
  );
}
