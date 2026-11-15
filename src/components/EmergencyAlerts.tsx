import { useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, Siren, Volume2, X } from 'lucide-react';
import type { MissionId } from '../types';
import { crew, procedures } from '../emergency/data';
import { buildPlan, casesFrom, roleName, rolesOf } from '../emergency/plan';
import { categoryText } from '../emergency/report';
import { useLog } from '../emergency/sync';
import { speak } from './VoiceControl';

const severity = (category: string) => category === 'behavioral'
  ? { name: 'CREW SUPPORT · ACTION REQUIRED', color: '#e39b4b' }
  : { name: 'CREW EMERGENCY · ACTION REQUIRED', color: '#ff7070' };

// The device that reported the emergency is already on the response screen, so it is not alarmed again.
// While the response screen is open, the reminder banner is hidden and the open emergency is not alarmed again.
export function EmergencyAlerts({ mission, account, inResponse, viewingEid, onJoin }: { mission: MissionId; account: string; inResponse: boolean; viewingEid?: string; onJoin: (eid: string) => void }) {
  const log = useLog();
  const cases = useMemo(() => casesFrom(log).filter((item) => !item.ended && item.mission === mission), [log, mission]);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());
  const [silenced, setSilenced] = useState<Set<string>>(() => new Set());
  const [audioError, setAudioError] = useState(false);
  const announced = useRef(new Set<string>());
  const audioContext = useRef<AudioContext>();

  const newest = cases.find((item) => !acknowledged.has(item.eid) && item.eid !== viewingEid && item.startedBy !== account);
  // An emergency already open on this device does not need its popup again.
  useEffect(() => { if (viewingEid) setAcknowledged((previous) => (previous.has(viewingEid) ? previous : new Set(previous).add(viewingEid))); }, [viewingEid]);

  useEffect(() => {
    const newCases = cases.filter((item) => !announced.current.has(item.eid) && item.startedBy !== account);
    for (const item of newCases) {
      announced.current.add(item.eid);
      speak(`Emergency. ${patientName(item.patientId).split(' ')[0]} needs help. Say emergency to open it.`);
    }
  }, [cases]);

  useEffect(() => {
    const ringing = cases.filter((item) => !acknowledged.has(item.eid) && !silenced.has(item.eid) && item.eid !== viewingEid && item.startedBy !== account);
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
  // What this person is asked to do in the newest emergency.
  const myPart = (() => {
    if (!newest) return '';
    if (newest.patientId === account) return 'Your crew is coming to help you.';
    const all = casesFrom(log);
    const plan = buildPlan(newest, procedures, log, all);
    const roles = rolesOf(plan.roles, account);
    return roles.length ? `TASK ASSIGNED: ${roles.map((r) => roleName[r]).join(' and ')}.` : 'NO TASK ASSIGNED. Remain available. Follow updates from CHIRON.';
  })();

  return (
    <>
      {!inResponse && cases.filter((item) => acknowledged.has(item.eid) || item.startedBy === account).map((item) => (
        <div key={item.eid} className="fixed inset-x-3 bottom-20 z-[45] mx-auto flex max-w-3xl items-center gap-3 border border-[#ff7070]/60 bg-[#160c10]/95 px-4 py-3 shadow-xl backdrop-blur">
          <Siren size={18} className="shrink-0 animate-pulse text-[#ff8585]" />
          <div className="mr-auto min-w-0">
            <div className="truncate text-lg text-marble">Emergency: {patientName(item.patientId).split(' ')[0]} needs help</div>
          </div>
          <button type="button" onClick={() => onJoin(item.eid)} className="min-h-14 bg-[#e45b5b] px-6 text-lg font-bold text-[#120709] hover:bg-[#ff8585]">OPEN</button>
        </div>
      ))}

      {newest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020408]/85 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="emergency-alert-title">
          <section className="w-full max-w-2xl border-4 bg-[#140a0c] p-5 shadow-[0_0_70px_rgba(228,91,91,0.3)] md:p-8" style={{ borderColor: severity(newest.category).color }}>
            <div className="flex items-center gap-3 text-lg font-semibold tracking-wide" style={{ color: severity(newest.category).color }}>
              <Siren size={30} className="animate-pulse" /> EMERGENCY{cases.length > 1 ? ` · ${cases.length} ACTIVE` : ''}
            </div>
            <h2 id="emergency-alert-title" className="mt-3 text-4xl font-semibold leading-tight text-marble md:text-5xl">{patientName(newest.patientId).split(' ')[0]} needs help</h2>
            <p className="mt-2 text-2xl text-marble/85">{newest.category === 'behavioral' ? 'Crew support requested' : categoryText[newest.category]}</p>
            <p className="mt-3 border-l-4 border-gold bg-gold/10 px-4 py-3 text-2xl text-marble">{myPart}</p>
            {audioError && <p className="mt-3 text-base text-[#e39b4b]">No alarm sound in this browser.</p>}
            <button type="button" onClick={() => { acknowledge(newest.eid); onJoin(newest.eid); }} className="mt-5 min-h-24 w-full text-3xl font-bold text-[#130709]" style={{ backgroundColor: severity(newest.category).color }}>
              OPEN THE EMERGENCY SCREEN
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => silence(newest.eid)} className="flex min-h-16 items-center justify-center gap-2 border-2 border-marble/25 px-4 text-lg text-marble/85 hover:border-marble/50">
                {silenced.has(newest.eid) ? <BellOff size={20} /> : <Volume2 size={20} />}
                {silenced.has(newest.eid) ? 'Alarm off' : 'Alarm off'}
              </button>
              <button type="button" onClick={() => acknowledge(newest.eid)} className="flex min-h-16 items-center justify-center gap-2 border-2 border-marble/25 px-4 text-lg text-marble/85 hover:border-marble/50"><X size={20} /> Not now</button>
            </div>
            <p className="mt-3 text-center text-base text-marble/50">Voice: say “emergency” to open it.</p>
          </section>
        </div>
      )}
    </>
  );
}
