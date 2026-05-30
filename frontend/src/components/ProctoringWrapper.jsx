import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, EyeOff, Loader } from 'lucide-react';
import { ProctorEngine } from './ProctorEngine';
import api from '../api/client';

const MAX_TAB_VIOLATIONS = 3;

export default function ProctoringWrapper({ token, children, onTerminate }) {
  const videoRef     = useRef(null);
  const engineRef    = useRef(null);
  const terminatedRef = useRef(false);

  const [webcamStream,  setWebcamStream]  = useState(null);
  const [webcamError,   setWebcamError]   = useState(false);
  const [engineStatus,  setEngineStatus]  = useState('loading'); // loading|ready|error
  const [warning,       setWarning]       = useState(null);
  const [violations,    setViolations]    = useState({ tab: 0, gaze: 0, phone: 0 });

  const showWarning = useCallback((msg, duration = 5000) => {
    setWarning(msg);
    setTimeout(() => setWarning(null), duration);
  }, []);

  const logEvent = useCallback((type, details) => {
    api.post(`/candidate/proctor-event/${token}`, { event_type: type, details }).catch(() => {});
  }, [token]);

  const doTerminate = useCallback((reason, frameB64) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    engineRef.current?.stop();

    // Send final violation snapshot
    if (frameB64) {
      api.post(`/candidate/proctor-snapshot/${token}`, {
        image_data: frameB64,
        flag_reason: 'terminated',
        is_violation: true,
      }).catch(() => {});
    }
    api.post(`/candidate/proctor-event/${token}`, {
      event_type: 'terminated_malpractice',
      details: reason,
    }).catch(() => {});

    onTerminate?.(reason);
  }, [token, onTerminate]);

  // ── Webcam setup ─────────────────────────────────────────────────
  useEffect(() => {
    const initWebcam = async () => {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        probe.getTracks().forEach(t => t.stop());

        const all = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = all.filter(d => d.kind === 'videoinput');
        const BUILTIN = ['facetime', 'integrated', 'built-in', 'internal', 'built in'];
        const preferred = videoDevices.find(d =>
          !BUILTIN.some(kw => d.label.toLowerCase().includes(kw))
        ) || videoDevices[0];

        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferred ? { deviceId: { exact: preferred.deviceId } } : true,
          audio: false,
        });
        setWebcamStream(stream);
      } catch {
        setWebcamError(true);
        setEngineStatus('error');
        logEvent('webcam_error', 'Camera unavailable');
      }
    };

    initWebcam();
    enterFullscreen();
    logEvent('session_start', 'Proctored assessment started');

    return () => {
      if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Attach stream to video ────────────────────────────────────────
  useEffect(() => {
    if (!webcamStream || !videoRef.current) return;
    const video = videoRef.current;
    video.muted = true;
    video.setAttribute('muted', '');
    video.srcObject = webcamStream;
    video.play().catch(() => {});
    return () => { webcamStream.getTracks().forEach(t => t.stop()); };
  }, [webcamStream]);

  // ── Load ProctorEngine + start detection ──────────────────────────
  useEffect(() => {
    if (!webcamStream || webcamError) return;

    const engine = new ProctorEngine({
      onStatusChange: setEngineStatus,
      onViolation: (type, action, frameB64) => {
        setViolations(v => ({
          ...v,
          [type === 'phone_detected' ? 'phone' : type === 'looking_away' ? 'gaze' : 'tab']:
            (v[type === 'phone_detected' ? 'phone' : type === 'looking_away' ? 'gaze' : 'tab'] || 0) + 1,
        }));

        // Send snapshot on every confirmed violation
        if (frameB64) {
          api.post(`/candidate/proctor-snapshot/${token}`, {
            image_data: frameB64,
            flag_reason: type,
            is_violation: true,
          }).catch(() => {});
        }

        logEvent(type, action);

        if (action === 'warn_phone')
          showWarning('📱 Mobile device detected! Warning 1/2 — second detection will terminate your session.', 7000);
        else if (action === 'warn_gaze')
          showWarning('👁️ Please keep your eyes on the screen. Gaze violation recorded (1/3).', 5000);
        else if (action === 'warn_gaze_final')
          showWarning('⚠️ Final warning — gaze violation (2/3). One more will terminate your session.', 7000);
        else if (action === 'warn_absent')
          showWarning('⚠️ Please remain in front of your camera throughout the assessment.', 5000);
      },
      onTerminate: (reason, frameB64) => doTerminate(reason, frameB64),
    });

    engineRef.current = engine;

    // Load models then start when video is playing
    engine.load().then(() => {
      const video = videoRef.current;
      if (video && webcamStream) {
        const startWhenReady = () => { if (!terminatedRef.current) engine.start(video); };
        if (video.readyState >= 3) startWhenReady();
        else video.addEventListener('canplay', startWhenReady, { once: true });
      }
    });

    return () => { engine.stop(); };
  }, [webcamStream]);

  // ── Periodic snapshots for admin strip (every 5 sec, no AI) ───────
  useEffect(() => {
    if (webcamError) return;
    let timeoutId;
    const schedule = () => {
      const delay = 4000 + Math.random() * 2000;
      timeoutId = setTimeout(async () => {
        if (terminatedRef.current || !videoRef.current) return;
        const v = videoRef.current;
        if (!v.videoWidth) { schedule(); return; }
        try {
          const c = document.createElement('canvas');
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0);
          const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
          await api.post(`/candidate/proctor-snapshot/${token}`, {
            image_data: b64,
            flag_reason: null,
            is_violation: false,
          });
        } catch { /* silent */ }
        if (!terminatedRef.current) schedule();
      }, delay);
    };
    timeoutId = setTimeout(() => { schedule(); }, 8000);
    return () => clearTimeout(timeoutId);
  }, [token, webcamError]);

  // ── Tab switch detection ─────────────────────────────────────────
  useEffect(() => {
    let tabViolations = 0;
    const handleVisibility = () => {
      if (document.hidden && !terminatedRef.current) {
        tabViolations++;
        setViolations(v => ({ ...v, tab: tabViolations }));
        logEvent('tab_switch', `Tab switch #${tabViolations}`);
        if (tabViolations >= MAX_TAB_VIOLATIONS) {
          doTerminate(`Auto-terminated: ${tabViolations} tab switches detected`);
        } else {
          showWarning(`⚠️ Tab switch detected! Warning ${tabViolations}/${MAX_TAB_VIOLATIONS}`, 5000);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Fullscreen helpers ───────────────────────────────────────────
  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.()
      || document.documentElement.webkitRequestFullscreen?.();
  };

  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement && !terminatedRef.current) {
        showWarning('⚠️ Fullscreen required — please return to fullscreen mode', 4000);
        setTimeout(enterFullscreen, 300);
      }
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}

      {/* Warning toast */}
      {warning && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, background: '#1F2937', color: '#fff', borderRadius: 10,
          padding: '12px 24px', fontSize: 14, fontWeight: 500, maxWidth: 480,
          textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.2s ease',
        }}>
          {warning}
        </div>
      )}

      {/* Webcam overlay */}
      {!webcamError && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 9999,
          borderRadius: 10, overflow: 'hidden',
          border: `2px solid ${engineStatus === 'ready' ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.2)'}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          background: '#000', width: 110, height: 80,
        }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', pointerEvents: 'none' }} />

          {/* Status badge */}
          <div style={{
            position: 'absolute', top: 3, left: 3,
            background: 'rgba(0,0,0,0.65)', borderRadius: 4,
            padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {engineStatus === 'loading'
              ? <Loader size={8} color="#FBBF24" />
              : <Shield size={8} color={violations.tab + violations.gaze + violations.phone > 0 ? '#FBBF24' : '#34D399'} />}
            <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>
              {engineStatus === 'loading' ? 'LOADING' : 'LIVE'}
            </span>
          </div>
        </div>
      )}

      {/* No-camera badge */}
      {webcamError && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', borderRadius: 8,
          padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5,
          pointerEvents: 'none',
        }}>
          <EyeOff size={12} color="#9CA3AF" />
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>No camera</span>
        </div>
      )}
    </div>
  );
}
