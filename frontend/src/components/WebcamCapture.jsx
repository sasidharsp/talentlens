import { useState, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw, VideoOff } from 'lucide-react';

export default function WebcamCapture({ onCapture, onSkip }) {
  const [videoEl, setVideoEl]   = useState(null); // DOM node stored as state
  const [stream, setStream]     = useState(null);
  const [ready, setReady]       = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError]       = useState('');
  const [canvasEl, setCanvasEl] = useState(null);

  // Step 1 — get the stream once
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
      .then(s  => { if (!cancelled) setStream(s); })
      .catch(() => { if (!cancelled) setError('Camera access denied or unavailable.'); });
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2 — when BOTH the video element AND the stream exist, connect them
  // Both are in state so this effect only fires when both are non-null
  useEffect(() => {
    if (!videoEl || !stream) return;
    videoEl.srcObject = stream;
    // cleanup: stop camera when component unmounts or stream changes
    return () => {
      stream.getTracks().forEach(t => t.stop());
      videoEl.srcObject = null;
    };
  }, [videoEl, stream]);

  const capture = () => {
    if (!videoEl || !canvasEl) return;
    canvasEl.width  = videoEl.videoWidth  || 320;
    canvasEl.height = videoEl.videoHeight || 240;
    const ctx = canvasEl.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, -canvasEl.width, 0, canvasEl.width, canvasEl.height);
    ctx.restore();
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    canvasEl.toBlob(blob => onCapture(blob, dataUrl), 'image/jpeg', 0.85);
  };

  const retake = () => { setCaptured(null); onCapture(null, null); };

  if (error) return (
    <div style={{ textAlign:'center', padding:16 }}>
      <VideoOff size={28} color="var(--text-3)" style={{ marginBottom:8 }} />
      <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>{error}</p>
      <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip photo</button>
    </div>
  );

  if (captured) return (
    <div style={{ textAlign:'center' }}>
      <canvas ref={n => setCanvasEl(n)} style={{ display:'none' }} />
      <img src={captured} alt="Captured"
        style={{ width:200, height:150, objectFit:'cover', borderRadius:10,
          border:'2px solid var(--success)', display:'block', margin:'0 auto 12px' }} />
      <div style={{ display:'flex', gap:8, justifyContent:'center', alignItems:'center' }}>
        <CheckCircle size={16} color="var(--success)" />
        <span style={{ fontSize:13, color:'var(--success)', fontWeight:600 }}>Photo captured</span>
        <button className="btn btn-ghost btn-sm" onClick={retake}><RefreshCw size={13}/> Retake</button>
      </div>
    </div>
  );

  return (
    <div style={{ textAlign:'center' }}>
      <canvas ref={n => setCanvasEl(n)} style={{ display:'none' }} />
      <div style={{ position:'relative', display:'inline-block', marginBottom:12 }}>
        {/* Video element — callback ref stores it as state, guaranteeing effect can connect it */}
        <video
          ref={n => { if (n && n !== videoEl) setVideoEl(n); }}
          autoPlay
          muted
          playsInline
          onCanPlay={() => setReady(true)}
          style={{
            width:280, height:210, objectFit:'cover', borderRadius:10,
            border:'2px solid var(--border)', display:'block',
            transform:'scaleX(-1)', background:'#000',
            opacity: ready ? 1 : 0, transition:'opacity 0.3s',
          }}
        />
        {/* Loading overlay — sits on top until video is playing */}
        {!ready && (
          <div style={{
            position:'absolute', inset:0,
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            background:'var(--surface-2)', borderRadius:10,
            border:'2px solid var(--border)', gap:10,
          }}>
            <div className="spinner" />
            <span style={{ fontSize:12, color:'var(--text-3)' }}>Starting camera…</span>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        <button className="btn btn-primary btn-sm" onClick={capture} disabled={!ready}>
          <Camera size={14} /> Take Photo
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}
