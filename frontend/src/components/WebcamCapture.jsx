import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw } from 'lucide-react';

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState('');

  // Always render the video element — set srcObject once stream is available
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => setError('Camera access denied. You can skip this step.'));

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // When video element mounts, attach stream if already available
  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    canvas.toBlob(blob => onCapture(blob, dataUrl), 'image/jpeg', 0.85);
  };

  const retake = () => { setCaptured(null); onCapture(null, null); };

  if (error) return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{error}</p>
      <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip photo capture</button>
    </div>
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {captured ? (
        <div>
          <img src={captured} alt="Captured"
            style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--success)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <CheckCircle size={16} color="var(--success)" />
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Photo captured</span>
            <button className="btn btn-ghost btn-sm" onClick={retake}><RefreshCw size={13} /> Retake</button>
          </div>
        </div>
      ) : (
        <div>
          {/* Video always rendered — avoids srcObject timing issue */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
            <video ref={setVideoRef} autoPlay muted playsInline
              style={{ width: 280, height: 210, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)', display: 'block', transform: 'scaleX(-1)', background: '#000' }} />
            {!ready && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                <div className="spinner" style={{ borderTopColor: '#fff' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={capture} disabled={!ready}>
              <Camera size={14} /> Take Photo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
}
