import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw } from 'lucide-react';

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);   // state — triggers re-render
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState('');

  // Step 1: get the stream
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
      .then(s => { if (active) setStream(s); })
      .catch(() => { if (active) setError('Camera access denied. You can skip this step.'); });

    return () => {
      active = false;
    };
  }, []);

  // Step 2: once stream state is set AND video element exists, attach
  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.play()
        .then(() => setReady(true))
        .catch(() => setReady(true)); // still mark ready even if autoplay fails
    }
    // Cleanup — stop tracks when component unmounts
    return () => {
      stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    // Mirror the image (match the CSS scaleX(-1))
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    canvas.toBlob(blob => onCapture(blob, dataUrl), 'image/jpeg', 0.85);
  };

  const retake = () => {
    setCaptured(null);
    onCapture(null, null);
  };

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
          <img
            src={captured}
            alt="Captured"
            style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--success)', display: 'block', margin: '0 auto 12px' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <CheckCircle size={16} color="var(--success)" />
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Photo captured</span>
            <button className="btn btn-ghost btn-sm" onClick={retake}>
              <RefreshCw size={13} /> Retake
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
            {/* Video always in DOM so ref is available when stream arrives */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: 280, height: 210,
                objectFit: 'cover',
                borderRadius: 10,
                border: '2px solid var(--border)',
                display: 'block',
                transform: 'scaleX(-1)',
                background: '#1a1a1a',
                opacity: ready ? 1 : 0,   // hide until playing to avoid flash
                transition: 'opacity 0.3s',
              }}
            />
            {/* Placeholder shown while camera loads */}
            {!ready && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-2)', borderRadius: 10,
                border: '2px solid var(--border)', gap: 10,
              }}>
                <div className="spinner" />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Starting camera…</span>
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
