import { useEffect, useState, type ReactNode } from 'react';
import { Delete, Lock, ShieldCheck, Watch } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { publish } from '../emergency/sync';
import { accessRole, pinOf } from '../access/access';
import { statusColor, statusLabel, type CrewHealth } from '../lib/crewHealth';
import { ago, type LinkStatus } from '../link/link';
import { Avatar } from './Avatar';
import { roleOf } from './MissionDashboard';

// The PIN pad: four digits, big keys. Checks the PIN of `person`.
export function PinPad({ person, onOk, title }: { person: CrewMember; onOk: () => void; title: string }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(false);
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setWrong(false);
    setPin(next);
    if (next.length === 4) {
      if (next === pinOf(person)) onOk();
      else setTimeout(() => { setPin(''); setWrong(true); }, 250);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') setPin((p) => p.slice(0, -1)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section className="mx-auto w-full max-w-sm border border-gold/30 bg-void/85 p-5 text-center backdrop-blur-md" aria-label={title}>
      <h2 className="text-xl text-marble">{title}</h2>
      <div className="mt-4 flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-2 ${wrong ? 'border-[#e45b5b]' : 'border-gold'} ${i < pin.length ? 'bg-gold' : ''}`} />)}
      </div>
      {wrong && <p className="mt-2 text-lg text-[#ff8585]" role="alert">Wrong PIN. Try again.</p>}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="min-h-16 border border-marble/20 text-2xl text-marble hover:border-gold hover:bg-gold/10">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className="min-h-16 border border-marble/20 text-2xl text-marble hover:border-gold hover:bg-gold/10">0</button>
        <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete last digit" className="flex min-h-16 items-center justify-center border border-marble/20 text-marble/70 hover:border-gold"><Delete /></button>
      </div>
      <button type="button" onClick={() => setHint(!hint)} className="mt-3 min-h-10 text-sm text-marble/50 underline-offset-2 hover:underline">Prototype: show the demo PIN</button>
      {hint && <p className="text-base text-gold">Demo PIN for {person.name.split(' ')[0]}: {pinOf(person)}</p>}
    </section>
  );
}

const REASONS = ['They cannot answer for themselves', 'The medical officer asked me to', 'An emergency is in progress'];

// How the profile was opened this visit.
export type OpenedAs = 'owner' | 'medical' | 'emergency';

interface Props {
  viewer: CrewMember;          // whose device this is (named in the log for emergency access)
  owner: CrewMember;           // whose profile it is
  crew: CrewMember[];
  health: CrewHealth;
  link: LinkStatus;
  now: number;
  onOpened?: (as: OpenedAs) => void;
  children: (as: OpenedAs) => ReactNode;   // the full medical profile
}

// Stands in front of every medical profile. It locks again every time you leave the profile:
// the astronaut's own PIN is needed on each visit. Two logged ways in exist for other people:
// a medical officer with their own PIN, and emergency access with a reason.
export function ProfileGate({ viewer, owner, crew, health, link, now, onOpened, children }: Props) {
  const [opened, setOpened] = useState<OpenedAs>();
  const [way, setWay] = useState<'owner' | 'medical' | 'emergency'>('owner');
  const [officer, setOfficer] = useState<CrewMember>();
  const first = owner.name.split(' ')[0];
  const officers = crew.filter((m) => accessRole(m) === 'medical' && m.id !== owner.id);
  const open = (as: OpenedAs) => { setOpened(as); onOpened?.(as); };

  if (opened) {
    return (
      <>
        {opened !== 'owner' && (
          <p className="mx-auto mt-2 flex w-full max-w-[1200px] items-center gap-2 px-4 text-base text-[#f3c28d] md:px-8">
            <ShieldCheck size={18} /> {opened === 'medical' ? `Medical officer access by ${officer?.name}` : `Emergency access by ${viewer.name}`}: logged. {first} can see it.
          </p>
        )}
        {children(opened)}
      </>
    );
  }

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
          <span className="flex items-center gap-2 border border-marble/20 px-3 py-2 font-mono text-xs tracking-[0.18em] text-marble/70"><Lock size={14} /> PRIVATE PROFILE</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base text-marble/75">
          <span className={link.connected ? '' : 'text-[#f3c28d]'}><Watch size={16} className="mr-1 inline text-gold" />{link.connected ? `LINK connected · battery ${link.battery}%` : `LINK disconnected ${ago(link.lastSync, now)}`}</span>
          <span>{link.connected ? '' : 'Last known: '}{link.location}</span>
          <span>{link.activity}</span>
        </div>
      </section>

      {way === 'owner' && <PinPad key="owner" person={owner} title={`Enter ${first}’s PIN`} onOk={() => open('owner')} />}

      {way === 'medical' && !officer && (
        <section className="mx-auto w-full max-w-sm border border-gold/30 bg-void/85 p-5 backdrop-blur-md">
          <h2 className="text-xl text-marble">Which medical officer are you?</h2>
          <div className="mt-3 grid gap-2">
            {officers.map((m) => <button key={m.id} type="button" onClick={() => setOfficer(m)} className="min-h-16 border border-marble/25 px-4 text-left text-xl text-marble hover:border-gold">{m.name}</button>)}
            {officers.length === 0 && <p className="text-lg text-marble/70">No other medical officer in the crew.</p>}
          </div>
        </section>
      )}
      {way === 'medical' && officer && (
        <PinPad key={officer.id} person={officer} title={`${officer.name.split(' ')[0]}: enter your PIN`}
          onOk={() => { publish({ type: 'profile-access', by: officer.id, crewId: owner.id, role: 'medical' }); open('medical'); }} />
      )}

      {way === 'emergency' && (
        <section className="mx-auto w-full max-w-xl border-2 border-[#e45b5b]/60 bg-[#e45b5b]/[0.06] p-5">
          <h2 className="text-xl text-marble">Why do you need {first}’s medical profile?</h2>
          <div className="mt-3 grid gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => { publish({ type: 'profile-access', by: viewer.id, crewId: owner.id, role: 'emergency', reason: r }); open('emergency'); }}
                className="min-h-14 border border-marble/25 px-4 text-left text-lg text-marble hover:border-[#e45b5b] hover:bg-[#e45b5b]/10">{r}</button>
            ))}
          </div>
          <p className="mt-3 text-base text-marble/60">Your name ({viewer.name}), the time and the reason go in the medical log, where {first} and the medical officers see them.</p>
        </section>
      )}

      <div className="mx-auto flex w-full max-w-xl flex-wrap justify-center gap-2">
        {way !== 'owner' && <button type="button" onClick={() => { setWay('owner'); setOfficer(undefined); }} className="min-h-12 border border-marble/20 px-4 text-base text-marble/80">I am {first}</button>}
        {way !== 'medical' && <button type="button" onClick={() => setWay('medical')} className="min-h-12 border border-marble/20 px-4 text-base text-marble/80">I am a medical officer</button>}
        {way !== 'emergency' && <button type="button" onClick={() => setWay('emergency')} className="min-h-12 border border-[#e45b5b]/50 px-4 text-base text-[#ff9c9c]">Emergency access</button>}
      </div>
    </main>
  );
}
