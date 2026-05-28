import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw, X } from 'lucide-react';

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
        setLoading(false);
      } catch (e) {
        setError('Camera access denied. You can skip this step.');
        setLoading(false);
      }
    };
    init();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCaptured(dataUrl);
    // Convert to blob and pass up
    canvas.toBlob(blob => onCapture(blob, dataUrl), 'image/jpeg', 0.8);
  };

  const retake = () => {
    setCaptured(null);
    onCapture(null, null);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {error ? (
        <div style={{ padding: '24px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{error}</div>
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip photo capture</button>
        </div>
      ) : captured ? (
        <div>
          <img src={captured} alt="Captured" style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--success)', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              <CheckCircle size={16} /> Photo captured
            </div>
            <button className="btn btn-ghost btn-sm" onClick={retake}><RefreshCw size={13} /> Retake</button>
          </div>
        </div>
      ) : (
        <div>
          {loading ? (
            <div style={{ width: 280, height: 210, background: '#000', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <div className="spinner" style={{ borderTopColor: '#fff' }} />
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline
              style={{ width: 280, height: 210, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)', marginBottom: 12, transform: 'scaleX(-1)', display: 'block', margin: '0 auto 12px' }} />
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={capture} disabled={loading}>
              <Camera size={14} /> Take Photo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
}
