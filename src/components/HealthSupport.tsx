import { useEffect, useMemo, useState } from 'react';
import { Activity, Bone, HeartPulse, Moon, Radiation, RefreshCw, WifiOff } from 'lucide-react';
import type { DayRecord, Mission } from '../types';
import { crew } from '../emergency/data';
import type { DemoMedicalProfile } from '../emergency/types';

const bodyImageUrl = new URL('../../body.png', import.meta.url).href;

type SystemId = 'cardiovascular' | 'respiratory' | 'musculoskeletal' | 'sleep' | 'radiation';
type Measurement = { id: string; value: number; unit: string; at: string; source: string; context: string; quality: string };
type Reflection = { day: string; energy: number; fatigue: number; sleep: number; wellbeing: number; symptoms: string; comments: string };
type ReportedSymptom = { area: string; note: string; at: string };

const SYSTEMS: { id: SystemId; label: string; icon: typeof HeartPulse; explanation: string; measures: string[] }[] = [
  { id: 'cardiovascular', label: 'Heart', icon: HeartPulse, explanation: 'See heart readings and recovery.', measures: ['hr', 'recovery'] },
  { id: 'respiratory', label: 'Breathing', icon: Activity, explanation: 'See breathing readings. Missing data does not mean everything is okay.', measures: ['spo2', 'breathing'] },
  { id: 'musculoskeletal', label: 'Muscles & bones', icon: Bone, explanation: 'See activity and body soreness.', measures: ['activity', 'soreness'] },
  { id: 'sleep', label: 'Sleep & tiredness', icon: Moon, explanation: 'See sleep and tiredness.', measures: ['sleep_h', 'fatigue'] },
  { id: 'radiation', label: 'Radiation', icon: Radiation, explanation: 'See radiation readings. Check the source and units.', measures: ['dose_rate', 'dose_total'] },
];

const MEASURES = [
  { id: 'hr', name: 'Heart rate', unit: 'bpm', hint: 'Use a mission medical monitor or manually enter its displayed value.' },
  { id: 'spo2', name: 'Oxygen saturation', unit: '%', hint: 'Use a pulse oximeter. If unavailable, record as missing rather than estimating.' },
  { id: 'sleep_h', name: 'Sleep duration', unit: 'hours', hint: 'Use a sleep record or manually enter your estimate.' },
  { id: 'activity', name: 'Activity / exercise', unit: 'minutes', hint: 'Enter the completed activity duration for context.' },
  { id: 'recovery', name: 'Recovery time', unit: 'minutes', hint: 'Enter time to return to your usual post-activity state, if recorded.' },
  { id: 'fatigue', name: 'Fatigue', unit: '1–5', hint: 'Self-report: 1 = none, 5 = very high.' },
  { id: 'dose_rate', name: 'Radiation dose rate', unit: 'mSv/day', hint: 'Enter only from an available mission dosimeter record.' },
  { id: 'dose_total', name: 'Cumulative radiation dose', unit: 'mSv', hint: 'Enter only from an available mission dosimeter record.' },
];

const SCENARIOS = [
  { title: 'Poor sleep before a demanding task', text: 'Several short nights may coincide with reduced alertness and slower recovery. Planning options: review workload, protect rest opportunity and ask the medical/mission lead to review the task. This is not a prediction or clearance decision.' },
  { title: 'Cardiovascular recovery changes', text: 'A slower recovery pattern than this astronaut’s own comparable activity history may merit a measurement-quality check and medical review. CHIRON does not determine a cause.' },
  { title: 'Increasing fatigue during a busy period', text: 'Fatigue together with increased activity and reduced sleep may affect workload planning. Compare reports with the schedule and discuss options with the mission lead.' },
  { title: 'Higher radiation exposure estimate', text: 'A higher dose rate and cumulative dose represent different information. Confirm instrument source, units and mission-authorized limits with the radiation/medical team; no limit is configured in this demo.' },
  { title: 'Crew member unavailable for a task', text: 'Re-check crew availability and the task schedule, then ask Mission Control to review staffing. This tool does not reassign duties or change medical clearance.' },
];
const REFERENCES = [
  ['NASA Human Spaceflight Risks', 'https://www.nasa.gov/hrp/risks/'],
  ['NASA Ongoing HRP Research', 'https://www.nasa.gov/hrp/ongoing-hrp-research/'],
  ['NASA-STD-3001', 'https://www.nasa.gov/reference/nasa-std-3001v1/'],
  ['NASA Integrated Medical Model', 'https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/'],
  ['NASA In-Flight Medical Care', 'https://www.nasa.gov/ochmo/health-and-medical-systems/in-flight-medical-care/'],
  ['CSA Radiation Monitoring', 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp'],
];

const dayKey = () => new Date().toISOString().slice(0, 10);
const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch (error) {
    console.warn(`Could not read local health data (${key}).`, error);
    return fallback;
  }
};

function useLocalData<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError(false);
    } catch (error) {
      console.error(`Could not save local health data (${key}).`, error);
      setStorageError(true);
    }
  }, [key, value]);
  return { value, setValue, storageError };
}

interface Props {
  astronautId: string;
  astronautName: string;
  mission: Mission;
  records: DayRecord[];
}

export function HealthSupport({ astronautId, astronautName, mission, records }: Props) {
  const [system, setSystem] = useState<SystemId>('cardiovascular');
  const [measureId, setMeasureId] = useState('hr');
  const [measureValue, setMeasureValue] = useState('');
  const [measureContext, setMeasureContext] = useState('rest');
  const [measureSource, setMeasureSource] = useState('');
  const [measureNotice, setMeasureNotice] = useState('');
  const [scenario, setScenario] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [bodyArea, setBodyArea] = useState('Heart');
  const [customArea, setCustomArea] = useState('');
  const [symptomNote, setSymptomNote] = useState('');
  const [symptomNotice, setSymptomNotice] = useState('');
  const measuresKey = `chiron-measurements-v1-${astronautId}`;
  const reflectionKey = `chiron-reflections-v1-${astronautId}`;
  const medicalKey = `chiron-medical-profile-v1-${astronautId}`;
  const symptomsKey = `chiron-symptoms-v1-${astronautId}`;
  const { value: measurements, setValue: setMeasurements, storageError: measureStorageError } = useLocalData<Measurement[]>(measuresKey, []);
  const { value: reflections, setValue: setReflections, storageError: reflectionStorageError } = useLocalData<Reflection[]>(reflectionKey, []);
  const { value: symptomReports, setValue: setSymptomReports, storageError: symptomStorageError } = useLocalData<ReportedSymptom[]>(symptomsKey, []);
  const sampleMedical = crew.find((member) => member.id === astronautId)?.medical;
  const { value: medicalProfile, setValue: setMedicalProfile, storageError: medicalStorageError } = useLocalData<DemoMedicalProfile>(medicalKey, {
    allergies: sampleMedical?.allergies ?? [],
    medications: sampleMedical?.medications ?? [],
    restrictions: sampleMedical?.restrictions ?? [],
    history: sampleMedical?.history ?? sampleMedical?.conditions ?? [],
    baselineNotes: sampleMedical?.notes ?? '',
    author: 'Simulated Earth medical team',
    version: 'demo-1',
    status: 'sample',
    updatedAt: '',
  });
  const todayReflection = reflections.find((item) => item.day === dayKey());
  const [reflection, setReflection] = useState<Omit<Reflection, 'day'>>({ energy: 3, fatigue: 3, sleep: 3, wellbeing: 3, symptoms: '', comments: '' });
  const previousReflection = [...reflections].filter((item) => item.day < dayKey()).sort((a, b) => b.day.localeCompare(a.day))[0];
  const selectedSystem = SYSTEMS.find((item) => item.id === system)!;
  const Icon = selectedSystem.icon;
  const trend = useMemo(() => {
    const latest = records.slice(-7);
    const sleep = latest.map((record) => record.values.sleep_h).filter((value): value is number => value !== undefined);
    const heart = latest.map((record) => record.values.hr).filter((value): value is number => value !== undefined);
    const activity = latest.map((record) => record.values.activity).filter((value): value is number => value !== undefined);
    const activitySleepContext = sleep.length >= 2 && activity.length >= 2
      ? `Across the recent simulated series, activity changed ${activity[activity.length - 1] - activity[0]} min and sleep changed ${(sleep[sleep.length - 1] - sleep[0]).toFixed(1)} h. These changes occurred together; this does not establish a cause.`
      : 'Recent activity/sleep context is incomplete; no relationship can be summarized.';
    return {
      sleep: sleep.length >= 2 ? sleep[sleep.length - 1] - sleep[0] : undefined,
      heart: heart.length >= 2 ? heart[heart.length - 1] - heart[0] : undefined,
      activitySleepContext,
      coverage: `${sleep.length} of ${latest.length} sleep values · ${heart.length} of ${latest.length} heart-rate values`,
    };
  }, [records]);
  const nextTask = mission.milestones.find((item) => item.day > mission.today);
  const selfReportNeedsReview = (todayReflection ?? previousReflection)?.fatigue >= 4 || (todayReflection ?? previousReflection)?.sleep <= 2;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    setReflection(todayReflection
      ? { energy: todayReflection.energy, fatigue: todayReflection.fatigue, sleep: todayReflection.sleep, wellbeing: todayReflection.wellbeing, symptoms: todayReflection.symptoms, comments: todayReflection.comments }
      : { energy: 3, fatigue: 3, sleep: 3, wellbeing: 3, symptoms: '', comments: '' });
  }, [astronautId, todayReflection]);

  const saveMeasurement = () => {
    const definition = MEASURES.find((item) => item.id === measureId)!;
    const value = Number(measureValue);
    if (!measureValue.trim() || !Number.isFinite(value)) {
      setMeasureNotice('Enter a numeric reading, or leave it unavailable. Do not estimate a missing measurement.');
      return;
    }
    setMeasurements((items) => [...items, { id: measureId, value, unit: definition.unit, at: new Date().toISOString(), source: measureSource.trim() || 'Manual entry · source unspecified', context: measureContext, quality: 'Manually entered · unverified' }]);
    setMeasureValue('');
    setMeasureSource('');
    setMeasureNotice('Saved on this device. Verify the source and reading against the device record; request review or repeat it if questionable.');
  };

  const saveReflection = () => {
    setReflections((items) => [...items.filter((item) => item.day !== dayKey()), { ...reflection, day: dayKey() }]);
  };
  const editMedicalProfile = (field: keyof Pick<DemoMedicalProfile, 'allergies' | 'medications' | 'restrictions' | 'history' | 'baselineNotes' | 'author' | 'version'>, value: string) => {
    setMedicalProfile((record) => ({
      ...record,
      [field]: field === 'allergies' || field === 'medications' || field === 'restrictions' || field === 'history'
        ? value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
        : value,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    }));
  };
  const markDemoReviewed = () => setMedicalProfile((record) => ({ ...record, status: 'demo-reviewed', reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));

  const recentMeasurement = (id: string) => [...measurements].reverse().find((item) => item.id === id);
  const contextualHeartRates = measurements.filter((item) => item.id === 'hr').reduce<Record<string, number[]>>((groups, item) => {
    groups[item.context] = [...(groups[item.context] ?? []), item.value];
    return groups;
  }, {});
  const projection = (id: string, title: string) => {
    const samples = records.slice(-7).map((record) => record.values[id]).filter((value): value is number => value !== undefined);
    if (samples.length < 3) return { title, value: 'Insufficient recent measurements', confidence: 'Unavailable', basis: 'At least three recent recorded values are needed.' };
    const slope = (samples[samples.length - 1] - samples[0]) / (samples.length - 1);
    return {
      title,
      value: `${slope > 0 ? 'Increasing' : slope < 0 ? 'Decreasing' : 'Stable'} in the short term`,
      confidence: 'Low · simulated series',
      basis: `${samples.length} recent values; a simple trend only. Workload, context and measurement quality can change this pattern.`,
    };
  };

  return (
    <section className="mt-4 border border-[#67c9d5]/25 bg-[#081018]/95 p-4 md:p-6" aria-labelledby="health-support-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-[#67c9d5]">WATCH · PERSONAL HEALTH SUPPORT</div>
          <h2 id="health-support-title" className="mt-1 text-xl font-semibold text-marble">{astronautName} · Health tools</h2>
        </div>
        <div className={`flex items-center gap-2 border px-3 py-2 text-xs ${online ? 'border-[#7bd5b8]/30 text-[#7bd5b8]' : 'border-[#e39b4b]/50 text-[#f3c28d]'}`}>
          {online ? <RefreshCw size={14} /> : <WifiOff size={14} />}
          {online ? 'Saved on this device · online' : 'OFFLINE · saved on this device'}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-marble/55">Some numbers are practice data, not real readings. Saved entries stay on this device. This tool cannot diagnose or clear anyone for a task.</p>
      {(measureStorageError || reflectionStorageError || medicalStorageError || symptomStorageError) && <p role="alert" className="mt-3 border border-[#e39b4b]/50 p-3 text-sm text-[#f3c28d]">Local storage is unavailable or full. New information may not persist. Use the mission paper-procedure fallback.</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.4fr)]">
        <div className="border border-marble/10 bg-void/40 p-4">
          <div className="font-mono text-[9px] tracking-[0.2em] text-marble/50">HEALTH OVERVIEW</div>
          <div className="mt-3">
            <div className="text-sm font-semibold text-marble">Selected area: {bodyArea}</div>
            <p className="mt-1 text-xs text-marble/55">Choose a label or click anywhere on the body.</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SYSTEMS.map(({ id, label, icon: SystemIcon }) => (
              <button key={id} type="button" onClick={() => { setSystem(id); setBodyArea(label); }} aria-pressed={bodyArea === label}
                className={`flex min-h-10 items-center gap-2 border px-2 text-left text-xs ${bodyArea === label ? 'border-[#67c9d5]/70 bg-[#67c9d5]/10 text-[#9be7ef]' : 'border-marble/15 bg-void/80 text-marble/70 hover:border-marble/35'}`}>
                <SystemIcon size={15} />{label}
              </button>
            ))}
            <button type="button" onClick={() => setBodyArea('Other area')} aria-pressed={bodyArea === 'Other area'}
              className={`min-h-10 border px-2 text-left text-xs ${bodyArea === 'Other area' ? 'border-[#67c9d5]/70 bg-[#67c9d5]/10 text-[#9be7ef]' : 'border-marble/15 bg-void/80 text-marble/70 hover:border-marble/35'}`}>
              Other area
            </button>
          </div>
          {bodyArea === 'Other area' && (
            <label className="mt-3 block text-xs text-marble/70" htmlFor={`custom-area-${astronautId}`}>
              Name the area
              <input id={`custom-area-${astronautId}`} value={customArea} onChange={(event) => setCustomArea(event.target.value)} placeholder="For example, shoulder" className="mt-1 min-h-10 w-full border border-marble/20 bg-transparent px-3 text-sm text-marble" />
            </label>
          )}
          <div className="mx-auto mt-4 w-full max-w-[250px]">
            <button type="button" aria-label="Click a place on the body to choose where a symptom is felt"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width;
                const y = (event.clientY - bounds.top) / bounds.height;
                const area = y < 0.18 ? 'Head'
                  : y < 0.29 ? 'Neck and shoulders'
                    : y < 0.44 && (x < 0.36 || x > 0.64) ? 'Arm'
                      : y < 0.43 ? 'Chest'
                        : y < 0.54 ? 'Abdomen'
                          : y < 0.62 ? 'Hip and pelvis'
                            : y < 0.82 ? 'Leg'
                              : 'Lower leg and foot';
                setBodyArea(area);
                if (area === 'Chest') setSystem('cardiovascular');
                else if (area === 'Head') setSystem('sleep');
                else if (area === 'Arm' || area === 'Leg' || area === 'Lower leg and foot') setSystem('musculoskeletal');
              }}
              className="block w-full cursor-crosshair focus-visible:outline-offset-2">
              <img src={bodyImageUrl} alt="Clickable front view of a human body. Select a place to report a symptom." className="block h-auto w-full select-none" draggable={false} />
            </button>
          </div>
          <div className="mt-3 border-t border-marble/10 pt-3">
            <label className="block text-xs text-marble/70" htmlFor={`symptom-report-${astronautId}`}>Symptom in {bodyArea === 'Other area' ? customArea || 'other area' : bodyArea} (optional)</label>
            <textarea id={`symptom-report-${astronautId}`} value={symptomNote} onChange={(event) => setSymptomNote(event.target.value)} rows={2} placeholder="What are you feeling?" className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-sm text-marble" />
            <button type="button" onClick={() => {
              const area = bodyArea === 'Other area' ? customArea.trim() : bodyArea;
              if (!area || !symptomNote.trim()) {
                setSymptomNotice('Choose or name a place and add a short note.');
                return;
              }
              setSymptomReports((items) => [...items, { area, note: symptomNote.trim(), at: new Date().toISOString() }]);
              setSymptomNote('');
              setSymptomNotice('Saved on this device. Tell the medical crew if you need help.');
            }} className="mt-2 min-h-10 bg-[#67c9d5] px-4 text-xs font-semibold text-[#061015]">SAVE SYMPTOM</button>
            {symptomNotice && <p role="status" className="mt-2 text-xs text-[#9be7ef]">{symptomNotice}</p>}
            {symptomReports.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-marble/10 pt-2">
                {[...symptomReports].reverse().slice(0, 3).map((report, index) => <li key={`${report.at}-${index}`} className="text-xs text-marble/65">
                  <strong className="text-marble">{report.area}:</strong> {report.note} <span className="text-marble/40">{new Date(report.at).toLocaleString()}</span>
                </li>)}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="border border-marble/10 p-4">
            <div className="flex items-center gap-2 text-sm text-marble"><Icon size={17} className="text-[#67c9d5]" />{selectedSystem.label}</div>
            <p className="mt-2 text-xs text-marble/65">{selectedSystem.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSystem.measures.map((item) => {
                const definition = MEASURES.find((measure) => measure.id === item);
                const saved = recentMeasurement(item);
                const simulated = records[records.length - 1]?.values[item === 'dose_rate' ? 'dose' : item];
                return <div key={item} className="border border-marble/10 px-3 py-2 text-xs text-marble/70">
                  <span>{definition?.name ?? item}</span>
                  <span className="ml-2 font-mono text-marble">{saved ? `${saved.value} ${saved.unit}` : simulated !== undefined ? `${simulated}${definition ? ` ${definition.unit}` : ''}` : item === 'dose_total' ? `${(mission.radiationPerDay * mission.today).toFixed(1)} mSv` : 'UNAVAILABLE'}</span>
                  <span className="ml-2 text-[9px] text-marble/40">{saved ? `${saved.context.toUpperCase()} · MANUAL · UNVERIFIED` : simulated !== undefined || item === 'dose_total' ? 'SIMULATED MISSION ESTIMATE' : 'MISSING'}</span>
                </div>;
              })}
            </div>
          </section>

          <section className="border border-marble/10 p-4">
            <h3 className="text-sm font-medium text-marble">Record a measurement</h3>
            <p className="mt-1 text-xs text-marble/55">Add a reading from a device or your own report. Missing readings are not treated as normal.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1fr_1fr_auto]">
              <label className="sr-only" htmlFor={`measure-${astronautId}`}>Measurement</label>
              <select id={`measure-${astronautId}`} value={measureId} onChange={(event) => setMeasureId(event.target.value)} className="min-h-11 border border-marble/20 bg-[#081018] px-3 text-sm text-marble">
                {MEASURES.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}
              </select>
              <label className="sr-only" htmlFor={`measure-context-${astronautId}`}>Measurement context</label>
              <select id={`measure-context-${astronautId}`} value={measureContext} onChange={(event) => setMeasureContext(event.target.value)} className="min-h-11 border border-marble/20 bg-[#081018] px-3 text-sm text-marble">
                {['rest', 'exercise', 'recovery', 'sleep', 'other'].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)} context</option>)}
              </select>
              <label className="sr-only" htmlFor={`measure-source-${astronautId}`}>Source or device</label>
              <input id={`measure-source-${astronautId}`} value={measureSource} onChange={(event) => setMeasureSource(event.target.value)} placeholder="Source/device (optional)" className="min-h-11 border border-marble/20 bg-transparent px-3 text-sm text-marble" />
              <label className="sr-only" htmlFor={`measure-value-${astronautId}`}>Measurement value</label>
              <input id={`measure-value-${astronautId}`} type="number" step="any" value={measureValue} onChange={(event) => setMeasureValue(event.target.value)} placeholder={`Value · ${MEASURES.find((item) => item.id === measureId)?.unit}`} className="min-h-11 border border-marble/20 bg-transparent px-3 font-mono text-sm text-marble" />
              <button type="button" onClick={saveMeasurement} className="min-h-11 bg-[#67c9d5] px-4 font-mono text-[10px] font-semibold tracking-wider text-[#061015]">SAVE</button>
            </div>
            <p className="mt-2 text-[11px] text-marble/45">{MEASURES.find((item) => item.id === measureId)?.hint}</p>
            {measureNotice && <p role="status" className="mt-2 text-xs text-[#9be7ef]">{measureNotice}</p>}
            <div className="mt-3 max-h-32 overflow-y-auto divide-y divide-marble/10">
              {[...measurements].reverse().slice(0, 5).map((item, index) => <div key={`${item.id}-${item.at}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                <span className="text-marble">{MEASURES.find((definition) => definition.id === item.id)?.name}: {item.value} {item.unit} · {item.context}</span>
                <span className="text-marble/45">{new Date(item.at).toLocaleString()} · {item.source} · {Date.now() - new Date(item.at).getTime() > 7 * 86400000 ? 'OUTDATED · ' : ''}{item.quality}</span>
              </div>)}
              {measurements.length === 0 && <p className="py-2 text-xs text-marble/45">No manually entered measurements saved for this profile yet.</p>}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <details className="border border-marble/10 p-4">
        <summary className="cursor-pointer text-sm font-medium text-marble">More: changes, task notes, and practice scenarios</summary>
        <div className="mt-4">
        <section className="border border-marble/10 p-4">
          <h3 className="text-sm font-medium text-marble">Recent changes</h3>
          <p className="mt-1 text-xs text-marble/50">These are notes, not a diagnosis.</p>
          <ul className="mt-3 space-y-2 text-xs text-marble/70">
            <li>Sleep change: {trend.sleep === undefined ? 'not enough readings yet' : `${trend.sleep > 0 ? '+' : ''}${trend.sleep.toFixed(1)} hours`}.</li>
            <li>Heart-rate change: {trend.heart === undefined ? 'not enough readings yet' : `${trend.heart > 0 ? '+' : ''}${trend.heart.toFixed(0)} beats per minute`}.</li>
            <li>Activity and sleep: {trend.activitySleepContext}</li>
            <li>Readings found: {trend.coverage}. Missing readings are not counted as okay.</li>
            {nextTask && <li>Next task: {nextTask.title}, in {nextTask.day - mission.today} mission days. Ask the medical or mission lead about concerns.</li>}
            {selfReportNeedsReview && nextTask && <li className="border-l-2 border-[#e5c27b] pl-2 text-[#e5c27b]">Your recent check-in may be worth discussing with the medical or mission lead before the next task.</li>}
          </ul>
          <div className="mt-3 border border-marble/10 p-3 text-xs text-marble/65">
            <div className="font-mono text-[9px] tracking-wider text-marble/45">HEART READINGS BY ACTIVITY · NOT CHECKED BY A DOCTOR</div>
            {Object.entries(contextualHeartRates).length
              ? Object.entries(contextualHeartRates).map(([context, values]) => <span key={context} className="mr-3 inline-block mt-1">{context}: {values[values.length - 1]} bpm latest ({values.length} entr{values.length === 1 ? 'y' : 'ies'})</span>)
              : <span className="mt-1 inline-block">No readings saved yet.</span>}
          </div>
          <div className="mt-3 border border-[#e5c27b]/30 bg-[#e5c27b]/[0.03] p-3">
            <div className="font-mono text-[9px] tracking-wider text-[#e5c27b]">TASK CHECK · ASK A HUMAN</div>
            <p className="mt-1 text-xs text-marble">CHIRON cannot decide if someone is ready. Ask the medical or mission lead.</p>
            {nextTask && <p className="mt-1 text-xs text-marble/55">Next task: {nextTask.title}, mission day {nextTask.day}.</p>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[projection('sleep_h', 'Sleep'), projection('hr', 'Heart rate')].map((item) => <div key={item.title} className="border border-marble/10 p-3">
              <div className="font-mono text-[9px] tracking-wider text-marble/50">{item.title.toUpperCase()} · POSSIBLE CHANGE</div>
              <div className="mt-1 text-xs text-marble">{item.value}</div>
              <div className="mt-1 text-[10px] text-[#e5c27b]">How sure: {item.confidence}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-marble/45">{item.basis}</p>
            </div>)}
          </div>
          <div className="mt-3 border-l-2 border-[#e5c27b] pl-3">
            <div className="font-mono text-[9px] tracking-wider text-[#e5c27b]">PRACTICE WHAT-IF</div>
            <select value={scenario} onChange={(event) => setScenario(Number(event.target.value))} className="mt-2 min-h-10 w-full border border-marble/20 bg-[#081018] px-3 text-xs text-marble">
              {SCENARIOS.map((item, index) => <option key={item.title} value={index}>{item.title}</option>)}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-marble/65">{SCENARIOS[scenario].text}</p>
            <p className="mt-2 text-[9px] font-mono tracking-wider text-[#e5c27b]">PRACTICE ONLY · NOT A PREDICTION</p>
          </div>
        </section>

        </div>
      </details>
        <section className="border border-marble/10 p-4">
          <h3 className="text-sm font-medium text-marble">End-of-day reflection</h3>
          <p className="mt-1 text-xs text-marble/50">Brief self-report · compare with your own previous entries</p>
          {([
            ['energy', 'How was your energy today?'],
            ['fatigue', 'How tired do you feel?'],
            ['sleep', 'How well did you sleep?'],
            ['wellbeing', 'How was your overall wellbeing?'],
          ] as const).map(([field, label]) => <fieldset key={field} className="mt-3">
            <legend className="text-xs text-marble/75">{label}</legend>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={reflection[field] === value}
                onClick={() => setReflection((item) => ({ ...item, [field]: value }))}
                className={`min-h-9 border text-xs ${reflection[field] === value ? 'border-[#67c9d5] bg-[#67c9d5]/10 text-[#9be7ef]' : 'border-marble/15 text-marble/65'}`}>{value}</button>)}
            </div>
          </fieldset>)}
          <label className="mt-3 block text-xs text-marble/75" htmlFor={`symptoms-${astronautId}`}>Unusual symptoms (optional)</label>
          <input id={`symptoms-${astronautId}`} value={reflection.symptoms} onChange={(event) => setReflection((item) => ({ ...item, symptoms: event.target.value }))} placeholder="Brief note or none" className="mt-1 min-h-10 w-full border border-marble/20 bg-transparent px-3 text-xs text-marble" />
          <label className="mt-3 block text-xs text-marble/75" htmlFor={`comments-${astronautId}`}>Optional comments</label>
          <textarea id={`comments-${astronautId}`} value={reflection.comments} onChange={(event) => setReflection((item) => ({ ...item, comments: event.target.value }))} rows={2} className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-xs text-marble" />
          {previousReflection && <p className="mt-2 text-[11px] text-marble/55">Previous ({previousReflection.day}): energy {previousReflection.energy}/5 · fatigue {previousReflection.fatigue}/5 · sleep {previousReflection.sleep}/5 · wellbeing {previousReflection.wellbeing}/5.</p>}
          {!previousReflection && <p className="mt-2 text-[11px] text-marble/45">No previous reflection to compare yet.</p>}
          <button type="button" onClick={saveReflection} className="mt-3 min-h-10 bg-[#67c9d5] px-4 font-mono text-[10px] font-semibold tracking-wider text-[#061015]">{todayReflection ? 'UPDATE TODAY’S REFLECTION' : 'SAVE TODAY’S REFLECTION'}</button>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3 border border-[#e39b4b]/35 bg-[#e39b4b]/[0.04] p-3 text-xs text-marble/65">
        <WifiOff size={15} className="mt-0.5 shrink-0 text-[#e5c27b]" />
        <p><strong className="text-[#e5c27b]">If the app or a device fails:</strong> use approved paper instructions and the mission medical kit. This prototype does not replace medical staff.</p>
      </div>
      <details className="mt-4 border border-marble/10 p-3">
        <summary className="cursor-pointer text-xs font-mono tracking-wider text-marble/65">SCIENTIFIC FOUNDATION & SOURCE LIMITATIONS</summary>
        <p className="mt-2 text-xs text-marble/55">Research informs educational context; it is not patient-specific guidance. Use validated clinical references and mission-approved protocols for medical decisions.</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {REFERENCES.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-[#9be7ef] underline underline-offset-2">{label}</a></li>)}
        </ul>
      </details>
      <details className="mt-4 border border-marble/10 p-3">
        <summary className="cursor-pointer text-xs font-mono tracking-wider text-marble/65">EARTH MEDICAL TEAM · SIMULATED PROFILE RECORD</summary>
        <p className="mt-2 border border-[#e39b4b]/35 bg-[#e39b4b]/[0.04] p-3 text-xs text-[#f3c28d]">Do not enter real private medical data. This prototype stores plain text in browser storage, has no identity verification, and its “demo reviewed” state is not clinician approval.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            ['allergies', 'Allergies'],
            ['medications', 'Medications'],
            ['restrictions', 'Mission restrictions'],
            ['history', 'Relevant history'],
          ] as const).map(([field, label]) => <label key={field} className="text-xs text-marble/70">
            {label} · one item per line
            <textarea rows={2} value={medicalProfile[field].join('\n')} onChange={(event) => editMedicalProfile(field, event.target.value)} className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-xs text-marble" />
          </label>)}
          <label className="text-xs text-marble/70">Baseline / medical notes
            <textarea rows={2} value={medicalProfile.baselineNotes} onChange={(event) => editMedicalProfile('baselineNotes', event.target.value)} className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-xs text-marble" />
          </label>
          <div className="grid gap-2">
            <label className="text-xs text-marble/70">Demo author
              <input value={medicalProfile.author} onChange={(event) => editMedicalProfile('author', event.target.value)} className="mt-1 min-h-10 w-full border border-marble/20 bg-transparent px-2 text-xs text-marble" />
            </label>
            <label className="text-xs text-marble/70">Version
              <input value={medicalProfile.version} onChange={(event) => editMedicalProfile('version', event.target.value)} className="mt-1 min-h-10 w-full border border-marble/20 bg-transparent px-2 text-xs text-marble" />
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-marble/55">Status: <strong className="text-[#e5c27b]">{medicalProfile.status === 'demo-reviewed' ? 'DEMO REVIEWED · NOT CLINICALLY APPROVED' : medicalProfile.status.toUpperCase()}</strong>{medicalProfile.updatedAt && ` · ${new Date(medicalProfile.updatedAt).toLocaleString()}`}</span>
          <button type="button" disabled={medicalProfile.status === 'demo-reviewed'} onClick={markDemoReviewed} className="min-h-10 border border-[#e5c27b]/50 px-3 text-xs text-[#e5c27b] disabled:opacity-40">SIMULATE REVIEW COMPLETE</button>
        </div>
        <p className="mt-2 text-[10px] text-marble/45">Changes save locally as a draft. The review control only demonstrates status/version tracking and does not authorize treatment, set approved limits or transmit a record.</p>
      </details>
    </section>
  );
}
