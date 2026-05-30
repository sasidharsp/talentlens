import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, RefreshCw, VideoOff } from 'lucide-react';

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [ready,    setReady]    = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        // Chrome fix: MUST set muted on DOM element — React prop is ignored by Chrome
        video.muted = true;
        video.setAttribute('muted', '');

        // Set source — DO NOT call load(), it resets state in some Chrome versions
        video.srcObject = stream;

        // play() is triggered by onLoadedMetadata (React synthetic event on the element)
        // which fires more reliably than manual addEventListener in Chrome
      })
      .catch(() => {
        if (!cancelled) setError('Camera access denied. Please allow camera access and refresh.');
      });

    // 4-second fallback — if metadata never fires, show video anyway
    const fallback = setTimeout(() => {
      if (!cancelled && !ready) {
        videoRef.current?.play().catch(() => {});
        setReady(true);
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // React synthetic event — fires reliably in Chrome when video has metadata
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true; // set again just in case Chrome reset it
    video.play()
      .then(() => setReady(true))
      .catch(() => setReady(true)); // show even if play() rejects
  }, []);

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    canvas.toBlob(blob => onCapture(blob, dataUrl), 'image/jpeg', 0.85);
  };

  const retake = () => {
    setCaptured(null);
    onCapture(null, null);
    const video = videoRef.current;
    if (video && streamRef.current) {
      video.muted = true;
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  };

  if (error) return (
    <div style={{ textAlign:'center', padding:16 }}>
      <VideoOff size={28} color="var(--text-3)" style={{ marginBottom:8 }} />
      <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>{error}</p>
      {onSkip && <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip photo</button>}
    </div>
  );

  return (
    <div style={{ textAlign:'center' }}>
      <canvas ref={canvasRef} style={{ display:'none' }} />

      {captured && (
        <div style={{ marginBottom:12 }}>
          <img src={captured} alt="Captured"
            style={{ width:200, height:150, objectFit:'cover', borderRadius:10,
              border:'2px solid var(--success)', display:'block', margin:'0 auto 12px' }} />
          <div style={{ display:'flex', gap:8, justifyContent:'center', alignItems:'center' }}>
            <CheckCircle size={16} color="var(--success)" />
            <span style={{ fontSize:13, color:'var(--success)', fontWeight:600 }}>Photo captured</span>
            <button className="btn btn-ghost btn-sm" onClick={retake}><RefreshCw size={13}/> Retake</button>
          </div>
        </div>
      )}

      <div style={{ display: captured ? 'none' : 'block' }}>
        <div style={{ position:'relative', display:'inline-block', marginBottom:12 }}>
          <video
            ref={videoRef}
            onLoadedMetadata={handleLoadedMetadata}
            style={{
              width:280, height:210, objectFit:'cover', borderRadius:10,
              border:'2px solid var(--border)', display:'block',
              transform:'scaleX(-1)', background:'#1a1a1a',
            }}
          />
          {!ready && (
            <div style={{
              position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              background:'rgba(0,0,0,0.75)', borderRadius:10, gap:10,
            }}>
              <div className="spinner" style={{ borderTopColor:'#fff' }} />
              <span style={{ fontSize:12, color:'#ccc' }}>Starting camera…</span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          <button className="btn btn-primary btn-sm" onClick={capture} disabled={!ready}>
            <Camera size={14}/> Take Photo
          </button>
          {onSkip && <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>}
        </div>
      </div>
    </div>
  );
}
