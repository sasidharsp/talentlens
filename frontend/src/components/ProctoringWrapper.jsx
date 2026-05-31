/**
 * ProctoringWrapper.jsx  —  Full-spectrum proctoring: vision + audio + input + browser
 *
 * DROP-IN replacement. Same props: { token, children, onTerminate }
 *
 * ── WHAT'S FIXED vs previous version ──────────────────────────────────────────
 *  • Camera enumeration: probes permission → enumerates devices → prefers
 *    external camera automatically → uses explicit deviceId (no Chrome ambiguity)
 *  • Camera switcher UI: shows all detected cameras, lets candidate switch
 *  • Dark screen fix: srcObject set in a SEPARATE useEffect that runs after
 *    React commits the <video> element to the DOM (not inside the init closure)
 *  • Phone detection: COCO-SSD (80-class object detector) from jsDelivr CDN
 *    Detects cell phone, book, remote — confirmed over 3 consecutive frames
 *
 * ── DETECTION STACK ───────────────────────────────────────────────────────────
 *  COCO-SSD (2 fps)      → phone, book, second person objects
 *  MediaPipe Face Mesh   → gaze (iris 478-pt), head turn, eye closure (EAR)
 *  Web Audio API         → sustained microphone energy (speech)
 *  DOM event listeners   → keyboard shortcuts, copy/paste, right-click
 *  Browser state         → tab switch, window blur, fullscreen exit, devtools
 *
 * ── VIOLATION WEIGHTS ─────────────────────────────────────────────────────────
 *  phone_detected   ×4   face_not_detected  ×2   tab_switch    ×2
 *  multiple_faces   ×3   audio_detected     ×2   fullscreen_exit ×2
 *  devtools_open    ×3   copy_attempt       ×2   paste_attempt  ×2
 *  gaze_away        ×1   head_turn          ×1   eyes_closed    ×1
 *  window_blur      ×1   keyboard_shortcut  ×2
 *  Auto-terminate at 20 weighted points.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Eye, EyeOff, Users, MonitorOff, Maximize2,
  AlertTriangle, Mic, Keyboard, Copy, Shield, Smartphone, Camera,
} from 'lucide-react';
import api from '../api/client';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
const MP_VER = '0.4.1633559619';
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MP_VER}`;
const TF_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
const COCO_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';

function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) { ok(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
const LM = {
  LE_OUT:33, LE_IN:133, LE_TOP:159, LE_BOT:145, L_IRIS:468,
  RE_OUT:263, RE_IN:362, RE_TOP:386, RE_BOT:374, R_IRIS:473,
  NOSE:1, F_LEFT:234, F_RIGHT:454,
};

// ─── Thresholds ───────────────────────────────────────────────────────────────
const T = {
  H_GAZE:    0.20,   // iris horizontal — raised, more tolerant
  V_UP:      0.14,   // iris up threshold
  V_DOWN:    0.24,   // iris down threshold
  HEAD:      0.16,   // nose offset for head turn
  EAR:       0.12,   // eye closure — lower = less sensitive
  PHONE_CONF:0.65,   // COCO-SSD phone confidence
  PHONE_FRAMES:5,    // frames to confirm phone (~0.5s)
  PHONE_TERM:3,      // confirmed phone events before terminate
  AUDIO_RMS: 72,     // only loud sustained speech (raised from 55)
  AUDIO_HOLD:9000,   // 9 seconds sustained before flagging
  GRACE:     12,     // ~1.2s at 10fps before violation counts
  COOLDOWN:  15000,  // 15s before same event fires again
  SNAP_MS:   10000,  // evidence snapshot every 10s for admin audit
  MAX_W:     60,     // raised — much harder to auto-terminate
  DEVTOOLS:  160,
};

// ─── Violation definitions ────────────────────────────────────────────────────
// w:0 = logged only, no termination score
// Serious cheating events score; natural behaviours log only
const VIOLS = {
  phone_detected:   { w:5, c:'#DC2626', lbl:'Mobile phone detected',          Icon:Smartphone },
  multiple_faces:   { w:4, c:'#DC2626', lbl:'Multiple people in frame',        Icon:Users      },
  devtools_open:    { w:4, c:'#DC2626', lbl:'Browser DevTools opened',         Icon:Keyboard   },
  copy_attempt:     { w:3, c:'#EF4444', lbl:'Copy blocked',                    Icon:Copy       },
  paste_attempt:    { w:3, c:'#EF4444', lbl:'Paste blocked',                   Icon:Copy       },
  tab_switch:       { w:3, c:'#EF4444', lbl:'Switched tabs / minimised',       Icon:MonitorOff },
  keyboard_shortcut:{ w:2, c:'#EF4444', lbl:'Blocked shortcut',                Icon:Keyboard   },
  fullscreen_exit:  { w:2, c:'#8B5CF6', lbl:'Exited fullscreen',               Icon:Maximize2  },
  face_not_detected:{ w:1, c:'#EF4444', lbl:'Face not visible',                Icon:EyeOff     },
  audio_detected:   { w:0, c:'#8B5CF6', lbl:'Speaking detected',               Icon:Mic        },
  gaze_away:        { w:0, c:'#F59E0B', lbl:'Looking away from screen',        Icon:Eye        },
  head_turn:        { w:0, c:'#F59E0B', lbl:'Head turned sideways',            Icon:Eye        },
  eyes_closed:      { w:0, c:'#F59E0B', lbl:'Eyes closed / looking down',      Icon:EyeOff     },
  window_blur:      { w:0, c:'#F59E0B', lbl:'Window lost focus',               Icon:MonitorOff },
  evidence_snapshot:{ w:0, c:'#10B981', lbl:'Evidence captured',               Icon:Shield     },
};

// ─── Gaze math (MediaPipe iris landmarks) ─────────────────────────────────────
function calcGaze(lm) {
  if (lm.length < 478) return null;
  const s = (a,b) => Math.abs(b-a) < 1e-5 ? 1e-5 : b-a;
  const lh = (lm[LM.L_IRIS].x - lm[LM.LE_OUT].x) / s(lm[LM.LE_OUT].x, lm[LM.LE_IN].x);
  const rh = (lm[LM.R_IRIS].x - lm[LM.RE_OUT].x) / s(lm[LM.RE_OUT].x, lm[LM.RE_IN].x);
  const lv = (lm[LM.L_IRIS].y - lm[LM.LE_TOP].y) / s(lm[LM.LE_TOP].y, lm[LM.LE_BOT].y);
  const rv = (lm[LM.R_IRIS].y - lm[LM.RE_TOP].y) / s(lm[LM.RE_TOP].y, lm[LM.RE_BOT].y);
  const d  = (a,b) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
  const lEAR = d(lm[LM.LE_TOP],lm[LM.LE_BOT]) / (d(lm[LM.LE_OUT],lm[LM.LE_IN])||1);
  const rEAR = d(lm[LM.RE_TOP],lm[LM.RE_BOT]) / (d(lm[LM.RE_OUT],lm[LM.RE_IN])||1);
  const faceW = lm[LM.F_RIGHT].x - lm[LM.F_LEFT].x;
  return {
    hGaze: (lh+rh)/2,
    vGaze: (lv+rv)/2,
    noseOff: (lm[LM.NOSE].x - (lm[LM.F_LEFT].x+lm[LM.F_RIGHT].x)/2) / (faceW||1),
    ear: (lEAR+rEAR)/2,
  };
}

// ─── Camera helpers ───────────────────────────────────────────────────────────
const BUILTIN = ['facetime','integrated','built-in','internal','truedepth','virtual','obs'];
const isBuiltin = l => BUILTIN.some(k => l.toLowerCase().includes(k));

async function enumerateCameras() {
  // Step 1: probe for permission (needed before labels are visible)
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    probe.getTracks().forEach(t => t.stop());
  } catch { return []; }
  // Step 2: list all video inputs
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === 'videoinput');
}

function pickCamera(cameras) {
  if (!cameras.length) return null;
  return cameras.find(c => !isBuiltin(c.label)) || cameras[0];
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ProctoringWrapper({ token, children, onTerminate }) {
  const videoRef    = useRef(null);
  const dbgCanvas   = useRef(null);
  const fmRef       = useRef(null);
  const cocoRef     = useRef(null);
  const rafRef      = useRef(null);
  const lastFpsRef  = useRef(0);
  const audioRef    = useRef(null);
  const audioHold   = useRef(null);
  const badFrames   = useRef({});
  const lastLogged  = useRef({});
  const phoneFrames = useRef(0);
  const phoneEvents = useRef(0);
  const weightedRef = useRef(0);
  
  const [cameras,       setCameras]       = useState([]);
  const [activeCamId,   setActiveCamId]   = useState(null);
  const [webcamStream,  setWebcamStream]  = useState(null);
  const [mpReady,       setMpReady]       = useState(false);
  const [cocoReady,     setCocoReady]     = useState(false);
  const [warning,       setWarning]       = useState(null);
  const [weighted,      setWeighted]      = useState(0);
  const [log,           setLog]           = useState([]);
  const [needsFS,       setNeedsFS]       = useState(false);
  const [camError,      setCamError]      = useState('');

  // ── Server-driven config ──────────────────────────────────────────
  const [procEnabled,   setProcEnabled]   = useState(true);   // optimistic default

  useEffect(() => {
    api.get('/candidate/proctor-config')
      .then(r => {
        setProcEnabled(r.data.enabled !== false);
      })
      .catch(() => {
        // Network error — fall back to defaults (enabled)
        setProcEnabled(true);
        setProcCfg(null);
      });
  }, []);

  // ── Core: log violation ───────────────────────────────────────────────────
  const logViol = useCallback((type, extra = {}, snapshot = null) => {
    const now  = Date.now();
    const meta = VIOLS[type];
    const cd   = meta?.w === 0 ? 500 : T.COOLDOWN;
    if ((lastLogged.current[type] || 0) + cd > now) return;
    lastLogged.current[type] = now;

    const w = meta?.w ?? 1;
    weightedRef.current += w;
    if (w > 0) setWeighted(weightedRef.current);

    api.post(`/candidate/proctor-event/${token}`, {
      event_type: type,
      timestamp:  new Date().toISOString(),
      weighted_total: weightedRef.current,
      snapshot_b64: snapshot || undefined,
      ...extra,
    }).catch(() => {});

    if (w > 0) {
      setWeighted(weightedRef.current);
      setWarning({ type, ...meta });
      setTimeout(() => setWarning(cur => cur?.type === type ? null : cur), 5000);
    }

    // Always add to log — w:0 events show as "logged" with no score impact
    setLog(p => [{ type, label: meta?.lbl ?? type, color: meta?.c ?? '#EF4444',
      time: new Date().toLocaleTimeString(), w }, ...p].slice(0, 20));

    if (weightedRef.current >= T.MAX_W && onTerminate) {
      api.post(`/candidate/terminate/${token}`, {
        reason: `Auto-terminated: ${weightedRef.current} weighted violations`,
      }).catch(() => {});
      onTerminate(`Session terminated — ${weightedRef.current} integrity violations.`);
    }
  }, [token, onTerminate]);

  // ── Capture snapshot from video ───────────────────────────────────────────
  const captureFrame = useCallback((quality = 0.92) => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return null;
    const c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    const ctx = c.getContext('2d');
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(v, -320, 0, 320, 240); ctx.restore();
    return c.toDataURL('image/jpeg', quality);
  }, []);

  // ── MediaPipe results handler ─────────────────────────────────────────────
  const handleFM = useCallback(results => {
    const faces = results.multiFaceLandmarks || [];

    if (faces.length === 0) {
      badFrames.current.noface = (badFrames.current.noface||0) + 1;
      ['gaze','head','ear','multi'].forEach(k => { badFrames.current[k] = 0; });
      if (badFrames.current.noface >= T.GRACE) {
        logViol('face_not_detected'); badFrames.current.noface = 0;
      }
      return;
    }
    badFrames.current.noface = 0;

    if (faces.length > 1) {
      badFrames.current.multi = (badFrames.current.multi||0) + 1;
      if (badFrames.current.multi >= T.GRACE) {
        logViol('multiple_faces', { count: faces.length }, captureFrame());
        badFrames.current.multi = 0;
      }
    } else { badFrames.current.multi = 0; }

    const m = calcGaze(faces[0]);
    if (!m) return;
    const { hGaze, vGaze, noseOff, ear } = m;

    // Gaze
    const hOff = Math.abs(hGaze - 0.5);
    const vOff = vGaze < 0.5 - T.V_UP ? 'up' : vGaze > 0.5 + T.V_DOWN ? 'down' : null;
    if (hOff > T.H_GAZE || vOff) {
      badFrames.current.gaze = (badFrames.current.gaze||0) + 1;
      if (badFrames.current.gaze >= T.GRACE) {
        const dir = hGaze < 0.5 - T.H_GAZE ? 'right' : hGaze > 0.5 + T.H_GAZE ? 'left' : vOff;
        logViol('gaze_away', { dir, h: hGaze.toFixed(3), v: vGaze.toFixed(3) });
        badFrames.current.gaze = 0;
      }
    } else { badFrames.current.gaze = 0; }

    // Head turn
    if (Math.abs(noseOff) > T.HEAD) {
      badFrames.current.head = (badFrames.current.head||0) + 1;
      if (badFrames.current.head >= T.GRACE) {
        logViol('head_turn', { dir: noseOff > 0 ? 'right' : 'left' });
        badFrames.current.head = 0;
      }
    } else { badFrames.current.head = 0; }

    // Eye closure
    if (ear < T.EAR) {
      badFrames.current.ear = (badFrames.current.ear||0) + 1;
      if (badFrames.current.ear >= 4) {
        logViol('eyes_closed', { ear: ear.toFixed(3) }); badFrames.current.ear = 0;
      }
    } else { badFrames.current.ear = 0; }

    // Debug canvas dots
    const c = dbgCanvas.current;
    if (c) {
      const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
      const lm = faces[0];
      const dot = (idx, col) => {
        ctx.beginPath();
        ctx.arc(lm[idx].x*c.width, lm[idx].y*c.height, 2, 0, Math.PI*2);
        ctx.fillStyle=col; ctx.fill();
      };
      [LM.LE_OUT,LM.LE_IN,LM.RE_OUT,LM.RE_IN,LM.LE_TOP,LM.LE_BOT,LM.RE_TOP,LM.RE_BOT]
        .forEach(i => dot(i,'rgba(0,200,255,0.5)'));
      dot(LM.L_IRIS, ear < T.EAR ? '#FF4444' : '#00FF88');
      dot(LM.R_IRIS, ear < T.EAR ? '#FF4444' : '#00FF88');
      dot(LM.NOSE, '#FF8800');
    }
  }, [logViol, captureFrame]);

  // ── COCO-SSD phone detection ──────────────────────────────────────────────
  const runCoco = useCallback(async () => {
    const coco = cocoRef.current;
    const v    = videoRef.current;
    if (!coco || !v || v.readyState < 2) return;

    const preds = await coco.detect(v).catch(() => []);
    const PHONE_CLASSES = new Set(['cell phone', 'remote', 'book']);
    const phones = preds.filter(p => PHONE_CLASSES.has(p.class) && p.score >= T.PHONE_CONF);

    if (phones.length > 0) {
      phoneFrames.current += 1;
      if (phoneFrames.current >= T.PHONE_FRAMES) {
        phoneFrames.current = 0;
        phoneEvents.current += 1;
        const snap = captureFrame(0.92);
        logViol('phone_detected', {
          class: phones[0].class,
          confidence: phones[0].score.toFixed(2),
          event_count: phoneEvents.current,
        }, snap);

        // Auto-terminate after N confirmed phone events
        if (phoneEvents.current >= T.PHONE_TERM && onTerminate) {
          api.post(`/candidate/terminate/${token}`, {
            reason: `Auto-terminated: phone detected ${phoneEvents.current} times`,
          }).catch(() => {});
          onTerminate(`Assessment ended — mobile phone detected ${phoneEvents.current} times.`);
        }
      }
    } else {
      phoneFrames.current = Math.max(0, phoneFrames.current - 1);
    }
  }, [logViol, captureFrame, token, onTerminate]);

  // ── Effect 1: Camera enumeration ──────────────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    enumerateCameras().then(cams => {
      setCameras(cams);
      const preferred = pickCamera(cams);
      if (preferred) setActiveCamId(preferred.deviceId);
      else setCamError('No camera found. Please connect a camera and refresh.');
    });
  }, []);

  // ── Effect 2: Open stream when active camera changes ──────────────────────
  useEffect(() => {
    if (!activeCamId) return;
    let cancelled = false;
    let stream = null;

    (async () => {
      try {
        // Close previous stream
        if (webcamStream) webcamStream.getTracks().forEach(t => t.stop());

        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: activeCamId }, width: 640, height: 480 },
          audio: false,
        });
        if (!cancelled) setWebcamStream(stream);
      } catch (err) {
        if (!cancelled) {
          setCamError(
            err.name === 'NotAllowedError'
              ? 'Camera access denied. Allow camera in your browser and refresh.'
              : `Camera error: ${err.name}. Try switching cameras.`
          );
        }
      }
    })();

    return () => { cancelled = true; if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [activeCamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3: srcObject — MUST be a separate effect (Chrome dark screen fix)
  // When webcamStream is set, the <video> element is guaranteed to be in the DOM.
  useEffect(() => {
    if (!webcamStream || !videoRef.current) return;
    const v = videoRef.current;
    v.muted = true;
    v.setAttribute('muted', '');
    v.srcObject = webcamStream;
    v.play().catch(() => {});
  }, [webcamStream]);

  // ── Effect 4: Init MediaPipe + COCO-SSD + analysis loop ───────────────────
  useEffect(() => {
    if (!procEnabled || !webcamStream) return;
    let cancelled = false;

    (async () => {
      try {
        // MediaPipe Face Mesh
        await loadScript(`${MP_CDN}/face_mesh.js`);
        const fm = new window.FaceMesh({ locateFile: f => `${MP_CDN}/${f}` });
        fm.setOptions({ maxNumFaces:2, refineLandmarks:true,
          minDetectionConfidence:0.6, minTrackingConfidence:0.6 });
        fm.onResults(handleFM);
        await fm.initialize();
        if (cancelled) return;
        fmRef.current = fm;
        setMpReady(true);

        // COCO-SSD (load sequentially: TF → model)
        await loadScript(TF_CDN);
        await loadScript(COCO_CDN);
        const coco = await window.cocoSsd.load();
        if (cancelled) return;
        cocoRef.current = coco;
        setCocoReady(true);

        // Analysis loop — 2 fps for both models to share CPU budget
        const loop = async ts => {
          if (cancelled) return;
          if (ts - lastFpsRef.current >= 500) {
            lastFpsRef.current = ts;
            const v = videoRef.current;
            if (v?.readyState >= 2) {
              await Promise.all([
                fmRef.current?.send({ image: v }).catch(() => {}),
                runCoco(),
              ]);
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);

      } catch (err) {
        if (!cancelled) console.error('Proctor ML init error:', err);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [webcamStream, handleFM, runCoco]);

  // ── Effect 5: Audio monitoring ─────────────────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    let cancelled = false;
    let audioStream = null;

    (async () => {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
        const ctx    = new AudioContext();
        const source = ctx.createMediaStreamSource(audioStream);
        const anal   = ctx.createAnalyser();
        anal.fftSize = 512;
        source.connect(anal);
        const data = new Uint8Array(anal.frequencyBinCount);
        audioRef.current = { ctx, anal, data };

        const check = () => {
          if (cancelled) return;
          anal.getByteFrequencyData(data);
          const voice = Array.from(data.slice(3, 40));
          const rms = Math.sqrt(voice.reduce((s,v)=>s+v*v,0)/voice.length);
          if (rms > T.AUDIO_RMS) {
            if (!audioHold.current) audioHold.current = Date.now();
            else if (Date.now() - audioHold.current > T.AUDIO_HOLD) {
              logViol('audio_detected', { rms: rms.toFixed(1) });
              audioHold.current = null;
            }
          } else { audioHold.current = null; }
          setTimeout(check, 250);
        };
        check();
      } catch { /* mic denied — audio monitoring skipped */ }
    })();

    return () => {
      cancelled = true;
      if (audioRef.current) { audioRef.current.ctx.close(); }
      if (audioStream) audioStream.getTracks().forEach(t => t.stop());
    };
  }, [logViol]);

  // ── Effect 6: Browser behaviour listeners ─────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    const onHide  = () => { if (document.hidden) logViol('tab_switch'); };
    const onBlur  = () => logViol('window_blur');

    const onKey = e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'F12')       { e.preventDefault(); logViol('keyboard_shortcut',{key:'F12'}); return; }
      if (e.code === 'PrintScreen'){ e.preventDefault(); logViol('keyboard_shortcut',{key:'PrintScreen'}); return; }
      if (ctrl && e.code==='KeyC'){ e.preventDefault(); logViol('copy_attempt'); return; }
      if (ctrl && e.code==='KeyV'){ e.preventDefault(); logViol('paste_attempt'); return; }
      const BLOCK = new Set(['KeyU','KeyS','KeyP','KeyA']);
      if (ctrl && BLOCK.has(e.code)){ e.preventDefault(); logViol('keyboard_shortcut',{key:`Ctrl+${e.key}`}); }
      if (ctrl && e.shiftKey && ['KeyI','KeyJ','KeyC'].includes(e.code)){
        e.preventDefault(); logViol('keyboard_shortcut',{key:`Ctrl+Shift+${e.key}`});
      }
    };
    const onPaste  = e => { e.preventDefault(); logViol('paste_attempt'); };
    const onMenu   = e => e.preventDefault();
    const onSelect = e => {
      if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT'){
        e.preventDefault(); window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    document.addEventListener('keydown',     onKey,   true);
    document.addEventListener('paste',       onPaste, true);
    document.addEventListener('contextmenu', onMenu,  true);
    document.addEventListener('selectstart', onSelect,true);

    return () => {
      document.removeEventListener('visibilitychange',onHide);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('keydown',     onKey,   true);
      document.removeEventListener('paste',       onPaste, true);
      document.removeEventListener('contextmenu', onMenu,  true);
      document.removeEventListener('selectstart', onSelect,true);
    };
  }, [logViol]);

  // ── Effect 7: Fullscreen ──────────────────────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onChange = () => {
      if (!document.fullscreenElement) { setNeedsFS(true); logViol('fullscreen_exit'); }
      else setNeedsFS(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [logViol]);

  // ── Effect 8: DevTools detector ───────────────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    const id = setInterval(() => {
      if (window.outerWidth-window.innerWidth > T.DEVTOOLS ||
          window.outerHeight-window.innerHeight > T.DEVTOOLS)
        logViol('devtools_open');
    }, 5000);
    return () => clearInterval(id);
  }, [logViol]);

  // ── Effect 9: Periodic evidence snapshots ─────────────────────────────────
  useEffect(() => {
    if (!procEnabled) return;
    const doSnap = () => {
      const snap = captureFrame(0.85);
      if (snap) {
        logViol('evidence_snapshot', { thumbnail: snap });
        api.post(`/candidate/proctor-snapshot/${token}`, {
          image_data: snap.split(',')[1],
          flag_reason: null,
          is_violation: false,
        }).catch(() => {});
      }
    };
    const initTimer  = setTimeout(doSnap, 15000);          // first at 15 s
    const snapTimer  = setInterval(doSnap, T.SNAP_MS);     // then every 90 s
    return () => { clearTimeout(initTimer); clearInterval(snapTimer); };
  }, [logViol, captureFrame]);

  // ── Effect 10: Clean up streams on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      webcamStream?.getTracks().forEach(t => t.stop());
    };
  }, [webcamStream]);

  // ─── Derived display values ───────────────────────────────────────────────
  const pct = Math.min(100, (weighted / T.MAX_W) * 100);
  const statusColor = weighted === 0 ? '#10B981' : weighted < 6 ? '#F59E0B'
    : weighted < 14 ? '#EF4444' : '#7F1D1D';
  const modelStatus = !webcamStream ? 'Starting camera…'
    : !mpReady ? 'Loading eye tracker…'
    : !cocoReady ? 'Loading phone detector…'
    : `Proctoring active${weighted > 0 ? ` · ${weighted} pts` : ''}`;

  // ── If proctoring disabled by admin — pure assessment, no camera/ML ─────────
  if (!procEnabled) return <>{children}</>;

  if (camError) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',minHeight:'60vh',gap:16,padding:40,textAlign:'center' }}>
      <Camera size={40} color="#EF4444" />
      <div style={{ fontSize:16,fontWeight:600,color:'#EF4444' }}>Camera required</div>
      <div style={{ fontSize:14,color:'#6B7280',maxWidth:420 }}>{camError}</div>
      {cameras.length > 1 && (
        <div>
          <div style={{ fontSize:12,color:'#9CA3AF',marginBottom:8 }}>Try another camera:</div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center' }}>
            {cameras.map(cam => (
              <button key={cam.deviceId}
                onClick={() => { setCamError(''); setActiveCamId(cam.deviceId); }}
                style={{ padding:'6px 14px',fontSize:12,border:'1px solid #D1D5DB',
                  borderRadius:8,cursor:'pointer',background:'#F9FAFB' }}>
                {cam.label || `Camera ${cam.deviceId.slice(0,6)}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display:'flex', height:'100vh', userSelect:'none', overflow:'hidden', position:'relative' }}>

      {/* ── LEFT 70% — assessment content ── */}
      <div style={{ flex:'0 0 70%', width:'70%', height:'100vh', overflow:'auto',
        paddingTop: warning && warning.w !== 0 ? 48 : 0, transition:'padding-top 0.2s' }}>
        {children}
      </div>

      {/* ── RIGHT 30% — proctor panel ── */}
      <div style={{ flex:'0 0 30%', width:'30%', height:'100vh',
        background:'#0A0F1E', borderLeft:'1px solid #1E293B',
        display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Status header */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #1E293B',
          display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
            background: mpReady && cocoReady ? statusColor : '#6B7280',
            boxShadow: mpReady && cocoReady ? `0 0 6px ${statusColor}` : 'none',
            animation: mpReady && cocoReady ? 'procPulse 2s infinite' : 'none' }} />
          <span style={{ fontSize:11, color:'#94A3B8', flex:1 }}>{modelStatus}</span>
          {weighted > 0 && (
            <span style={{ fontSize:10, color:statusColor, fontWeight:700 }}>
              {weighted}/{T.MAX_W}pts
            </span>
          )}
        </div>

        {/* Webcam feed */}
        <div style={{ position:'relative', flexShrink:0, background:'#000' }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover',
              display:'block', transform:'scaleX(-1)' }} />

          {/* Debug iris canvas overlay */}
          <canvas ref={dbgCanvas} width={160} height={120}
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%',
              opacity: mpReady ? 0.6 : 0, transition:'opacity 0.5s', pointerEvents:'none' }}
            title="Eye tracker" />

          {/* Score bar under webcam */}
          {weighted > 0 && (
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3,
              background:'rgba(0,0,0,0.4)' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:statusColor,
                transition:'width 0.5s, background 0.5s' }} />
            </div>
          )}
        </div>

        {/* Violation log — scrollable */}
        <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
          {/* Log header with live score counter */}
          <div style={{ padding:'8px 12px', borderBottom:'1px solid #1E293B',
            display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <span style={{ fontSize:11, color:'#64748B', fontWeight:600 }}>INTEGRITY LOG</span>
            <span style={{ fontSize:11, fontWeight:700,
              color: weighted === 0 ? '#10B981' : weighted < T.MAX_W * 0.6 ? '#F59E0B' : '#EF4444' }}>
              {weighted}/{T.MAX_W} pts
            </span>
          </div>

          {log.length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              color:'#1E293B', fontSize:12, textAlign:'center', padding:16 }}>
              No events yet
            </div>
          ) : (
            <div style={{ padding:'4px 0' }}>
              {log.map((e, i) => (
                <div key={i} style={{ padding:'6px 12px', fontSize:11,
                  borderBottom:'1px solid #0F172A',
                  display:'flex', alignItems:'flex-start', gap:8 }}>
                  <span style={{ color:e.color, fontSize:8, marginTop:3, flexShrink:0 }}>●</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#CBD5E1', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.label}</div>
                    <div style={{ color:'#475569', fontSize:9, marginTop:2 }}>{e.time}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, flexShrink:0,
                    color: e.w > 0 ? e.color : '#475569' }}>
                    {e.w > 0 ? `+${e.w}` : 'log'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Warning banner — full width ── */}
      {warning && warning.w !== 0 && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:99999,
          padding:'13px 20px', background:warning.c, color:'#fff',
          display:'flex', alignItems:'center', gap:12, fontWeight:600, fontSize:14,
          boxShadow:`0 3px 20px ${warning.c}90`, animation:'warnSlide 0.2s ease' }}>
          {warning.Icon && <warning.Icon size={18} />}
          <span>⚠ {warning.lbl} — recorded</span>
          <span style={{ marginLeft:'auto', opacity:0.85, fontSize:12, fontWeight:400 }}>
            {weighted}/{T.MAX_W} pts · {T.MAX_W - weighted} remaining
          </span>
        </div>
      )}

      {/* ── Fullscreen gate ── */}
      {needsFS && (
        <div style={{ position:'fixed', inset:0, zIndex:99998,
          background:'rgba(0,0,0,0.92)', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:18, padding:40, textAlign:'center' }}>
          <Maximize2 size={52} color="#8B5CF6" />
          <div style={{ fontSize:22, fontWeight:700, color:'#fff' }}>Fullscreen Required</div>
          <div style={{ fontSize:14, color:'#9CA3AF', maxWidth:420, lineHeight:1.7 }}>
            Exiting fullscreen has been flagged. Please return to continue.
          </div>
          <button onClick={() => document.documentElement.requestFullscreen?.()}
            style={{ padding:'12px 32px', background:'#8B5CF6', color:'#fff',
              border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer' }}>
            Return to Fullscreen
          </button>
        </div>
      )}

      <style>{`
        @keyframes warnSlide { from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1} }
        @keyframes procPulse { 0%,100%{opacity:1}50%{opacity:0.3} }
      `}</style>
    </div>
  );

      {/* Mini debug iris canvas */}
      <canvas ref={dbgCanvas} width={160} height={120}
        style={{ position:'fixed',top:8,right:cameras.length>1?92:8,zIndex:9990,
          width:80,height:60,borderRadius:6,
          border:`1px solid ${statusColor}40`,background:'rgba(0,0,0,0.55)',
          opacity:mpReady?1:0,transition:'opacity 0.5s',pointerEvents:'none' }}
        title="Eye tracker active"
      />

      {/* Camera switcher — top right */}
      {cameras.length > 1 && (
        <div style={{ position:'fixed',top:8,right:8,zIndex:9991,
          display:'flex',flexDirection:'column',gap:3 }}>
          {cameras.map(cam => (
            <button key={cam.deviceId}
              onClick={() => setActiveCamId(cam.deviceId)}
              style={{ padding:'3px 8px',fontSize:10,borderRadius:6,cursor:'pointer',
                border:`1px solid ${cam.deviceId===activeCamId ? statusColor : '#374151'}`,
                background:cam.deviceId===activeCamId ? `${statusColor}22` : 'rgba(0,0,0,0.7)',
                color:'#fff',maxWidth:84,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}
              title={cam.label}>
              {isBuiltin(cam.label) ? '💻' : '📷'} {cam.label?.split('(')[0].trim().slice(0,10) || 'Cam'}
            </button>
          ))}
        </div>
      )}

      {/* Status pill */}
      <div style={{ position:'fixed',top:10,left:10,zIndex:9990,
        display:'flex',alignItems:'center',gap:7,
        background:'rgba(10,10,10,0.85)',borderRadius:20,padding:'5px 12px',
        fontSize:11,color:'#fff',border:`1px solid ${statusColor}50`,
        backdropFilter:'blur(4px)',pointerEvents:'none' }}>
        <span style={{ width:7,height:7,borderRadius:'50%',flexShrink:0,
          background:mpReady&&cocoReady?statusColor:'#6B7280',
          boxShadow:mpReady&&cocoReady?`0 0 6px ${statusColor}`:'none',
          animation:mpReady&&cocoReady?'procPulse 2s infinite':'none' }} />
        {modelStatus}
      </div>

      {/* Violation progress bar */}
      {weighted > 0 && (
        <div style={{ position:'fixed',top:0,left:0,right:0,height:3,zIndex:9989,
          background:'rgba(0,0,0,0.2)' }}>
          <div style={{ height:'100%',width:`${pct}%`,background:statusColor,
            transition:'width 0.5s,background 0.5s' }} />
        </div>
      )}

      {/* Warning banner */}
      {warning && warning.w !== 0 && (
        <div style={{ position:'fixed',top:0,left:0,right:0,zIndex:99999,
          padding:'13px 20px',background:warning.c,color:'#fff',
          display:'flex',alignItems:'center',gap:12,fontWeight:600,fontSize:14,
          boxShadow:`0 3px 20px ${warning.c}90`,animation:'warnSlide 0.2s ease' }}>
          {warning.Icon && <warning.Icon size={18}/>}
          <span>⚠ {warning.lbl} — recorded</span>
          <span style={{ marginLeft:'auto',opacity:0.85,fontSize:12,fontWeight:400 }}>
            {weighted}/{T.MAX_W} pts · {T.MAX_W-weighted} remaining
          </span>
        </div>
      )}

      {/* Live violation log */}
      {log.length > 0 && (
        <div style={{ position:'fixed',bottom:12,left:12,zIndex:9990,width:220,
          background:'rgba(0,0,0,0.85)',borderRadius:10,
          border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',
          backdropFilter:'blur(4px)' }}>
          <div style={{ padding:'7px 10px',fontSize:11,color:'#9CA3AF',fontWeight:600,
            borderBottom:'1px solid rgba(255,255,255,0.08)',
            display:'flex',justifyContent:'space-between' }}>
            <span>Proctoring log</span>
            <span style={{ color:statusColor }}>{weighted} pts</span>
          </div>
          {log.map((e,i) => (
            <div key={i} style={{ padding:'5px 10px',fontSize:11,color:'#D1D5DB',
              borderBottom:'1px solid rgba(255,255,255,0.05)',
              display:'flex',justifyContent:'space-between',gap:6 }}>
              <span style={{ color:e.color }}>●</span>
              <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                {e.label}
              </span>
              <span style={{ color:'#6B7280',flexShrink:0 }}>{e.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Final warning */}
      {weighted >= T.MAX_W-4 && weighted < T.MAX_W && (
        <div style={{ position:'fixed',bottom:log.length>0?216:12,left:12,zIndex:9990,
          background:'#7F1D1D',border:'1px solid #EF4444',borderRadius:10,
          padding:'10px 14px',color:'#FCA5A5',fontSize:12,fontWeight:600,maxWidth:220 }}>
          ⛔ {T.MAX_W-weighted} pts until auto-termination
        </div>
      )}

      {/* Fullscreen gate */}
      {needsFS && (
        <div style={{ position:'fixed',inset:0,zIndex:99998,
          background:'rgba(0,0,0,0.92)',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:18,padding:40,textAlign:'center' }}>
          <Maximize2 size={52} color="#8B5CF6"/>
          <div style={{ fontSize:22,fontWeight:700,color:'#fff' }}>Fullscreen Required</div>
          <div style={{ fontSize:14,color:'#9CA3AF',maxWidth:420,lineHeight:1.7 }}>
            Exiting fullscreen has been flagged. Please return to continue.
          </div>
          <button onClick={() => document.documentElement.requestFullscreen?.()}
            style={{ padding:'12px 32px',background:'#8B5CF6',color:'#fff',
              border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer' }}>
            Return to Fullscreen
          </button>
        </div>
      )}

}
