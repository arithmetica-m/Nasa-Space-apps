import { useEffect, useRef, useState } from 'react';
import { BatteryLow, BookOpen, HeartPulse, Lock, MapPin, UserPlus, GraduationCap, Map, Mic, Settings, ShieldCheck, Siren, VolumeX, Watch, WifiOff } from 'lucide-react';
import type { Mission } from '../types';
import type { CrewMember } from '../emergency/types';
import { crewSummary, statusColor, statusLabel, type CrewHealth } from '../lib/crewHealth';
import { ago, type LinkStatus } from '../link/link';
import { phaseOf, whereIs } from './MissionTimeline';
import { MissionDial } from './SystemMap';
import { Avatar } from './Avatar';
import { AlertCard } from './AlertCard';

export type Page = 'home' | 'profile' | 'train' | 'respond' | 'link' | 'roadmap' | 'nasa' | 'demo' | 'medical' | 'mission';
export type MedicalPart = 'prevent' | 'train' | 'respond' | 'recover';
export const PAGE_NAME: Record<Page, string> = {
  home: 'Crew', profile: 'Astronaut', train: 'Medical system', medical: 'Medical system', mission: 'Mission',
  respond: 'Respond · emergency support', link: 'CHIRON LINK · wearables', roadmap: 'About CHIRON', nasa: 'NASA data in CHIRON', demo: 'Demonstration',
};

export interface SystemStatus { label: string; tone: 'ok' | 'warn' | 'alert'; detail: string; page?: Page }
const TONE = { ok: '#5cc8a8', warn: '#e39b4b', alert: '#e45b5b' };

interface HeaderProps {
  mission: Mission;
  crew: CrewMember[];
  account: string;
  gmt: string;
  online: boolean;
  status: SystemStatus;
  page: Page;
  listening: boolean;
  speaking: boolean;
  voiceSupported: boolean;
  onHome: () => void;
  onLogout: () => void;
  onVoice: () => void;
  onStopSpeaking: () => void;
  onChangeMission: () => void;
  onLibrary: () => void;
  onRoadmap: () => void;
  onOpen: (p: Page) => void;
  onMyProfile: () => void;
  ownProfile: boolean;   // the profile on screen is the signed-in person's own
}

// CHIRON CORE header: the same on every screen.
export function CoreHeader(p: HeaderProps) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close); };
  }, [menu]);
  const date = new Date().toISOString().slice(0, 10);

  return (
    <header className="mx-auto w-full max-w-[1200px] px-4 pt-4 md:px-8">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-marble/10 pb-3">
        <button type="button" onClick={p.onHome} className="flex items-center gap-2 font-serif text-xl tracking-[0.3em] text-marble" aria-label="CHIRON home">
          <span className="text-gold" aria-hidden="true">⚷</span> CHIRON
        </button>
        <div className="font-serif text-base tracking-[0.18em] text-marble/90">{p.mission.name.toUpperCase()}</div>
        <div className="font-mono text-xs tracking-[0.1em] text-marble/70">{date} · {p.gmt} GMT · <span className="text-gold">MISSION DAY {p.mission.today}</span></div>
        <div className={`flex items-center gap-1.5 font-mono text-xs tracking-[0.12em] ${p.online ? 'text-[#5cc8a8]' : 'text-[#e39b4b]'}`}
          title={p.online ? 'Connected' : 'No connection: CHIRON keeps working on this device'}>
          {p.online ? <span className="h-2 w-2 rounded-full bg-[#5cc8a8]" /> : <WifiOff size={14} />}{p.online ? 'ONLINE' : 'OFFLINE'}
        </div>
        {/* What needs attention right now, in plain words. Tap it to go there. */}
        <button type="button" onClick={() => p.status.page && p.onOpen(p.status.page)} disabled={!p.status.page}
          className="flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] tracking-[0.12em] enabled:hover:bg-white/5" style={{ borderColor: `${TONE[p.status.tone]}88`, color: TONE[p.status.tone] }}
          title={p.status.detail} aria-label={`Status: ${p.status.label}. ${p.status.detail}`}>
          <ShieldCheck size={14} /> {p.status.label}{p.status.page && ' →'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {p.account && <button type="button" onClick={p.onLogout} className="min-h-11 border border-gold/40 px-3 text-xs text-gold">LOG OUT</button>}
          <button type="button" onClick={p.onLibrary} aria-label="Open the medical library"
            className="flex min-h-11 items-center gap-2 border border-marble/15 px-3 font-mono text-xs tracking-[0.15em] text-marble/70 hover:border-gold/60 hover:text-marble">
            <BookOpen size={18} /> <span className="hidden sm:inline">LIBRARY</span>
          </button>
          {p.speaking && (
            <button type="button" onClick={p.onStopSpeaking} aria-label="Silence spoken response"
              className="flex min-h-11 min-w-11 items-center justify-center border border-[#e39b4b]/60 text-[#f3c28d] hover:bg-[#e39b4b]/10"><VolumeX size={18} /></button>
          )}
          <button type="button" onClick={p.onVoice} disabled={!p.voiceSupported} aria-label={p.listening ? 'Stop voice commands' : 'Start voice commands'} aria-pressed={p.listening}
            className={`flex min-h-11 min-w-11 items-center justify-center border transition ${p.listening ? 'border-gold bg-gold/15 text-gold' : 'border-marble/15 text-marble/70 hover:border-gold/60 hover:text-marble'} disabled:opacity-40`}>
            <Mic size={18} />
          </button>
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenu(!menu)} aria-label="Device settings" aria-expanded={menu}
              className="flex min-h-11 min-w-11 items-center justify-center border border-marble/15 text-marble/70 hover:border-gold/60 hover:text-marble">
              <Settings size={18} />
            </button>
            {menu && (
              <div className="absolute right-0 top-12 z-30 w-64 border border-marble/15 bg-void p-3 shadow-2xl">
                <p className="text-sm text-marble/80">{p.account ? `Signed in as ${p.crew.find((m) => m.id === p.account)?.name}` : 'Shared dashboard · no profile signed in'}</p>
                {p.account && <button type="button" onClick={() => { setMenu(false); p.onLogout(); }} className="mt-2 min-h-11 w-full border border-gold/50 text-gold">LOG OUT</button>}
                <button type="button" onClick={() => { setMenu(false); p.onOpen('demo'); }} className="mt-3 min-h-11 w-full bg-gold/90 font-mono text-xs tracking-[0.18em] text-void hover:bg-gold">▶ DEMONSTRATION</button>
                <button type="button" onClick={() => { setMenu(false); p.onRoadmap(); }} className="mt-2 min-h-11 w-full border border-marble/15 text-sm text-marble/80 hover:border-gold/60">About CHIRON and roadmap</button>
                <button type="button" onClick={() => { setMenu(false); p.onOpen('nasa'); }} className="mt-2 min-h-11 w-full border border-marble/15 text-sm text-marble/80 hover:border-gold/60">NASA data in CHIRON</button>
                <button type="button" onClick={() => { setMenu(false); p.onChangeMission(); }} className="mt-2 min-h-11 w-full border border-marble/15 text-sm text-marble/80 hover:border-gold/60">Change mission</button>
                <div className="mt-3 font-mono text-[10px] tracking-[0.15em] text-marble/40">EARTH DELAY {p.mission.delayLabel.toUpperCase()} EACH WAY</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <nav aria-label="Main sections" className="mt-2 flex flex-wrap gap-x-1 border-b border-marble/10">
        {([
          ['DASHBOARD', p.page === 'home', p.onHome],
          ['MY PROFILE', p.page === 'profile' && p.ownProfile, p.onMyProfile],
          ['CHIRON LINK', p.page === 'link', () => p.onOpen('link')],
          ['MEDICAL SYSTEM', p.page === 'medical' || p.page === 'train' || p.page === 'respond', () => p.onOpen('medical')],
          ['MISSION', p.page === 'mission', () => p.onOpen('mission')],
        ] as const).map(([label, active, go]) => (
          <button key={label} type="button" onClick={go} disabled={!p.account && label === 'MY PROFILE'} title={!p.account && label === 'MY PROFILE' ? 'Choose your profile and enter your PIN to unlock' : undefined} aria-current={active ? 'page' : undefined}
            className={`min-h-12 shrink-0 px-4 font-mono text-xs tracking-[0.18em] ${active ? 'border-b-2 border-gold text-gold' : 'text-marble/65 hover:text-marble'} disabled:opacity-40 disabled:cursor-not-allowed`}>{label}</button>
        ))}
      </nav>
    </header>
  );
}

export const roleOf = (m: CrewMember) => m.position.split(' · ').pop()!.toUpperCase();

const PARTS: [MedicalPart, string, string, typeof Siren][] = [
  ['prevent', 'PREVENT', 'Health and risk', ShieldCheck],
  ['train', 'TRAIN', 'Medical training', GraduationCap],
  ['respond', 'RESPOND', 'Emergency support', Siren],
  ['recover', 'RECOVER', 'Back to your normal', HeartPulse],
];

export function MedicalTiles({ lines, onOpen, signedIn = true }: { lines: Record<MedicalPart, string>; onOpen: (p: MedicalPart) => void; signedIn?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {PARTS.map(([id, name, sub, Icon]) => (
        <button key={id} type="button" onClick={() => onOpen(id)} disabled={id === 'recover' && !signedIn} title={id === 'recover' && !signedIn ? 'Sign in to use your recovery plan' : undefined}
          className={`flex min-h-[130px] flex-col border bg-void/75 p-4 text-left backdrop-blur-md hover:bg-void/90 disabled:opacity-40 disabled:cursor-not-allowed ${id === 'respond' ? 'border-[#e45b5b]/40 hover:border-[#e45b5b]' : 'border-marble/10 hover:border-gold/60'}`}>
          <Icon size={24} className={id === 'respond' ? 'text-[#ff8585]' : 'text-gold'} />
          <span className="mt-2 font-serif text-xl tracking-[0.2em] text-marble">{name}</span>
          <span className="text-sm text-marble/55">{sub}</span>
          <span className="mt-auto pt-2 text-base text-marble/85">{lines[id]}</span>
        </button>
      ))}
    </div>
  );
}

interface HomeProps {
  mission: Mission;
  crew: CrewMember[];
  account: string;
  health: Record<string, CrewHealth>;
  links: Record<string, LinkStatus>;
  now: number;
  tiles: Record<MedicalPart, string>;
  onMedical: (p: MedicalPart) => void;
  onProfile: (id: string) => void;
  onPage: (p: Page) => void;
  checkedIn: boolean;
  onCheckIn: () => void;
  onAddCrew: () => void;
}

// HOME: who is on board, how the crew is doing, and what CHIRON can do to help.
export function HomePage({ mission, crew, account, health, links, now, tiles, onMedical, onProfile, onPage, checkedIn, onCheckIn, onAddCrew }: HomeProps) {
  const bands = Object.values(links);
  const offline = bands.filter((b) => !b.connected);
  const bandAlerts = bands.reduce((n, b) => n + b.alerts.length, 0);

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 pb-24 pt-3 md:px-8">
      <section aria-labelledby="crew-status" className="flex items-center gap-4 border-l-4 border-gold bg-void/75 px-5 py-3 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <h2 id="crew-status" className="font-mono text-[11px] tracking-[0.25em] text-gold">HOW IS THE CREW DOING?</h2>
          <p className="mt-1 font-serif text-xl tracking-[0.08em] text-marble md:text-2xl" aria-live="polite">{crewSummary(crew.map((m) => health[m.id]?.status ?? 'nodata'))}</p>
        </div>
        <div className="hidden shrink-0 sm:block"><MissionDial mission={mission} size={112} /></div>
      </section>

      {bands.flatMap((b) => b.warnings.map((w) => ({ b, w }))).map(({ b, w }) => (
        <AlertCard key={b.crewId + w.key + w.t} band={b} w={w} crew={crew} links={links} now={now} onProfile={() => onProfile(b.crewId)} />
      ))}

      {!account && <p role="status" className="border border-gold/40 bg-void/80 p-4 text-marble">Shared mission tools and emergency response are available now. Choose your crew profile and enter your PIN for personal health features.</p>}
      {account && !checkedIn && (
        <button type="button" onClick={onCheckIn}
          className="flex min-h-16 w-full items-center justify-between gap-3 border border-gold/60 bg-gold/10 px-5 text-left backdrop-blur-md hover:bg-gold/20">
          <span className="text-lg text-marble">{crew.find((c) => c.id === account)?.name.split(' ')[0]}, your daily check-in is not done yet.</span>
          <span className="shrink-0 bg-gold px-5 py-3 font-mono text-sm tracking-[0.2em] text-void">CHECK IN</span>
        </button>
      )}

      <section aria-label="Crew members" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {crew.map((m) => {
          const h = health[m.id];
          const l = links[m.id];
          const color = statusColor[h.status];
          const alerts = l.alerts.length + (h.status === 'attention' ? 1 : 0);
          return (
            <button key={m.id} type="button" onClick={() => onProfile(m.id)}
              aria-label={`${m.name}, ${statusLabel[h.status]}. Open profile.`}
              className="flex min-h-[170px] flex-col border border-marble/10 bg-void/75 p-5 text-left backdrop-blur-md transition hover:border-gold/60 hover:bg-void/90"
              style={{ borderTop: `4px solid ${color}` }}>
              <div className="flex items-center gap-3">
                <Avatar id={m.id} name={m.name} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg tracking-[0.1em] text-marble">
                    {m.name.toUpperCase()}{m.id === account && <span className="ml-2 font-mono text-[10px] tracking-[0.2em] text-gold">YOU</span>}
                  </span>
                  <span className="block truncate text-xs tracking-[0.12em] text-marble/50">{roleOf(m)}</span>
                </span>
                {alerts > 0 && <span className="shrink-0 bg-[#e39b4b] px-2 py-0.5 font-mono text-[11px] text-void" title="Active alerts">{alerts} ALERT{alerts > 1 ? 'S' : ''}</span>}
              </div>
              <div className="mt-4 font-serif text-2xl font-bold tracking-[0.1em]" style={{ color }}>{statusLabel[h.status]}</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm tracking-[0.06em] text-marble/60">{/EMERGENCY/.test(h.comment) ? h.comment : <><Lock size={13} /> DETAILS PRIVATE</>}</div>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 font-mono text-[11px] tracking-[0.1em]">
                <span className={l.connected ? 'text-marble/60' : 'text-[#e39b4b]'}>
                  <Watch size={12} className="mr-1 inline" />
                  {l.connected ? `LINK ON · ${l.battery}%` : `LINK OFFLINE ${ago(l.lastSync, now).toUpperCase()}`}
                  {l.connected && l.battery < 25 && <BatteryLow size={12} className="ml-1 inline text-[#e39b4b]" />}
                </span>
                <span className={h.status === 'nodata' ? 'text-[#e39b4b]' : 'text-marble/45'}>{m.id === account && !checkedIn ? 'CHECK-IN DUE TODAY' : h.daysSinceLog === undefined ? 'NO CHECK-INS' : h.daysSinceLog === 0 ? 'CHECKED IN TODAY' : `CHECK-IN ${h.daysSinceLog}D AGO`}</span>
              </div>
            </button>
          );
        })}
        <button type="button" onClick={onAddCrew}
          className="flex min-h-[90px] items-center justify-center gap-2 border border-dashed border-marble/25 bg-void/60 p-4 text-lg text-marble/70 hover:border-gold/60 hover:text-marble">
          <UserPlus size={22} /> ADD A CREW MEMBER FROM A FILE
        </button>
      </section>

      <button type="button" onClick={() => onPage('link')}
        className="flex min-h-14 w-full flex-wrap items-center gap-x-6 gap-y-1 border border-marble/10 bg-void/75 px-5 py-3 text-left backdrop-blur-md hover:border-gold/60">
        <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-gold"><Watch size={16} /> CHIRON LINK</span>
        <span className="text-sm text-marble">{bands.length - offline.length} of {bands.length} wearables connected</span>
        {offline.length > 0 && <span className="text-sm text-[#e39b4b]">{offline.length} disconnected</span>}
        <span className={`text-sm ${bandAlerts ? 'text-[#e39b4b]' : 'text-marble/60'}`}>{bandAlerts} wearable alert{bandAlerts === 1 ? '' : 's'}</span>
        <span className="ml-auto font-mono text-xs tracking-[0.2em] text-marble/50">OPEN</span>
      </button>

      <section aria-labelledby="help-title">
        <h2 id="help-title" className="mb-2 font-mono text-[11px] tracking-[0.25em] text-gold">MEDICAL SYSTEM</h2>
        <MedicalTiles lines={tiles} onOpen={onMedical} signedIn={!!account} />
      </section>

      <button type="button" onClick={() => onPage('mission')}
        className="flex min-h-14 w-full flex-wrap items-center gap-x-6 gap-y-1 border border-marble/10 bg-void/75 px-5 py-3 text-left backdrop-blur-md hover:border-gold/60">
        <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-gold"><MapPin size={16} /> MISSION</span>
        <span className="text-sm text-marble">{whereIs(mission)}</span>
        <span className="text-sm text-marble/70">{phaseOf(mission)} · day {mission.today} of {mission.totalDays}</span>
        <span className="ml-auto font-mono text-xs tracking-[0.2em] text-marble/50">OPEN</span>
      </button>
      <nav aria-label="About this prototype" className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPage('demo')} className="min-h-12 bg-gold px-5 font-mono text-xs tracking-[0.18em] text-void hover:bg-marble">▶ DEMONSTRATION</button>
        <button type="button" onClick={() => onPage('nasa')} className="min-h-12 border border-gold/60 bg-void/75 px-5 font-mono text-xs tracking-[0.18em] text-gold hover:bg-gold/10">NASA DATA IN CHIRON</button>
        <button type="button" onClick={() => onPage('roadmap')} className="min-h-12 border border-marble/20 bg-void/75 px-5 font-mono text-xs tracking-[0.18em] text-marble/80 hover:border-gold/60">ABOUT CHIRON</button>
      </nav>
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-marble/40"><Map size={12} /> ALL HEALTH AND WEARABLE DATA IS SIMULATED · STATUS USES DEMO RULES, NOT APPROVED MEDICAL RULES</p>
    </main>
  );
}
