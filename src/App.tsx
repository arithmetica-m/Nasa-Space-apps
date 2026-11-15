import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { DayRecord, Mark, MissionId } from './types';
import { missions } from './data/missions';
import { buildMarks } from './data/simulate';
import { crewHealth, recordsFor, type CrewHealth } from './lib/crewHealth';
import { SignIn } from './components/SignIn';
import { EMERGENCY_VOICE_EVENT, parseEmergency, parseCommand } from './lib/voiceCommands';
import type { Procedure } from './data/procedures';
import { Earth, Mars, Moon, SUN_DIR } from './three/Planets';
import { CameraRig } from './three/CameraRig';
import { Routes } from './three/Routes';
import { INTRO_VIEW, backdropView, framing, selectView } from './three/space';
import { Intro } from './components/Intro';
import { CheckIn } from './components/CheckIn';
import { Teach } from './components/teach/Teach';
import { Act } from './components/act/Act';
import { Library } from './components/library/Library';
import { OPEN_LIBRARY_EVENT } from './components/Explained';
import { CoreHeader, HomePage, type Page, type SystemStatus } from './components/MissionDashboard';
import { ProfilePage } from './components/pages/ProfilePage';
import { TrainPage } from './components/pages/TrainPage';
import { RespondPage } from './components/pages/RespondPage';
import { LinkPage } from './components/pages/LinkPage';
import { RoadmapPage } from './components/pages/RoadmapPage';
import { NasaPage } from './components/pages/NasaPage';
import { MissionPage } from './components/pages/MissionPage';
import { MedicalTiles, type MedicalPart } from './components/MissionDashboard';
import { PageShell } from './components/pages/ui';
import { readiness } from './prevent/readiness';
import { plansFor } from './recover/recovery';
import { ProfileGate } from './components/ProfileGate';
import { AddCrew } from './components/AddCrew';
import { DemoPage, type DemoAction } from './components/pages/DemoPage';
import { publish } from './emergency/sync';
import { SosAlerts } from './components/SosAlerts';
import { linkFor, useNow, withLinkEvents } from './link/link';
import { missionMemory } from './lib/memory';
import { skillStatus } from './train/training';
import { checkResources } from './emergency/engine';
import { EmergencyAlerts } from './components/EmergencyAlerts';
import { NEXT_STEP_EVENT, speak, stopSpeaking, useVoiceControl } from './components/VoiceControl';
import type { Selection } from './components/Frieze';
import { crew, procedures as emergencyProcedures } from './emergency/data';
import { useAccount } from './emergency/account';
import { useLog } from './emergency/sync';
import { casesFrom, inventoryNow } from './emergency/plan';
import { usePersisted } from './emergency/store';

// The whole app is one continuous scene; each phase is a different camera view of it.
type Phase = 'intro' | 'select' | 'launch' | 'mission';
// Contextual modes: everyday screens (watch), learning a procedure (teach), an active emergency (act).
type Mode = 'watch' | 'teach' | 'act';

interface TodayCheckIn { values: Record<string, number>; symptoms: string[]; time: string; at: number }

function useGmt() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toISOString().slice(11, 16);
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  return online;
}

function withCheckIn(sim: DayRecord[], ci?: TodayCheckIn): DayRecord[] {
  if (!ci) return sim;
  const last = sim[sim.length - 1];
  return [...sim.slice(0, -1), { ...last, logged: true, values: { ...last.values, ...ci.values } }];
}

// Setup (mission choice and sign-in) happens once per device and is remembered.
const MISSION_KEY = 'chiron-mission-v1';
function savedMission(): MissionId | undefined {
  try {
    const v = localStorage.getItem(MISSION_KEY);
    return v && v in missions ? (v as MissionId) : undefined;
  } catch { return undefined; }
}

function useAspect() {
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight);
  useEffect(() => {
    const on = () => setAspect(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return aspect;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(() => (savedMission() ? 'mission' : 'intro'));
  const [mode, setMode] = useState<Mode>('watch');
  const [page, setPage] = useState<Page>('home');
  const [hovered, setHovered] = useState<MissionId>();
  const [chosen, setChosen] = useState<MissionId | undefined>(savedMission);
  const [selection, setSelection] = useState<Selection>(() => {
    const m = savedMission();
    return m ? { from: missions[m].today, to: missions[m].today } : { from: 0, to: 0 };
  });
  // Check-ins are kept on the device, so they are part of the mission medical record.
  const [checkIns, setCheckIns] = usePersisted<Partial<Record<MissionId, Record<string, TodayCheckIn>>>>('chiron-checkins-v1', () => ({}));
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [teachStart, setTeachStart] = useState<string>();
  const [actReason, setActReason] = useState<string>();
  const [actPatient, setActPatient] = useState<string>();
  const [uploaded, setUploaded] = useState<Procedure[]>([]);
  const [extraMarks, setExtraMarks] = useState<Partial<Record<MissionId, Mark[]>>>({});
  const [joinEid, setJoinEid] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState<string>();
  useEffect(() => {
    const on = (e: Event) => { setLibraryEntry((e as CustomEvent<string | undefined>).detail); setLibraryOpen(true); };
    window.addEventListener(OPEN_LIBRARY_EVENT, on);
    return () => window.removeEventListener(OPEN_LIBRARY_EVENT, on);
  }, []);
  const [selectedProfile, setSelectedProfile] = useState<string>();
  const [voiceConfirm, setVoiceConfirm] = useState(false);
  const [account, setAccount, signedIn] = useAccount();
  const online = useOnline();
  // Approved emergency protocols. Read-only on board: only Mission Control releases new versions.
  const kb = emergencyProcedures;
  const log = useLog();
  const gmt = useGmt();
  const now = useNow();
  const aspect = useAspect();

  const [checkInFor, setCheckInFor] = useState<string>();   // whose check-in is open
  const [pendingCheckIn, setPendingCheckIn] = useState(false); // open it once the PIN is entered
  const [addCrew, setAddCrew] = useState(false);
  const me = crew.find((m) => m.id === account) ?? crew[0];
  const openProfile = (id: string) => { setSelectedProfile(id); setPage('profile'); setMode('watch'); };
  const goHome = () => { setPage('home'); setSelectedProfile(undefined); setMode('watch'); };

  const voice = useVoiceControl((text) => {
    const cmd = parseCommand(text, crew);
    const nameOf = (id: string) => crew.find((m) => m.id === id)?.name ?? 'crew member';
    // Inside emergency mode, short words drive the response: done, yes, no, can't, repeat.
    if (mode === 'act' && cmd.type !== 'silence') {
      const ev = parseEmergency(text, crew);
      if (ev.action || ev.category || ev.patientId) window.dispatchEvent(new CustomEvent(EMERGENCY_VOICE_EVENT, { detail: ev }));
      else speak('Say done, yes, no, can not, or repeat.');
      return;
    }
    switch (cmd.type) {
      // Saying "emergency" opens emergency mode at once. Naming a person or the problem fills those in.
      case 'emergency': {
        const ev = parseEmergency(text, crew);
        // An emergency is already running and nothing new was named: open that one.
        const running = activeCases[activeCases.length - 1];
        if (running && !ev.patientId && !ev.category) { joinAct(running.eid); speak('Opening the emergency.'); break; }
        openAct('Started by voice', ev.patientId);
        speak(ev.category ? 'Emergency mode.' : 'Emergency mode. Who needs help, and what is happening?');
        if (ev.category) setTimeout(() => window.dispatchEvent(new CustomEvent(EMERGENCY_VOICE_EVENT, { detail: ev })), 400);
        break;
      }
      case 'next':
        if (mode === 'act' || mode === 'teach') window.dispatchEvent(new Event(NEXT_STEP_EVENT));
        else speak('Open a procedure or an emergency first.');
        break;
      case 'silence': stopSpeaking(); break;
      case 'profile': {
        const id = cmd.crewId ?? account;
        openProfile(id);
        speak(`Opening ${id === account ? 'your' : `${nameOf(id)}'s`} dashboard.`);
        break;
      }
      case 'home': goHome(); speak('Crew status.'); break;
      case 'checkin': setPendingCheckIn(true); openProfile(account); speak('Enter your PIN to check in.'); break;
      case 'teach': setTrainFocus('train'); setPage('train'); setMode('watch'); speak('Opening training.'); break;
      case 'equipment': setPage('respond'); setMode('watch'); speak('Showing medical stock.'); break;
      case 'library': setLibraryOpen(true); speak('Opening the medical library.'); break;
      default: speak('Sorry, I did not catch that. Try crew status, my profile, check in, or emergency.');
    }
  });

  const mission = chosen ? missions[chosen] : undefined;
  const missionCheckIns = useMemo(() => (chosen && checkIns[chosen]) || {}, [chosen, checkIns]);

  // Every crew member's simulated history, with today's check-in applied to the last day.
  const recordsByCrew = useMemo(() => {
    const out: Record<string, DayRecord[]> = {};
    if (!mission) return out;
    for (const m of crew) out[m.id] = withCheckIn(recordsFor(mission, m.id), missionCheckIns[m.id]);
    return out;
  }, [mission, missionCheckIns]);

  const activeProfileId = selectedProfile ?? account;
  const records = recordsByCrew[activeProfileId] ?? [];
  const todayCheckIn = missionCheckIns[activeProfileId];
  const activeCases = useMemo(() => casesFrom(log).filter((c) => !c.ended && c.mission === chosen), [log, chosen]);

  // CHIRON LINK → CORE: each band's simulated readings, plus any new reading the band has sent.
  const links = useMemo(() => Object.fromEntries(crew.map((m) => [m.id, withLinkEvents(linkFor(m.id, recordsByCrew[m.id] ?? [], now), log)])), [recordsByCrew, now, log]);

  const health = useMemo(() => {
    const out: Record<string, CrewHealth> = {};
    const active = new Set(activeCases.map((c) => c.patientId));
    for (const m of crew) {
      if (!recordsByCrew[m.id]) continue;
      const h = crewHealth(recordsByCrew[m.id], active.has(m.id));
      const w = links[m.id]?.warnings ?? [];
      // A live LINK warning makes the status MEDICAL ATTENTION straight away.
      out[m.id] = w.length && h.status !== 'attention'
        ? { ...h, status: 'attention', comment: `LINK WARNING: ${w[0].label.toUpperCase()} ${w[0].value}${w[0].unit}`, reasons: [`LINK warning: ${w.map((x) => `${x.label} ${x.value} ${x.unit} (rule: ${x.rule})`).join('; ')} → MEDICAL ATTENTION.`, ...h.reasons] }
        : h;
    }
    return out;
  }, [recordsByCrew, activeCases, links]);
  const memoryAll = useMemo(() => (chosen ? missionMemory(log, chosen, missionCheckIns) : []), [log, chosen, missionCheckIns]);

  // Overall medical system status, most important first.
  const status = useMemo<SystemStatus>(() => {
    if (!mission) return { label: 'READY', tone: 'ok', detail: '' };
    if (activeCases.length) return { label: 'EMERGENCY ACTIVE', tone: 'alert', detail: `${activeCases.length} active emergency response(s).` };
    const stock = inventoryNow(log, mission.id);
    const gaps = kb.filter((p) => p.status === 'approved' && p.missions.includes(mission.id)).flatMap((p) => checkResources(p, stock)).filter((c) => !c.ok && !c.alternative);
    if (gaps.length) return { label: 'CHECK STOCK', tone: 'warn', detail: `Missing for an approved procedure: ${[...new Set(gaps.map((g) => g.name))].join(', ')}.` };
    const offline = Object.values(links).filter((l) => !l.connected).length;
    if (offline) return { label: 'LINK OFFLINE', tone: 'warn', detail: `${offline} wearable(s) disconnected.` };
    return { label: 'READY', tone: 'ok', detail: 'Protocols, equipment and wearables ready.' };
  }, [mission, activeCases, log, kb, links]);

  // One live line for each of the four main functions on the home screen.
  const [trainFocus, setTrainFocus] = useState<'prevent' | 'train'>('prevent');
  const tiles = useMemo<Record<MedicalPart, string>>(() => {
    if (!mission) return { prevent: '', train: '', respond: '', recover: '' };
    const due = skillStatus(account, mission.id).filter((s) => s.due).length;
    const gaps = readiness(kb, mission.id).filter((r) => !r.ready).length;
    const todo = plansFor(account, recordsByCrew[account] ?? []).length;
    return {
      prevent: gaps ? `${gaps} emergencies need preparation` : 'Crew is prepared',
      train: due ? `${due} refresher${due > 1 ? 's' : ''} due for you` : 'Your skills are up to date',
      respond: activeCases.length ? `${activeCases.length} ACTIVE EMERGENCY` : status.label === 'CHECK STOCK' ? 'No emergencies · check stock' : 'No active emergencies',
      recover: todo ? `${todo} reading${todo > 1 ? 's' : ''} to bring back to normal` : 'You are at your normal',
    };
  }, [mission, account, kb, recordsByCrew, activeCases, status]);
  const openMedical = (part: MedicalPart) => {
    setMode('watch');
    if (part === 'respond') setPage('respond');
    else if (part === 'recover') openProfile(account);
    else { setTrainFocus(part); setPage('train'); }
  };

  const marks = useMemo(() => {
    if (!records.length || !chosen) return [];
    const out = [...buildMarks(records), ...(extraMarks[chosen] ?? [])];
    for (const c of casesFrom(log).filter((x) => x.mission === chosen && x.patientId === activeProfileId)) {
      out.push({ day: records.length - 1, kind: 'noticed', title: 'Emergency response', detail: `${c.category} emergency started at ${new Date(c.startedAt).toISOString().slice(11, 16)} GMT. ${c.ended ? 'Closed.' : 'Still active.'}` });
    }
    if (todayCheckIn) {
      const extra = todayCheckIn.symptoms.length ? ` Symptoms: ${todayCheckIn.symptoms.join(', ').toLowerCase()}.` : '';
      out.push({ day: records.length - 1, kind: 'logged', title: `Daily check-in at ${todayCheckIn.time} GMT`, detail: `Logged and added to today's report to Earth.${extra}` });
    }
    return out;
  }, [records, todayCheckIn, extraMarks, chosen, log, activeProfileId]);

  const addMark = (m: Mark) => chosen && setExtraMarks((x) => ({ ...x, [chosen]: [...(x[chosen] ?? []), m] }));

  const view = useMemo(() => {
    if (phase === 'intro') return INTRO_VIEW;
    if (phase === 'select' || !chosen) return selectView(aspect);
    return phase === 'launch' ? framing(chosen, aspect) : backdropView(chosen, aspect);
  }, [phase, chosen, aspect]);

  const endIntro = useCallback(() => setPhase('select'), []);

  const pick = (id: MissionId) => {
    setChosen(id);
    setSelectedProfile(undefined);
    setPage('home');
    setHovered(undefined);
    setMode('watch');
    setSelection({ from: missions[id].today, to: missions[id].today });
    setPhase('launch');
    try { localStorage.setItem(MISSION_KEY, id); } catch { /* ignore */ }
    setTimeout(() => setPhase('mission'), 1700);
  };

  const back = () => {
    try { localStorage.removeItem(MISSION_KEY); } catch { /* ignore */ }
    setSelectedProfile(undefined);
    setChosen(undefined);
    setCheckInOpen(false);
    setMode('watch');
    setPage('home');
    setPhase('select');
  };

  const openTeach = (id?: string) => { setTeachStart(id); setMode('teach'); };
  const openAct = (reason?: string, patient?: string) => { setActReason(reason); setActPatient(patient); setJoinEid(undefined); setMode('act'); };
  const joinAct = (eid: string) => { setJoinEid(eid); setMode('act'); };
  const leaveAct = () => { setActReason(undefined); setActPatient(undefined); setJoinEid(undefined); setMode('watch'); };
  const member = crew.find((m) => m.id === selectedProfile);

  // EVERYONE IS NOTIFIED: a new emergency opens the live emergency screen on every device, once.
  useEffect(() => {
    const newest = activeCases[activeCases.length - 1];
    if (!newest) return;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem('chiron-seen-emergencies') ?? '[]'); } catch { /* ignore */ }
    if (seen.includes(newest.eid)) return;
    try { sessionStorage.setItem('chiron-seen-emergencies', JSON.stringify([...seen, newest.eid])); } catch { /* ignore */ }
    if (mode !== 'act') joinAct(newest.eid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCases]);

  // The demonstration: each step opens the real screen and, where needed, makes the simulated event happen.
  const demo = (a: DemoAction) => {
    if (a === 'prepare') { setTrainFocus('prevent'); setPage('train'); }
    if (a === 'monitor') { publish({ type: 'link-reading', by: 'ana', crewId: 'ana', key: 'spo2', value: 89 }); goHome(); }
    if (a === 'emergency') openAct('LINK warning: blood oxygen 89%', 'ana');
    if (a === 'coordinate') setPage('link');
    if (a === 'recover') openProfile('ana');
    if (a === 'nasa') setPage('nasa');
    if (a === 'future') setPage('roadmap');
    if (a === 'reset') {
      // Start the story clean: Ana's band back to normal, open emergencies and band alarms closed.
      publish({ type: 'link-clear', by: 'ana', crewId: 'ana' });
      for (const c of activeCases) publish({ type: 'end', eid: c.eid, by: account });
      for (const e of log) if (e.type === 'sos' && !log.some((x) => x.type === 'sos-clear' && x.sosId === e.id)) publish({ type: 'sos-clear', by: account, sosId: e.id });
    }
  };

  return (
    <div className="relative h-full w-full bg-void">
      <Canvas camera={{ position: INTRO_VIEW.pos.toArray(), fov: 42, near: 0.05, far: 600 }} dpr={[1, 2]}>
        <color attach="background" args={['#070b12']} />
        <ambientLight intensity={0.06} />
        <directionalLight position={SUN_DIR.clone().multiplyScalar(30).toArray()} intensity={2.6} />
        <Stars radius={180} depth={80} count={7000} factor={5} saturation={0} fade speed={0.3} />
        <Suspense fallback={null}>
          <Earth />
          <Moon />
          <Mars />
        </Suspense>
        <Routes active={phase === 'select'} hovered={hovered} chosen={phase === 'launch' ? chosen : undefined} onHover={setHovered} onPick={pick} />
        <CameraRig pos={view.pos} look={view.look} speed={phase === 'intro' ? 0.8 : 1.2} />
      </Canvas>

      {phase === 'intro' && <Intro onDone={endIntro} />}

      {phase === 'select' && (
        <div className="pointer-events-none absolute inset-x-0 top-10 flex flex-col items-center text-center">
          <div className="rise font-mono text-[10px] tracking-[0.4em] text-mute">⚷ CHIRON</div>
          <h2 className="rise mt-3 font-serif text-3xl tracking-[0.25em] text-marble md:text-4xl" style={{ animationDelay: '0.15s' }}>CHOOSE YOUR MISSION</h2>
          <p className="rise mt-4 max-w-md text-sm text-marble/60" style={{ animationDelay: '0.5s' }}>
            Each mission changes the gravity, the delay to Earth and the care available on board.
          </p>
        </div>
      )}

      {/* CHIRON CORE: header on every screen, then the current page */}
      {phase === 'mission' && mission && (
        <div className="fade-in absolute inset-0 flex flex-col overflow-y-auto">
          <CoreHeader mission={mission} crew={crew} account={account} gmt={gmt} online={online} status={status} page={page}
            listening={voice.listening} speaking={voice.speaking} voiceSupported={voice.supported}
            onHome={goHome} onAccount={setAccount} onVoice={voice.toggle} onStopSpeaking={stopSpeaking} onChangeMission={back}
            onLibrary={() => { setLibraryEntry(undefined); setLibraryOpen(true); }} onRoadmap={() => setPage('roadmap')} onMyProfile={() => openProfile(account)} ownProfile={selectedProfile === account} onOpen={(p) => { setMode('watch'); setPage(p); }} />

          {voice.message && <div role="status" className="mx-auto w-full max-w-[1200px] px-4 pt-2 text-right text-sm text-gold md:px-8">{voice.message}</div>}

          {page === 'home' && (
            <HomePage mission={mission} crew={crew} account={account} health={health} links={links} now={now} tiles={tiles} onMedical={openMedical}
              onProfile={openProfile} onPage={(p) => { setPage(p); setMode('watch'); }}
              checkedIn={!!missionCheckIns[account]} onCheckIn={() => { setPendingCheckIn(true); openProfile(account); }} onAddCrew={() => setAddCrew(true)} />
          )}
          {page === 'profile' && member && health[member.id] && (
            <ProfileGate key={member.id} viewer={me} owner={member} crew={crew} health={health[member.id]} link={links[member.id]} now={now}
              onOpened={(as) => { if (as === 'owner' && pendingCheckIn) { setCheckInFor(member.id); setCheckInOpen(true); } setPendingCheckIn(false); }}>
              {(as) => (
                <ProfilePage mission={mission} member={member} account={as === 'owner' ? member.id : '-'} health={health[member.id]} link={links[member.id]} now={now}
                  records={records} marks={marks} selection={selection} onSelect={setSelection}
                  checkedIn={!!todayCheckIn} symptoms={todayCheckIn?.symptoms ?? []}
                  memory={missionMemory(log, mission.id, missionCheckIns, member.id)}
                  onCheckIn={() => { setCheckInFor(member.id); setCheckInOpen(true); }} onTeach={openTeach} onEmergency={() => openAct(undefined, member.id)}
                  onReading={(values) => setCheckIns((c) => {
                    const prev = c[mission.id]?.[member.id];
                    return { ...c, [mission.id]: { ...c[mission.id], [member.id]: { values: { ...prev?.values, ...values }, symptoms: prev?.symptoms ?? [], time: gmt, at: Date.now() } } };
                  })} />
              )}
            </ProfileGate>
          )}
          {page === 'train' && <TrainPage mission={mission} crew={crew} account={account} records={recordsByCrew[account] ?? []} kb={kb} onGuide={(id) => openTeach(id)} onStock={() => setPage('respond')} focus={trainFocus} />}
          {page === 'medical' && <PageShell title="MEDICAL SYSTEM"><MedicalTiles lines={tiles} onOpen={openMedical} /></PageShell>}
          {page === 'mission' && <MissionPage mission={mission} crew={crew} links={links} now={now} />}
          {page === 'respond' && <RespondPage mission={mission} kb={kb} memory={memoryAll.filter((m) => m.kind === 'Emergency')} crewWide={false} onStart={() => openAct()} onJoin={joinAct} />}
          {page === 'link' && <LinkPage mission={mission.id} crew={crew} links={links} kb={kb} now={now} onProfile={openProfile} account={account} onJoin={joinAct} />}
          {page === 'roadmap' && <RoadmapPage onOpen={(p) => setPage(p)} />}
          {page === 'nasa' && <NasaPage onPage={(p) => (p === 'profile' ? openProfile(account) : setPage(p))} />}
          {page === 'demo' && <DemoPage mission={mission} onAction={demo} />}
        </div>
      )}

      {/* TEACH: a procedure, step by step */}
      {phase === 'mission' && mission && mode === 'teach' && (
        <Teach startWith={teachStart} uploaded={uploaded}
          onUpload={(p) => setUploaded((u) => [...u, p])}
          onComplete={(p) => addMark({ day: mission.today, kind: 'action', title: `Procedure: ${p.title.toLowerCase()}`, detail: `Completed all ${p.steps.length} steps with Chiron.` })}
          onMedicalLibrary={() => setLibraryOpen(true)}
          onClose={() => setMode('watch')} />
      )}

      {/* ACT: takes over in an emergency */}
      {phase === 'mission' && mission && mode === 'act' && (
        <Act key={joinEid ?? "new"} mission={mission} reason={actReason} kb={kb} account={account} joinEid={joinEid} patient={actPatient} onLeave={leaveAct}
          listening={voice.listening} voiceSupported={voice.supported} onVoice={voice.toggle} />
      )}

      {libraryOpen && mission && (
        <Library mission={mission.id} kb={kb} startWith={libraryEntry}
          onGuide={(id) => { setLibraryOpen(false); setLibraryEntry(undefined); setTeachStart(id); setMode('teach'); }}
          onClose={() => { setLibraryOpen(false); setLibraryEntry(undefined); }} />
      )}

      {checkInOpen && mission && checkInFor && recordsByCrew[checkInFor] && (
        <CheckIn
          latest={recordsByCrew[checkInFor][recordsByCrew[checkInFor].length - 1]}
          onClose={() => setCheckInOpen(false)}
          onTeach={(procedureId) => { setTeachStart(procedureId); setMode('teach'); }}
          crewId={checkInFor}
          onDone={(values, symptoms) => {
            setCheckIns((c) => ({ ...c, [mission.id]: { ...c[mission.id], [checkInFor]: { values, symptoms, time: gmt, at: Date.now() } } }));
          }}
        />
      )}
      {addCrew && <AddCrew crew={crew} onClose={() => setAddCrew(false)} />}

      {phase === 'mission' && mission && !signedIn && <SignIn crew={crew} mission={mission} onDone={setAccount} />}

      {phase === 'mission' && mission && <EmergencyAlerts mission={mission.id} account={account} inResponse={mode === 'act'} viewingEid={mode === 'act' ? joinEid : undefined} onJoin={joinAct} />}
      {phase === 'mission' && mission && <SosAlerts hidden={mode === 'act'} account={account} onRespond={(id) => openAct('LINK emergency button pressed', id)} />}

      {voiceConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020408]/85 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="voice-confirm-title">
          <section className="w-full max-w-md border border-[#e45b5b]/70 bg-[#100c10] p-6 shadow-2xl">
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#ff8585]">VOICE COMMAND CONFIRMATION</div>
            <h2 id="voice-confirm-title" className="mt-2 text-xl font-semibold text-marble">Open emergency response?</h2>
            <p className="mt-2 text-sm text-marble/65">This opens the response screen only. A crew member must still report and confirm an emergency there.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setVoiceConfirm(false)} className="min-h-11 border border-marble/25 px-4 text-sm text-marble/80">Cancel</button>
              <button type="button" onClick={() => { setVoiceConfirm(false); openAct(); }} className="min-h-11 bg-[#e45b5b] px-4 font-mono text-xs font-semibold tracking-wider text-[#130709]">OPEN RESPONSE</button>
            </div>
          </section>
        </div>
      )}

      {phase === 'mission' && (
        <button type="button" onClick={() => mode !== 'act' && openAct()} disabled={mode === 'act'}
          className="fixed bottom-4 right-4 z-[55] flex min-h-14 items-center gap-2 border-2 border-[#e45b5b] bg-[#1a0b10]/95 px-5 font-mono text-xs font-semibold tracking-[0.16em] text-[#ff8585] shadow-lg backdrop-blur transition hover:bg-[#e45b5b]/20 disabled:cursor-default"
          aria-label={mode === 'act' ? 'Emergency mode active' : 'Open emergency mode'}>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e45b5b]" />
          EMERGENCY MODE
        </button>
      )}
      <div className="pointer-events-none fixed bottom-1 left-3 z-40 text-[10px] text-mute/60">
        Simulated data for demonstration. Not clinical guidance.
      </div>
    </div>
  );
}
