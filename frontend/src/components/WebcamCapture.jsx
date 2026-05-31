import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw } from 'lucide-react';

const BUILTIN = ['facetime', 'integrated', 'built-in', 'internal', 'built in'];
const isBuiltIn = label => BUILTIN.some(kw => label.toLowerCase().includes(kw));

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [stream,   setStream]   = useState(null);
  const [ready,    setReady]    = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error,    setError]    = useState('');

  // Step 1 — enumerate cameras, prefer external, get stream
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        probe.getTracks().forEach(t => t.stop());

        const all = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = all.filter(d => d.kind === 'videoinput');
        const preferred = videoDevices.find(d => !isBuiltIn(d.label)) || videoDevices[0];

        const s = await navigator.mediaDevices.getUserMedia({
          video: preferred ? { deviceId: { exact: preferred.deviceId } } : true,
          audio: false,
        });
        if (active) setStream(s);
      } catch {
        if (active) setError('Camera access denied or unavailable.');
      }
    };
    init();
    return () => { active = false; };
  }, []);

  // Step 2 — video element is in DOM, attach stream
  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.play()
        .then(() => setReady(true))
        .catch(() => setReady(true));
    }
    return () => { stream.getTracks().forEach(t => t.stop()); };
  }, [stream]);

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
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  };

  if (error) return (
    <div style={{ textAlign:'center', padding:16 }}>
      <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>{error}</p>
      {onSkip && <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip photo</button>}
    </div>
  );

  if (captured) return (
    <div style={{ textAlign:'center' }}>
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
      <canvas ref={canvasRef} style={{ display:'none' }} />
      <div style={{ position:'relative', display:'inline-block', marginBottom:12 }}>
        {/* Video always in DOM — guarantees ref is set when stream arrives */}
        <video ref={videoRef} autoPlay muted playsInline
          style={{ width:280, height:210, objectFit:'cover', borderRadius:10,
            border:'2px solid var(--border)', display:'block',
            transform:'scaleX(-1)', background:'#1a1a1a' }} />
        {!ready && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.75)', borderRadius:10, gap:10 }}>
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
  );
}
