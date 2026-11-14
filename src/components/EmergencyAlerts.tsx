import { useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, Siren, Volume2, X } from 'lucide-react';
import type { MissionId } from '../types';
import { crew } from '../emergency/data';
import { casesFrom } from '../emergency/plan';
import { useLog } from '../emergency/sync';
import { speak } from './VoiceControl';

const severity = (category: string) => category === 'behavioral'
  ? { name: 'CREW SUPPORT · ACTION REQUIRED', color: '#e39b4b' }
  : { name: 'CREW EMERGENCY · ACTION REQUIRED', color: '#ff7070' };

// The device that reported the emergency is already on the response screen, so it is not alarmed again.
// While the response screen is open, the reminder banner is hidden and the open emergency is not alarmed again.
export function EmergencyAlerts({ mission, account, inResponse, viewingEid, onJoin }: { mission: MissionId; account: string; inResponse: boolean; viewingEid?: string; onJoin: (eid: string) => void }) {
  const log = useLog();
  const cases = useMemo(() => casesFrom(log).filter((item) => !item.ended && item.mission === mission && item.startedBy !== account), [log, mission, account]);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());
  const [silenced, setSilenced] = useState<Set<string>>(() => new Set());
  const [audioError, setAudioError] = useState(false);
  const announced = useRef(new Set<string>());
  const audioContext = useRef<AudioContext>();

  const newest = cases.find((item) => !acknowledged.has(item.eid) && item.eid !== viewingEid);

  useEffect(() => {
    const newCases = cases.filter((item) => !announced.current.has(item.eid));
    for (const item of newCases) {
      announced.current.add(item.eid);
      speak(item.category === 'behavioral'
        ? 'Crew support requested. Open emergency response.'
        : 'Medical emergency reported. Open emergency response.');
    }
  }, [cases]);

  useEffect(() => {
    const ringing = cases.filter((item) => !acknowledged.has(item.eid) && !silenced.has(item.eid) && item.eid !== viewingEid);
    if (!ringing.length) return;
    let interval: number | undefined;
    try {
      const Ctx = window.AudioContext;
      if (!Ctx) throw new Error('Audio alarm is not supported in this browser.');
      const context = audioContext.current ?? new Ctx();
      audioContext.current = context;
      const playTone = (category: string) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = category === 'behavioral' ? 520 : 880;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.25);
      };
      void context.resume();
      const alert = ringing[0];
      playTone(alert.category);
      interval = window.setInterval(() => playTone(alert.category), alert.category === 'behavioral' ? 2200 : 1350);
    } catch {
      setAudioError(true);
    }
    return () => { if (interval !== undefined) window.clearInterval(interval); };
  }, [cases, acknowledged, silenced, viewingEid]);

  useEffect(() => {
    const activeIds = new Set(cases.map((item) => item.eid));
    setAcknowledged((previous) => new Set([...previous].filter((id) => activeIds.has(id))));
    setSilenced((previous) => new Set([...previous].filter((id) => activeIds.has(id))));
  }, [cases]);

  const acknowledge = (eid: string) => setAcknowledged((previous) => new Set(previous).add(eid));
  const silence = (eid: string) => setSilenced((previous) => new Set(previous).add(eid));
  const patientName = (id: string) => crew.find((member) => member.id === id)?.name ?? 'Crew member';

  return (
    <>
      {!inResponse && cases.filter((item) => acknowledged.has(item.eid)).map((item) => (
        <div key={item.eid} className="fixed inset-x-3 bottom-20 z-[45] mx-auto flex max-w-3xl items-center gap-3 border border-[#ff7070]/60 bg-[#160c10]/95 px-4 py-3 shadow-xl backdrop-blur">
          <Siren size={18} className="shrink-0 animate-pulse text-[#ff8585]" />
          <div className="mr-auto min-w-0">
            <div className="font-mono text-[10px] tracking-[0.16em] text-[#ff8585]">EMERGENCY ACTIVE · ACKNOWLEDGED</div>
            <div className="truncate text-sm text-marble">{patientName(item.patientId)} · Crew support active</div>
          </div>
          <button type="button" onClick={() => onJoin(item.eid)} className="min-h-11 bg-[#e45b5b] px-4 font-mono text-[10px] font-semibold tracking-wider text-[#120709] hover:bg-[#ff8585]">OPEN RESPONSE</button>
        </div>
      ))}

      {newest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020408]/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="emergency-alert-title">
          <section className="w-full max-w-xl border-2 bg-[#100c10] p-5 shadow-[0_0_70px_rgba(228,91,91,0.22)] md:p-7" style={{ borderColor: severity(newest.category).color }}>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border" style={{ color: severity(newest.category).color, borderColor: `${severity(newest.category).color}99`, backgroundColor: `${severity(newest.category).color}18` }}><Siren size={24} className="animate-pulse" /></span>
              <div className="mr-auto">
                <div className="font-mono text-[10px] font-semibold tracking-[0.22em]" style={{ color: severity(newest.category).color }}>{severity(newest.category).name} · {cases.length > 1 ? `${cases.length} ACTIVE` : 'ACTIVE'}</div>
                <h2 id="emergency-alert-title" className="mt-1 font-sans text-2xl font-semibold text-marble">Crew support is needed</h2>
                <p className="mt-2 text-base text-marble/80">{patientName(newest.patientId)} <span className="text-marble/45">·</span> Response team notified</p>
                <p className="mt-1 text-sm text-marble/55">Private health details are available only in the response view.</p>
              </div>
              <button type="button" onClick={() => acknowledge(newest.eid)} aria-label="Acknowledge emergency alert" className="rounded p-2 text-marble/55 hover:bg-marble/10 hover:text-marble"><X size={20} /></button>
            </div>
            {audioError && <p className="mt-4 text-xs text-[#e39b4b]">Audio alarm unavailable in this browser. The visual alert remains active.</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => silence(newest.eid)} className="flex min-h-12 items-center gap-2 border border-marble/25 px-4 text-sm text-marble/80 hover:border-marble/50">
                {silenced.has(newest.eid) ? <BellOff size={16} /> : <Volume2 size={16} />}
                {silenced.has(newest.eid) ? 'Alarm silenced' : 'Silence alarm'}
              </button>
              <button type="button" onClick={() => { acknowledge(newest.eid); onJoin(newest.eid); }} className="min-h-12 px-5 font-mono text-xs font-semibold tracking-[0.14em] text-[#130709]" style={{ backgroundColor: severity(newest.category).color }}>
                OPEN EMERGENCY RESPONSE
              </button>
            </div>
            <p className="mt-4 text-right font-mono text-[9px] tracking-[0.1em] text-marble/40">Alert remains visible until acknowledged or resolved.</p>
          </section>
        </div>
      )}
    </>
  );
}
