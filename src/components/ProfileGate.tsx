import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Delete, Lock, ShieldCheck, Watch } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { publish, useLog } from '../emergency/sync';
import { DEMO_PINS, EMERGENCY_ACCESS_MIN, ROLE_RULES, accessRole, viewFor } from '../access/access';
import { statusColor, statusLabel, type CrewHealth } from '../lib/crewHealth';
import { ago, type LinkStatus } from '../link/link';
import { Avatar } from './Avatar';
import { roleOf } from './MissionDashboard';

// The PIN pad: four digits, big keys.
export function PinPad({ person, onOk, title }: { person: CrewMember; onOk: () => void; title?: string }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(false);
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setWrong(false);
    setPin(next);
    if (next.length === 4) {
      if (next === DEMO_PINS[person.id]) onOk();
      else setTimeout(() => { setPin(''); setWrong(true); }, 250);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') setPin((p) => p.slice(0, -1)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section className="mx-auto w-full max-w-sm border border-gold/30 bg-void/85 p-6 text-center backdrop-blur-md" aria-label="Enter your PIN">
      <div className="flex justify-center"><Avatar id={person.id} name={person.name} size={72} /></div>
      <h2 className="mt-3 font-serif text-xl tracking-[0.12em] text-marble">{title ?? person.name.toUpperCase()}</h2>
      <p className="mt-1 text-lg text-marble/70">Enter your PIN</p>
      <div className="mt-4 flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-2 ${wrong ? 'border-[#e45b5b]' : 'border-gold'} ${i < pin.length ? 'bg-gold' : ''}`} />)}
      </div>
      {wrong && <p className="mt-2 text-lg text-[#ff8585]" role="alert">Wrong PIN. Try again.</p>}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="min-h-16 border border-marble/20 text-2xl text-marble hover:border-gold hover:bg-gold/10">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className="min-h-16 border border-marble/20 text-2xl text-marble hover:border-gold hover:bg-gold/10">0</button>
        <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete last digit" className="flex min-h-16 items-center justify-center border border-marble/20 text-marble/70 hover:border-gold"><Delete /></button>
      </div>
      <button type="button" onClick={() => setHint(!hint)} className="mt-4 min-h-10 text-sm text-marble/50 underline-offset-2 hover:underline">Prototype: show the demo PIN</button>
      {hint && <p className="text-base text-gold">Demo PIN for {person.name.split(' ')[0]}: {DEMO_PINS[person.id]}</p>}
    </section>
  );
}

const REASONS = ['They cannot answer for themselves', 'The medical officer asked me to', 'An emergency is in progress'];

interface Props {
  viewer: CrewMember;          // who is using this device
  owner: CrewMember;           // whose profile it is
  unlocked: boolean;
  onUnlock: () => void;
  health: CrewHealth;
  link: LinkStatus;
  now: number;
  children: ReactNode;         // the full medical profile
}

// Stands in front of every medical profile: PIN first, then the role decides what is shown.
export function ProfileGate({ viewer, owner, unlocked, onUnlock, health, link, now, children }: Props) {
  const log = useLog();
  const [asking, setAsking] = useState(false);
  const logged = useRef<string>();
  const access = viewFor(viewer, owner, log, now);
  const role = accessRole(viewer);
  const self = viewer.id === owner.id;

  // A medical officer opening someone else's profile is written in the log, once per visit.
  useEffect(() => {
    if (!unlocked || self || role !== 'medical' || logged.current === owner.id) return;
    logged.current = owner.id;
    publish({ type: 'profile-access', by: viewer.id, crewId: owner.id, role: 'medical' });
  }, [unlocked, self, role, owner.id, viewer.id]);

  if (!unlocked) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 md:px-8">
        <p className="mb-4 flex items-center justify-center gap-2 text-lg text-marble/75"><Lock size={18} className="text-gold" /> Medical profiles are private. Show CHIRON it is you.</p>
        <PinPad person={viewer} onOk={onUnlock} />
      </main>
    );
  }

  if (access.view === 'full') {
    return (
      <>
        {!self && (
          <p className="mx-auto mt-2 flex w-full max-w-[1200px] items-center gap-2 px-4 text-base text-[#f3c28d] md:px-8">
            <ShieldCheck size={18} /> {access.why}. {owner.name.split(' ')[0]} can see that you opened this profile.
          </p>
        )}
        {children}
      </>
    );
  }

  const first = owner.name.split(' ')[0];
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 pb-24 pt-2 md:px-8">
      <section className="border border-marble/10 bg-void/80 p-5 backdrop-blur-md" style={{ borderTop: `4px solid ${statusColor[health.status]}` }}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar id={owner.id} name={owner.name} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl tracking-[0.15em] text-marble">{owner.name.toUpperCase()}</h1>
            <p className="text-sm tracking-[0.1em] text-marble/55">{roleOf(owner)}</p>
            <div className="mt-1 font-serif text-2xl font-bold tracking-[0.1em]" style={{ color: statusColor[health.status] }}>{statusLabel[health.status]}</div>
          </div>
          <span className="flex items-center gap-2 border border-marble/20 px-3 py-2 font-mono text-xs tracking-[0.18em] text-marble/70"><Lock size={14} /> {role === 'commander' ? 'COMMAND VIEW' : 'PRIVATE PROFILE'}</span>
        </div>
        <dl className="mt-4 grid gap-2 text-lg sm:grid-cols-2">
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">CHIRON LINK</dt><dd className={link.connected ? 'text-marble' : 'text-[#f3c28d]'}><Watch size={16} className="mr-1 inline text-gold" />{link.connected ? `Connected · battery ${link.battery}%` : `Disconnected ${ago(link.lastSync, now)}`}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">WHERE</dt><dd className="text-marble">{link.connected ? '' : 'Last known: '}{link.location}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">DOING NOW</dt><dd className="text-marble">{link.activity}</dd></div>
          <div className="border border-marble/10 p-3"><dt className="text-sm text-marble/50">CAN HELP IN AN EMERGENCY</dt><dd className="text-marble">{!link.connected ? 'Unknown: check in person' : link.eva || /EVA/.test(link.activity) ? 'Busy: EVA' : 'Yes'}</dd></div>
        </dl>
      </section>

      <section className="border border-marble/10 bg-void/80 p-5 backdrop-blur-md">
        <p className="text-lg text-marble/85">{first}’s readings, history and medical record are private. {ROLE_RULES[role]}</p>
        {!asking ? (
          <button type="button" onClick={() => setAsking(true)} className="mt-4 min-h-14 border-2 border-[#e45b5b]/70 px-6 text-lg font-semibold text-[#ff9c9c] hover:bg-[#e45b5b]/10">EMERGENCY ACCESS</button>
        ) : (
          <div className="mt-4 border-2 border-[#e45b5b]/60 bg-[#e45b5b]/[0.06] p-4">
            <p className="text-xl text-marble">Why do you need {first}’s medical profile?</p>
            <div className="mt-3 grid gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => { publish({ type: 'profile-access', by: viewer.id, crewId: owner.id, role: 'emergency', reason: r }); setAsking(false); }}
                  className="min-h-14 border border-marble/25 px-4 text-left text-lg text-marble hover:border-[#e45b5b] hover:bg-[#e45b5b]/10">{r}</button>
              ))}
            </div>
            <p className="mt-3 text-base text-marble/60">Opens for {EMERGENCY_ACCESS_MIN} minutes. Your name, the time and the reason are written in the medical log, where {first} and the medical officer can see them.</p>
            <button type="button" onClick={() => setAsking(false)} className="mt-2 min-h-12 px-4 text-base text-marble/70 underline-offset-2 hover:underline">Cancel</button>
          </div>
        )}
      </section>
    </main>
  );
}
