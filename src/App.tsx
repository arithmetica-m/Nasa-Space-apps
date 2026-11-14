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
import { HealthRecord } from './components/HealthRecord';
import { CheckIn } from './components/CheckIn';
import { Today } from './components/watch/Today';
import { Teach } from './components/teach/Teach';
import { Act } from './components/act/Act';
import { KnowledgeBase } from './components/KnowledgeBase';
import { MissionDashboard } from './components/MissionDashboard';
import { EmergencyAlerts } from './components/EmergencyAlerts';
import { speak, useVoiceControl } from './components/VoiceControl';
import type { Selection } from './components/Frieze';
import { crew, inventoryFor, procedures as emergencyProcedures } from './emergency/data';
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

function initialEmergencyKnowledge(): EmergencyProcedure[] {
  const legacyScenarioIds = new Set(['DEMO-DCS-01', 'DEMO-ENV-02', 'DEMO-ANA-03', 'DEMO-BHP-04']);
  try {
    const raw = localStorage.getItem('chiron-kb-v1');
    if (!raw) return emergencyProcedures;
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return emergencyProcedures;
    const retained = saved.filter((value): value is EmergencyProcedure =>
      typeof value === 'object' && value !== null
      && 'id' in value && typeof value.id === 'string' && !legacyScenarioIds.has(value.id)
      && 'title' in value && typeof value.title === 'string'
      && 'category' in value && typeof value.category === 'string'
      && ['dcs', 'respiratory', 'anaphylaxis', 'behavioral'].includes(value.category)
      && 'steps' in value && Array.isArray(value.steps)
      && 'status' in value && ['approved', 'draft', 'superseded'].includes(String(value.status)),
    );
    return [...emergencyProcedures, ...retained];
  } catch (error) {
    console.warn('Could not migrate the saved scenario library; using current demo scenarios.', error);
    return emergencyProcedures;
  }
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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>();
  const [voiceConfirm, setVoiceConfirm] = useState(false);
  const [account, setAccount] = useAccount();
  // The mission's medical knowledge base, kept on the device (works offline).
  const [kb, setKb] = usePersisted<EmergencyProcedure[]>('chiron-kb-v2', initialEmergencyKnowledge);
  const log = useLog();
  const gmt = useGmt();
  const aspect = useAspect();
  const voice = useVoiceControl((text) => {
    const command = text.toLowerCase().replace(/[.!?]/g, '').trim();
    if (/open my health profile|show my health profile/.test(command)) {
      setSelectedProfile(account);
      setMode('watch');
      speak(`Opening your health profile, ${crew.find((member) => member.id === account)?.name ?? 'crew member'}.`);
    } else if (/show crew status|crew status/.test(command)) {
      setMode('watch');
      setSelectedProfile(undefined);
      speak('Crew status is displayed on the mission dashboard.');
    } else if (/check my readiness|readiness for the next task/.test(command)) {
      const needsAttention = (records[records.length - 1]?.drift ?? 0) >= 0.3;
      speak(needsAttention
        ? 'Your simulated readings need a review before the next task. Open Watch for details.'
        : 'No simulated readings are flagged for attention. Confirm readiness with your mission lead.');
      setMode('watch');
    } else if (/explain my radiation exposure|radiation exposure/.test(command)) {
      setMode('watch');
      speak(`The mission estimate is ${mission?.radiationPerDay ?? 0} millisieverts per day. This is a simulated estimate, not a personal dosimeter reading.`);
    } else if (/open emergency mode|open emergency response/.test(command)) {
      setVoiceConfirm(true);
      speak('Please confirm on screen to open emergency response.');
    } else if (/show available medical equipment|available medical equipment|show available equipment/.test(command)) {
      setInventoryOpen(true);
      const items = mission ? inventoryFor(mission.id).filter((item) => item.status === 'available' && item.quantity > 0) : [];
      speak(`${items.length} equipment items are marked available. The list is open on screen.`);
    } else {
      speak('Command not recognized. Try: open my health profile, show crew status, check my readiness, explain my radiation exposure, open emergency mode, or show available medical equipment.');
    }
  });

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
    setSelectedProfile(undefined);
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
          <div className="fade-in mt-4" style={{ animationDelay: '0.4s' }}><GreekKey width={220} /></div>
          <p className="rise mt-4 max-w-md text-sm text-marble/60" style={{ animationDelay: '0.5s' }}>
            Each mission changes the gravity, the delay to Earth and the care available on board.
          </p>
        </div>
      )}

      {/* WATCH: the everyday view */}
      {phase === 'mission' && mission && (
        <div className="fade-in absolute inset-0 flex flex-col overflow-y-auto">
          <MissionDashboard mission={mission} mode={mode} crew={crew} account={account} selectedProfile={selectedProfile}
            activePatientIds={[...new Set(casesFrom(log).filter((item) => !item.ended && item.mission === mission.id).map((item) => item.patientId))]}
            overallStatus={casesFrom(log).some((item) => !item.ended && item.mission === mission.id)
              ? 'Emergency response in progress'
              : todayCheckIn
                ? 'All clear · no immediate crew actions pending'
                : 'Routine crew check-in pending'}
            statusNeedsAttention={casesFrom(log).some((item) => !item.ended && item.mission === mission.id)}
            gmt={gmt} listening={voice.listening} voiceSupported={voice.supported}
            onMode={(next) => next === 'act' ? mode !== 'act' && openAct() : setMode(next)}
            onAccount={setAccount}
            onProfile={(id) => { setSelectedProfile(id); setMode('watch'); }}
            onCloseProfile={() => setSelectedProfile(undefined)}
            onEmergency={() => openAct()}
            onVoice={voice.toggle} onChangeMission={back} />

          {voice.message && <div role="status" className="mx-4 -mt-2 mb-2 text-right text-xs text-[#9be7ef] md:mx-8">{voice.message}</div>}

          {mode === 'watch' && selectedProfile && (
            <>
              <div className="flex flex-1 items-start px-4 py-2 md:px-8">
                <Today mission={mission} records={records} checkedIn={!!todayCheckIn || selectedProfile !== account}
                  name={crew.find((member) => member.id === selectedProfile)?.name.split(' ')[0]}
                  onCheckIn={() => setCheckInOpen(true)} onTeach={openTeach} onEmergency={() => openAct()} />
              </div>
              <HealthRecord mission={mission} records={records} marks={marks} selection={selection} onSelect={setSelection} />
            </>
          )}
        </div>
      )}

      {/* TEACH: appears when the astronaut needs to learn or follow a procedure */}
      {phase === 'mission' && mission && mode === 'teach' && (
        <Teach startWith={teachStart} uploaded={uploaded}
          onUpload={(p) => setUploaded((u) => [...u, p])}
          onComplete={(p) => addMark({ day: mission.today, kind: 'action', title: `Procedure: ${p.title.toLowerCase()}`, detail: `Completed all ${p.steps.length} steps with Chiron.` })}
          onMedicalLibrary={() => setLibraryOpen(true)}
          onClose={() => setMode('watch')} />
      )}

      {/* ACT: takes over in an emergency */}
      {phase === 'mission' && mission && mode === 'act' && (
        <Act mission={mission} reason={actReason} kb={kb} account={account} joinEid={joinEid} onLeave={leaveAct} />
      )}

      {libraryOpen && <KnowledgeBase kb={kb} onChange={setKb} onClose={() => setLibraryOpen(false)} />}

      {inventoryOpen && mission && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-[#020408]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
          <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-marble/20 bg-[#080d14] p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><div className="font-mono text-[10px] tracking-[0.2em] text-gold">MISSION SUPPORT</div><h2 id="inventory-title" className="mt-1 text-xl font-semibold text-marble">Medical equipment</h2></div>
              <button type="button" onClick={() => setInventoryOpen(false)} className="min-h-11 border border-marble/20 px-4 text-sm text-marble/75 hover:text-marble">Close</button>
            </div>
            <ul className="mt-5 divide-y divide-marble/10 border-y border-marble/10">
              {inventoryFor(mission.id).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><div className="text-sm text-marble">{item.name}</div><div className="mt-1 text-xs text-marble/50">{item.location} · quantity {item.quantity}</div></div>
                  <span className={`font-mono text-[10px] tracking-wider ${item.status === 'available' && item.quantity > 0 ? 'text-[#7bd5b8]' : 'text-[#e39b4b]'}`}>{item.status.toUpperCase()}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-marble/45">Simulated manifest for demonstration; verify the physical inventory before use.</p>
          </section>
        </div>
      )}

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

      {phase === 'mission' && mission && <EmergencyAlerts mission={mission.id} onJoin={joinAct} />}

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
          className="fixed bottom-4 right-4 z-[55] flex min-h-12 items-center gap-2 border border-[#e45b5b]/75 bg-[#1a0b10]/95 px-4 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#ff8585] shadow-lg backdrop-blur transition hover:bg-[#e45b5b]/20 disabled:cursor-default"
          aria-label={mode === 'act' ? 'Emergency response mode active' : 'Open emergency response'}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#e45b5b]" />
          {mode === 'act' ? 'EMERGENCY MODE' : 'EMERGENCY'}
        </button>
      )}
      <div className="pointer-events-none fixed bottom-1 left-3 z-40 text-[10px] text-mute/60">
        Simulated data for demonstration. Not clinical guidance.
      </div>
    </div>
  );
}
