import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export default function Timer({ totalSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    firedRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) { firedRef.current = true; onExpire?.(); }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const pct = Math.min((remaining / totalSeconds) * 100, 100);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isCrit = pct <= 10;
  const isWarn = pct <= 25;
  const color = isCrit ? 'var(--danger)' : isWarn ? 'var(--warning)' : 'var(--primary)';
  const bgColor = isCrit ? 'var(--danger-light)' : isWarn ? 'var(--warning-light)' : 'var(--primary-light)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: bgColor, border: `1px solid ${isCrit ? 'var(--danger-border)' : isWarn ? 'var(--warning-border)' : 'var(--primary-border)'}`, transition: 'all 0.5s' }}>
      <Clock size={15} color={color} />
      <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color, letterSpacing: '0.05em', minWidth: 44 }}>
        {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
      </span>
      <div style={{ width: 60, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1s linear, background 0.5s' }} />
      </div>
    </div>
  );
}
