import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { DayRecord, Mark, MissionId } from './types';
import { missions } from './data/missions';
import { buildMarks, simulate } from './data/simulate';
import type { Procedure } from './data/procedures';
import { Earth, Mars, Moon, SUN_DIR } from './three/Planets';
import { CameraRig } from './three/CameraRig';
import { Routes } from './three/Routes';
import { INTRO_VIEW, backdropView, framing, selectView } from './three/space';
import { Intro } from './components/Intro';
import { GreekKey } from './components/Brand';
import { MissionProgress } from './components/MissionProgress';
import { HealthRecord } from './components/HealthRecord';
import { CheckIn } from './components/CheckIn';
import { Today } from './components/watch/Today';
import { Teach } from './components/teach/Teach';
import { Act } from './components/act/Act';
import { LiveBanner } from './components/act/LiveBanner';
import { KnowledgeBase } from './components/KnowledgeBase';
import type { Selection } from './components/Frieze';
import { crew, procedures as emergencyProcedures } from './emergency/data';
import type { Procedure as EmergencyProcedure } from './emergency/types';
import { useAccount } from './emergency/account';
import { useLog } from './emergency/sync';
import { casesFrom } from './emergency/plan';
import { usePersisted } from './emergency/store';

// The whole app is one continuous scene; each phase is a different camera view of it.
type Phase = 'intro' | 'select' | 'launch' | 'mission';
// Chiron's modes. Watch is the everyday view; Teach and Act appear only when needed.
type Mode = 'watch' | 'teach' | 'act';

interface TodayCheckIn { values: Record<string, number>; symptoms: string[]; time: string }

// Readings that should open emergency mode straight away. DEMO thresholds: replace with approved limits.
function dangerReason(v: Record<string, number>): string | undefined {
  if (v.hr !== undefined && (v.hr >= 130 || v.hr <= 40)) return `resting heart rate ${v.hr} bpm`;
  if (v.temp !== undefined && v.temp >= 39.5) return `temperature ${v.temp} °C`;
  if (v.glucose !== undefined && (v.glucose < 54 || v.glucose >= 300)) return `blood sugar ${v.glucose} mg/dL`;
  if (v.bp_sys !== undefined && (v.bp_sys >= 180 || v.bp_sys < 85)) return `blood pressure ${v.bp_sys} mmHg`;
  return undefined;
}

function useGmt() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toISOString().slice(11, 16);
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
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('watch');
  const [hovered, setHovered] = useState<MissionId>();
  const [chosen, setChosen] = useState<MissionId>();
  const [selection, setSelection] = useState<Selection>({ from: 0, to: 0 });
  const [checkIns, setCheckIns] = useState<Partial<Record<MissionId, TodayCheckIn>>>({});
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [teachStart, setTeachStart] = useState<string>();
  const [actReason, setActReason] = useState<string>();
  const [uploaded, setUploaded] = useState<Procedure[]>([]);
  const [extraMarks, setExtraMarks] = useState<Partial<Record<MissionId, Mark[]>>>({});
  const [joinEid, setJoinEid] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [account, setAccount] = useAccount();
  // The mission's medical knowledge base, kept on the device (works offline).
  const [kb, setKb] = usePersisted<EmergencyProcedure[]>('chiron-kb-v1', () => emergencyProcedures);
  const log = useLog();
  const gmt = useGmt();
  const aspect = useAspect();

  const mission = chosen ? missions[chosen] : undefined;
  const todayCheckIn = chosen ? checkIns[chosen] : undefined;

  // Simulated history, with today's check-in (if any) applied to the last day.
  const records = useMemo<DayRecord[]>(() => {
    if (!mission) return [];
    const sim = simulate(mission);
    if (!todayCheckIn) return sim;
    const last = sim[sim.length - 1];
    return [...sim.slice(0, -1), { ...last, logged: true, values: { ...last.values, ...todayCheckIn.values } }];
  }, [mission, todayCheckIn]);

  const marks = useMemo(() => {
    if (!records.length || !chosen) return [];
    const out = [...buildMarks(records), ...(extraMarks[chosen] ?? [])];
    // Emergencies from the shared log, so every crew device shows the same history.
    for (const c of casesFrom(log).filter((x) => x.mission === chosen)) {
      const who = crew.find((m) => m.id === c.patientId)?.name ?? c.patientId;
      out.push({ day: records.length - 1, kind: 'noticed', title: `Emergency: ${who}`, detail: `${c.category} emergency started at ${new Date(c.startedAt).toISOString().slice(11, 16)} GMT. ${c.ended ? 'Stood down.' : 'Still active.'}` });
    }
    if (todayCheckIn) {
      const extra = todayCheckIn.symptoms.length ? ` Symptoms: ${todayCheckIn.symptoms.join(', ').toLowerCase()}.` : '';
      out.push({ day: records.length - 1, kind: 'logged', title: `Daily check-in at ${todayCheckIn.time} GMT`, detail: `Logged and added to today's report to Earth.${extra}` });
    }
    return out;
  }, [records, todayCheckIn, extraMarks, chosen, log]);

  const addMark = (m: Mark) => chosen && setExtraMarks((x) => ({ ...x, [chosen]: [...(x[chosen] ?? []), m] }));

  const view = useMemo(() => {
    if (phase === 'intro') return INTRO_VIEW;
    if (phase === 'select' || !chosen) return selectView(aspect);
    return phase === 'launch' ? framing(chosen, aspect) : backdropView(chosen, aspect);
  }, [phase, chosen, aspect]);

  const endIntro = useCallback(() => setPhase('select'), []);

  const pick = (id: MissionId) => {
    setChosen(id);
    setHovered(undefined);
    setMode('watch');
    setSelection({ from: missions[id].today, to: missions[id].today });
    setPhase('launch');
    setTimeout(() => setPhase('mission'), 1700);
  };

  const back = () => {
    setChosen(undefined);
    setCheckInOpen(false);
    setMode('watch');
    setPhase('select');
  };

  const openTeach = (id?: string) => { setTeachStart(id); setMode('teach'); };
  const openAct = (reason?: string) => { setActReason(reason); setJoinEid(undefined); setMode('act'); };
  const joinAct = (eid: string) => { setJoinEid(eid); setMode('act'); };
  const leaveAct = () => { setActReason(undefined); setJoinEid(undefined); setMode('watch'); };

  return (
    <div className="relative h-full w-full bg-void">
      <Canvas camera={{ position: INTRO_VIEW.pos.toArray(), fov: 42, near: 0.05, far: 600 }} dpr={[1, 2]}>
        <color attach="background" args={['#04070d']} />
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
          <div className="fade-in mt-4" style={{ animationDelay: '0.4s' }}><GreekKey width={220} /></div>
          <p className="rise mt-4 max-w-md text-sm text-marble/60" style={{ animationDelay: '0.5s' }}>
            Each mission changes the gravity, the delay to Earth and the care available on board.
          </p>
        </div>
      )}

      {/* WATCH: the everyday view */}
      {phase === 'mission' && mission && (
        <div className="fade-in absolute inset-0 flex flex-col overflow-y-auto">
          <header className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 md:px-8">
            <div>
              <div className="font-mono text-[10px] tracking-[0.4em] text-gold">⚷ CHIRON</div>
              <div className="mt-1 font-serif text-2xl tracking-[0.2em] text-marble">{mission.name.toUpperCase()}</div>
              <button onClick={back} className="mt-2 font-mono text-[10px] tracking-[0.3em] text-mute transition hover:text-gold">← CHANGE MISSION</button>
            </div>
            <div className="order-3 flex w-full justify-center lg:order-none lg:w-auto lg:flex-1">
              <MissionProgress mission={mission} />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <label className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-marble/70">
                SIGNED IN AS
                <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Crew member using this device"
                  className="border border-marble/20 bg-void px-2 py-1 font-sans text-xs tracking-normal text-marble">
                  {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="font-mono text-[10px] tracking-[0.25em] text-marble/70 [text-shadow:0_1px_6px_#000,0_0_2px_#000]">
                {gmt} GMT · EARTH {mission.delayLabel.toUpperCase()} EACH WAY
              </div>
              <button onClick={() => setLibraryOpen(true)} className="font-mono text-[10px] tracking-[0.25em] text-mute hover:text-gold">MISSION MEDICAL LIBRARY</button>
            </div>
          </header>

          <LiveBanner mission={mission.id} account={account} kb={kb} onJoin={joinAct} />

          <div className="flex flex-1 items-start px-5 py-3 md:px-8">
            <Today mission={mission} records={records} checkedIn={!!todayCheckIn} name={crew.find((c) => c.id === account)?.name.split(" ")[0]}
              onCheckIn={() => setCheckInOpen(true)} onTeach={openTeach} onEmergency={() => openAct()} />
          </div>

          <HealthRecord mission={mission} records={records} marks={marks} selection={selection} onSelect={setSelection} />
        </div>
      )}

      {/* TEACH: appears when the astronaut needs to learn or follow a procedure */}
      {phase === 'mission' && mission && mode === 'teach' && (
        <Teach startWith={teachStart} uploaded={uploaded}
          onUpload={(p) => setUploaded((u) => [...u, p])}
          onComplete={(p) => addMark({ day: mission.today, kind: 'action', title: `Procedure: ${p.title.toLowerCase()}`, detail: `Completed all ${p.steps.length} steps with Chiron.` })}
          onClose={() => setMode('watch')} />
      )}

      {/* ACT: takes over in an emergency */}
      {phase === 'mission' && mission && mode === 'act' && (
        <Act mission={mission} reason={actReason} kb={kb} account={account} joinEid={joinEid} onLeave={leaveAct} />
      )}

      {libraryOpen && <KnowledgeBase kb={kb} onChange={setKb} onClose={() => setLibraryOpen(false)} />}

      {checkInOpen && mission && (
        <CheckIn
          latest={records[records.length - 1]}
          onClose={() => setCheckInOpen(false)}
          onDone={(values, symptoms) => {
            setCheckIns((c) => ({ ...c, [mission.id]: { values, symptoms, time: gmt } }));
            const reason = dangerReason(values);
            if (reason) { setCheckInOpen(false); openAct(`${reason}, above a demo threshold`); }
          }}
        />
      )}

      <div className="pointer-events-none absolute bottom-1 right-3 z-40 text-[10px] text-mute/60">
        Simulated data for demonstration. Not clinical guidance.
      </div>
    </div>
  );
}
