import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, RefreshCw, SwitchCamera } from 'lucide-react';

const BUILTIN = ['facetime', 'integrated', 'built-in', 'internal', 'built in'];
const isBuiltIn = label => BUILTIN.some(kw => label.toLowerCase().includes(kw));

export default function WebcamCapture({ onCapture, onSkip }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [stream,   setStream]   = useState(null);
  const [cameras,  setCameras]  = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [ready,    setReady]    = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error,    setError]    = useState('');

  // Step 1 — enumerate all cameras on mount
  useEffect(() => {
    const enumerate = async () => {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        probe.getTracks().forEach(t => t.stop());

        const all = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = all.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);

        const preferred = videoDevices.find(d => !isBuiltIn(d.label)) || videoDevices[0];
        if (preferred) setActiveId(preferred.deviceId);
        else setError('No camera found. Please connect a camera and refresh.');
      } catch {
        setError('Camera access denied or unavailable.');
      }
    };
    enumerate();
  }, []);

  // Step 2 — open stream whenever activeId changes
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    setReady(false);

    navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: activeId } },
      audio: false,
    }).then(s => {
      if (!active) { s.getTracks().forEach(t => t.stop()); return; }
      // Stop previous stream
      if (stream) stream.getTracks().forEach(t => t.stop());
      setStream(s);
    }).catch(() => {
      if (active) setError('Could not open selected camera. Try another.');
    });

    return () => { active = false; };
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 3 — attach stream to video after React commits it to DOM
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = stream;
    video.play()
      .then(() => setReady(true))
      .catch(() => setReady(true));
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

      {/* Camera switcher — only shown when multiple cameras detected */}
      {cameras.length > 1 && (
        <div style={{ marginBottom:10, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
          {cameras.map((cam, i) => (
            <button key={cam.deviceId}
              onClick={() => setActiveId(cam.deviceId)}
              className={`btn btn-sm ${cam.deviceId === activeId ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize:11, padding:'4px 10px', display:'flex', alignItems:'center', gap:5 }}>
              <SwitchCamera size={12} />
              {cam.label || `Camera ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Video — always in DOM */}
      <div style={{ position:'relative', display:'inline-block', marginBottom:12 }}>
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
