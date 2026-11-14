import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

// Live camera with a guidance overlay naming what to look for and where it is stored.
// There is no equipment-recognition model in this prototype, so the overlay never claims
// to have recognised anything: the crew member confirms by hand.
export function CameraAssist({ target, location, onFound }: { target?: string; location?: string; onFound?: () => void }) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string>();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>();

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => { setError('Camera not available on this device or not allowed.'); setOn(false); });
    return () => { cancelled = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [on]);

  if (!on) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => { setError(undefined); setOn(true); }} className="flex items-center gap-2 border border-marble/25 px-3 py-2 font-mono text-[10px] tracking-[0.25em] text-marble/80 hover:border-marble/60">
          <Camera size={14} /> CAMERA ASSIST
        </button>
        {error && <span className="text-xs text-[#e39b4b]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border border-marble/25 bg-black">
      <video ref={video} autoPlay playsInline muted className="block max-h-64 w-full object-cover" />
      {/* Guidance frame: shows what to find, never claims recognition */}
      <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-[#f2c14e]/70" />
      {target && (
        <div className="absolute left-3 top-3 max-w-[80%] bg-black/75 px-2 py-1 text-xs text-marble">
          <span className="font-mono text-[9px] tracking-[0.2em] text-[#f2c14e]">LOOK FOR </span>{target}
          {location && <span className="block text-[11px] text-marble/60">Stored: {location}</span>}
        </div>
      )}
      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
        <span className="bg-black/75 px-2 py-1 text-[10px] text-marble/70">No recognition model in this prototype. Confirm by hand. Reference image: not loaded.</span>
        <div className="flex gap-1.5">
          {onFound && <button onClick={onFound} className="bg-marble px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-black">I HAVE IT</button>}
          <button onClick={() => setOn(false)} aria-label="Turn camera off" className="bg-black/75 px-2 py-1.5 text-marble"><CameraOff size={14} /></button>
        </div>
      </div>
    </div>
  );
}
