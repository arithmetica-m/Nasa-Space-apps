import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { DayRecord } from '../types';
import { crew } from '../emergency/data';
import type { DemoMedicalProfile } from '../emergency/types';
import { indicatorById } from '../data/indicators';
import { explain, symptomMeaning, type Explanation } from '../data/meanings';
import { latestValue } from '../lib/health';
import { Explained } from './Explained';
import { BODY_REPORT_EVENT } from './ReportSomething';
import type { BodyPart } from '../triage/symptomCheck';

const bodyImageUrl = new URL('../../body.png', import.meta.url).href;

// THE BODY: labelled parts, the most common problems in space ready to tap.
// Parts with a problem glow. Tap a label or a spot to see what it is, or to report something.
type RegionId = 'brain' | 'eyes' | 'ears' | 'throat' | 'heart' | 'lungs' | 'stomach' | 'kidneys' | 'back' | 'bones' | 'arms' | 'skin' | 'legs' | 'whole';

interface Region { label: string; short: string; x: number; y: number; side: 'left' | 'right'; labelY: number; common: string[] }
// x, y: where the part is on the picture (0–1). labelY: where its label sits beside the picture.
const REGIONS: Record<RegionId, Region> = {
  brain: { label: 'Head and brain', short: 'Head', x: 0.5, y: 0.06, side: 'left', labelY: 0.03, common: ['Headache', 'Poor sleep', 'Low mood', 'Trouble focusing'] },
  ears: { label: 'Ears and balance', short: 'Ears · balance', x: 0.435, y: 0.115, side: 'left', labelY: 0.13, common: ['Dizziness', 'Ringing in the ears', 'Ear pain'] },
  heart: { label: 'Heart', short: 'Heart', x: 0.46, y: 0.25, side: 'left', labelY: 0.23, common: ['Racing heart', 'Chest pain', 'Light-headed when moving'] },
  kidneys: { label: 'Kidneys and bladder', short: 'Kidneys', x: 0.45, y: 0.385, side: 'left', labelY: 0.34, common: ['Pain in the side', 'Pain when passing urine', 'Dark urine'] },
  bones: { label: 'Bones and hips', short: 'Bones · hips', x: 0.42, y: 0.455, side: 'left', labelY: 0.45, common: ['Hip pain', 'Bone pain'] },
  skin: { label: 'Skin', short: 'Skin', x: 0.29, y: 0.47, side: 'left', labelY: 0.56, common: ['Rash', 'Itchy skin', 'Cut or graze'] },
  legs: { label: 'Leg muscles', short: 'Legs', x: 0.44, y: 0.65, side: 'left', labelY: 0.67, common: ['Weak legs', 'Muscle pain', 'Cramp'] },
  eyes: { label: 'Eyes', short: 'Eyes', x: 0.55, y: 0.112, side: 'right', labelY: 0.06, common: ['Eye strain', 'Blurry vision', 'Something in the eye'] },
  throat: { label: 'Nose and throat', short: 'Nose · throat', x: 0.5, y: 0.163, side: 'right', labelY: 0.16, common: ['Congestion', 'Nosebleed', 'Sore throat'] },
  lungs: { label: 'Lungs and breathing', short: 'Lungs', x: 0.56, y: 0.24, side: 'right', labelY: 0.26, common: ['Short of breath', 'Cough'] },
  stomach: { label: 'Stomach', short: 'Stomach', x: 0.55, y: 0.345, side: 'right', labelY: 0.36, common: ['Nausea', 'Stomach pain', 'Constipation'] },
  back: { label: 'Back and spine', short: 'Back', x: 0.5, y: 0.43, side: 'right', labelY: 0.46, common: ['Back pain', 'Stiff neck'] },
  arms: { label: 'Arms and hands', short: 'Arms · hands', x: 0.71, y: 0.45, side: 'right', labelY: 0.56, common: ['Sore shoulder', 'Numb fingers', 'Hand pain'] },
  whole: { label: 'Whole body', short: 'Whole body', x: 0, y: 0, side: 'right', labelY: 0, common: ['Fever', 'Tired all the time', 'Chills'] },
};
const PARTS = (Object.keys(REGIONS) as RegionId[]).filter((r) => r !== 'whole');

const READING_REGION: Record<string, RegionId> = {
  mood: 'brain', reaction: 'brain', spatial: 'brain', sleep_h: 'brain', wakeups: 'brain',
  vision: 'eyes',
  balance: 'ears', coordination: 'ears', dizziness: 'ears',
  hr: 'heart', hrv: 'heart', bp_sys: 'heart',
  spo2: 'lungs', resp: 'lungs',
  nausea: 'stomach', glucose: 'stomach',
  calcium: 'bones',
  endurance: 'legs', emg: 'legs', activity: 'legs',
  temp: 'whole', crp: 'whole', dose: 'whole',
};

const SYMPTOM_REGION: Record<string, RegionId> = {
  Headache: 'brain', Dizziness: 'ears', Congestion: 'throat', 'Eye strain': 'eyes', Nausea: 'stomach', 'Back pain': 'back',
};

interface Problem { key: string; region: RegionId; title: string; detail: string; e: Explanation }
type Report = { region: RegionId; note: string; at: string };

function useLocal<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } }, [key, value]);
  return [value, setValue] as const;
}

// A report is explained from the library when it is a known symptom.
function reportExplanation(note: string): Explanation {
  const m = symptomMeaning[note];
  if (m) return { name: note, direction: 'high', what: '', means: m.what, todo: m.todo, topic: { symptom: note } };
  return { name: note, direction: 'high', what: '', todo: 'Tell the medical officer. If it gets worse fast, press EMERGENCY.', topic: { symptom: note } };
}

interface Props {
  astronautId: string;
  astronautName: string;
  records: DayRecord[];
  symptoms: string[];          // from today's check-in
  isSelf: boolean;
  onAddReadings: () => void;
  onReading: (values: Record<string, number>) => void;
  onReport: (part?: BodyPart) => void;
}

export function HealthSupport({ astronautId, astronautName, records, symptoms, isSelf, onAddReadings, onReading, onReport }: Props) {
  const [selected, setSelected] = useState<RegionId>();
  const [open, setOpen] = useState<string>();
  const [reports, setReports] = useLocal<Report[]>(`chiron-body-reports-v1-${astronautId}`, []);
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  // A report made in REPORT SOMETHING appears on the body straight away.
  useEffect(() => {
    const reload = () => { try { setReports(JSON.parse(localStorage.getItem(`chiron-body-reports-v1-${astronautId}`) ?? '[]')); } catch { /* ignore */ } };
    window.addEventListener(BODY_REPORT_EVENT, reload);
    return () => window.removeEventListener(BODY_REPORT_EVENT, reload);
  }, [astronautId, setReports]);

  // Everything outside this person's normal, placed on the body.
  const problems = useMemo<Problem[]>(() => {
    const out: Problem[] = [];
    for (const [id, region] of Object.entries(READING_REGION)) {
      const l = latestValue(records, id);
      if (!l) continue;
      const e = explain(id, l.value, { when: `mission day ${l.day}`, source: `${indicatorById(id).method} · SIMULATED` });
      if (e.direction === 'usual') continue;
      const ind = indicatorById(id);
      out.push({ key: id, region, title: e.name, detail: `${e.direction === 'high' ? 'Higher' : 'Lower'} than usual · ${id === 'mood' ? ['Very low', 'Very low', 'Low', 'Okay', 'Good', 'Very good'][Math.round(l.value)] : `${l.value} ${ind.unit}`}`, e });
    }
    for (const s of symptoms) {
      const m = symptomMeaning[s];
      if (m) out.push({ key: `sym-${s}`, region: SYMPTOM_REGION[s] ?? 'whole', title: s, detail: 'From today’s check-in', e: { name: s, direction: 'high', what: '', means: m.what, todo: m.todo, topic: { symptom: s } } });
    }
    reports.slice(-8).forEach((r, i) => {
      const region = (r.region in REGIONS ? r.region : 'whole') as RegionId;
      out.push({ key: `rep-${i}`, region, title: r.note, detail: `You reported this · ${new Date(r.at).toLocaleDateString()}`, e: reportExplanation(r.note) });
    });
    return out;
  }, [records, symptoms, reports]);

  const count = (r: RegionId) => problems.filter((p) => p.region === r).length;
  const flagged = (Object.keys(REGIONS) as RegionId[]).filter((r) => count(r) > 0);
  const here = selected ? problems.filter((p) => p.region === selected) : [];
  const readingsHere = selected ? Object.entries(READING_REGION).filter(([, r]) => r === selected).map(([id]) => id).filter((id) => id !== 'dose') : [];

  const select = (r: RegionId) => {
    setSelected(r);
    setEntry({});
    setSaved('');
    setOpen(problems.find((p) => p.region === r)?.key);
  };
  const report = (text: string) => {
    if (!selected || !text.trim()) return;
    setReports((x) => [...x, { region: selected, note: text.trim(), at: new Date().toISOString() }]);
    setOpen(`rep-${Math.min(reports.length, 7)}`);
  };

  // Picture position inside the map: the body takes the middle 46%, labels the sides.
  const px = (x: number) => 27 + x * 46;

  return (
    <section className="mx-auto mt-4 w-full max-w-[1200px] px-4 md:px-8" aria-labelledby="body-title">
      <div className="border border-marble/10 bg-void/75 p-4 backdrop-blur-md md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="body-title" className="font-serif text-xl tracking-[0.15em] text-marble">{astronautName.split(' ')[0].toUpperCase()}’S BODY</h2>
          {isSelf && (
            <button type="button" onClick={onAddReadings} className="flex min-h-12 items-center gap-2 bg-gold px-5 font-mono text-sm tracking-[0.2em] text-void hover:bg-marble">
              <Plus size={18} /> ADD READINGS
            </button>
          )}
        </div>
        <p className="mt-1 text-lg text-marble/80">
          {flagged.length ? `${flagged.length} ${flagged.length === 1 ? 'part needs' : 'parts need'} a look. Tap a glowing part.` : 'Nothing flagged. Tap a part to report how it feels.'}
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(360px,560px)_1fr]">
          {/* The labelled body */}
          <div>
            <div className="relative mx-auto w-full max-w-[560px]" style={{ aspectRatio: '1 / 0.69' }}>
              <img src={bodyImageUrl} alt="" draggable={false} className="absolute top-0 h-full select-none mix-blend-lighten" style={{ left: '27%', width: '46%', maskImage: 'linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)' }} />
              <svg className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {PARTS.map((r) => {
                  const g = REGIONS[r];
                  const has = count(r) > 0;
                  return <line key={r} x1={g.side === 'left' ? 25 : 75} y1={g.labelY * 100 + 3} x2={px(g.x)} y2={g.y * 100}
                    stroke={has ? '#e39b4b' : selected === r ? '#c8a96a' : 'rgba(233,228,218,0.22)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
                })}
              </svg>
              {PARTS.map((r) => {
                const g = REGIONS[r];
                const has = count(r) > 0;
                return (
                  <button key={`spot-${r}`} type="button" tabIndex={-1} aria-hidden="true" onClick={() => select(r)}
                    className={`body-spot ${has ? 'body-spot-alert' : 'body-spot-quiet'} ${selected === r ? 'body-spot-on' : ''}`}
                    style={{ left: `${px(g.x)}%`, top: `${g.y * 100}%` }} />
                );
              })}
              {PARTS.map((r) => {
                const g = REGIONS[r];
                const n = count(r);
                return (
                  <button key={r} type="button" onClick={() => select(r)} aria-pressed={selected === r}
                    aria-label={`${g.label}: ${n ? `${n} to check` : 'nothing flagged'}`}
                    className={`absolute hidden min-h-[32px] w-[25%] items-center gap-1.5 border px-2 text-left text-sm sm:flex ${g.side === 'left' ? 'left-0 justify-end text-right' : 'right-0'} ${n ? 'border-[#e39b4b]/70 bg-[#e39b4b]/15 text-[#f3c28d]' : 'border-marble/15 bg-void/70 text-marble/80 hover:border-gold/60'} ${selected === r ? 'outline outline-2 outline-gold' : ''}`}
                    style={{ top: `${g.labelY * 100}%` }}>
                    {n > 0 && g.side === 'right' && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#e39b4b]" />}
                    <span className="whitespace-nowrap">{g.short}{n > 0 && ` (${n})`}</span>
                    {n > 0 && g.side === 'left' && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#e39b4b]" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
              {PARTS.map((r) => (
                <button key={r} type="button" onClick={() => select(r)} aria-pressed={selected === r}
                  className={`min-h-12 border px-3 text-left text-base ${count(r) ? 'border-[#e39b4b]/70 bg-[#e39b4b]/15 text-[#f3c28d]' : 'border-marble/15 text-marble/80'}`}>
                  {REGIONS[r].label}{count(r) > 0 && ` (${count(r)})`}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => select('whole')} aria-pressed={selected === 'whole'}
              className={`mx-auto mt-3 flex min-h-12 w-full max-w-[300px] items-center justify-center gap-2 border text-base ${count('whole') ? 'border-[#e39b4b]/70 text-[#f3c28d]' : 'border-marble/15 text-marble/70'} ${selected === 'whole' ? 'bg-marble/10' : ''}`}>
              {count('whole') > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-[#e39b4b]" />} Whole body{count('whole') > 0 && ` (${count('whole')})`}
            </button>
          </div>

          {/* What is going on in the chosen part */}
          <div aria-live="polite">
            {!selected ? (
              <>
              {isSelf && (
                <button type="button" onClick={() => onReport()} className="mb-3 flex min-h-16 w-full items-center justify-between gap-3 border border-gold/60 bg-gold/10 px-4 text-left hover:bg-gold/20">
                  <span><span className="block text-lg text-marble">Report something</span><span className="block text-base text-marble/60">Not sure which part, or more than one? Describe it.</span></span>
                  <span className="font-mono text-xs tracking-[0.2em] text-gold">START</span>
                </button>
              )}
              <ul className="space-y-2">
                {flagged.map((r) => (
                  <li key={r}>
                    <button type="button" onClick={() => select(r)} className="flex min-h-16 w-full items-center justify-between gap-3 border border-[#e39b4b]/40 bg-[#e39b4b]/[0.06] px-4 py-2 text-left hover:border-[#e39b4b]/80">
                      <span>
                        <span className="block text-lg text-marble">{REGIONS[r].label}</span>
                        <span className="block text-base text-marble/65">{problems.filter((p) => p.region === r).map((p) => p.title).join(' · ')}</span>
                      </span>
                      <ChevronDown size={20} className="-rotate-90 text-[#f3c28d]" />
                    </button>
                  </li>
                ))}
              </ul>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-2xl tracking-[0.12em] text-marble">{REGIONS[selected].label.toUpperCase()}</h3>
                  <button type="button" onClick={() => setSelected(undefined)} className="min-h-12 border border-marble/20 px-4 text-base text-marble/75 hover:text-marble">Back</button>
                </div>

                {here.length === 0 && <p className="mt-3 text-lg text-[#7bd5b8]">Nothing flagged here.</p>}
                <ul className="mt-3 space-y-2">
                  {here.map((p) => (
                    <li key={p.key} className="border border-marble/10">
                      <button type="button" onClick={() => setOpen(open === p.key ? undefined : p.key)} aria-expanded={open === p.key}
                        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left">
                        <span>
                          <span className="block text-lg text-marble">{p.title}</span>
                          <span className="block text-base text-[#f3c28d]">{p.detail}</span>
                        </span>
                        <ChevronDown size={22} className={`shrink-0 text-gold transition ${open === p.key ? 'rotate-180' : ''}`} />
                      </button>
                      {open === p.key && <div className="border-t border-marble/10 p-3"><Explained e={p.e} crewId={astronautId} /></div>}
                    </li>
                  ))}
                </ul>

                {isSelf && (
                  <div className="mt-5">
                    <p className="text-base text-marble/75">Something wrong here? Tap it:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {REGIONS[selected].common.map((c) => (
                        <button key={c} type="button" onClick={() => report(c)} className="min-h-12 border border-gold/40 px-4 text-base text-marble hover:border-gold hover:bg-gold/10">{c}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => onReport(selected as BodyPart)}
                      className="mt-3 flex min-h-12 w-full items-center justify-center border border-gold/60 px-4 font-mono text-sm tracking-[0.18em] text-gold hover:bg-gold/10">DESCRIBE IT AND GET ADVICE</button>

                    {readingsHere.length > 0 && (
                      <div className="mt-5 border-t border-marble/10 pt-4">
                        <p className="text-base text-marble/75">Add a reading for this part:</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {readingsHere.map((id) => {
                            const ind = indicatorById(id);
                            const last = latestValue(records, id);
                            return (
                              <label key={id} className="block border border-marble/10 p-3">
                                <span className="block text-base text-marble">{ind.name}</span>
                                <span className="block text-sm text-marble/50">Normal {ind.baseline[0]}–{ind.baseline[1]} {ind.unit}{last ? ` · last ${last.value}` : ''}</span>
                                <span className="mt-1 flex items-center gap-2">
                                  <input type="number" inputMode="decimal" step="any" value={entry[id] ?? ''} onChange={(e) => setEntry((x) => ({ ...x, [id]: e.target.value }))}
                                    className="min-h-12 w-full min-w-0 border border-marble/25 bg-transparent px-3 text-lg text-marble" />
                                  <span className="shrink-0 text-sm text-marble/60">{ind.unit}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <button type="button" disabled={!Object.values(entry).some((v) => v.trim() !== '' && Number.isFinite(Number(v)))}
                          onClick={() => {
                            const values = Object.fromEntries(Object.entries(entry).filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
                            onReading(values);
                            setEntry({});
                            setSaved(Object.keys(values).map((k) => indicatorById(k).name).join(', '));
                          }}
                          className="mt-2 min-h-12 w-full bg-gold font-mono text-sm tracking-[0.2em] text-void disabled:opacity-40">SAVE READING</button>
                        {saved && <p className="mt-2 text-base text-[#7bd5b8]">Saved: {saved}. The body map and your health line now use it.</p>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <MedicalRecord astronautId={astronautId} />
    </section>
  );
}

// The medical record the emergency screen reads. Folded away: it is rarely edited.
function MedicalRecord({ astronautId }: { astronautId: string }) {
  const sample = crew.find((m) => m.id === astronautId)?.medical;
  const key = `chiron-medical-profile-v1-${astronautId}`;
  // An unedited sample copy saved earlier is ignored, so the current sample record always shows.
  try { const raw = localStorage.getItem(key); if (raw && JSON.parse(raw).status === 'sample') localStorage.removeItem(key); } catch { /* ignore */ }
  const [record, setRecord] = useLocal<DemoMedicalProfile>(key, {
    allergies: sample?.allergies ?? [], medications: sample?.medications ?? [], restrictions: sample?.restrictions ?? [],
    history: sample?.history ?? sample?.conditions ?? [], baselineNotes: sample?.notes ?? '',
    author: 'Simulated Earth medical team', version: 'demo-1', status: 'sample', updatedAt: '',
  });
  const edit = (field: 'allergies' | 'medications' | 'restrictions' | 'history', value: string) =>
    setRecord((r) => ({ ...r, [field]: value.split(/\n|,/).map((x) => x.trim()).filter(Boolean), status: 'draft', updatedAt: new Date().toISOString() }));

  return (
    <details className="mt-3 border border-marble/10 bg-void/75 backdrop-blur-md">
      <summary className="min-h-12 cursor-pointer px-4 py-3 font-mono text-xs tracking-[0.2em] text-marble/70">MEDICAL RECORD</summary>
      <div className="grid gap-3 border-t border-marble/10 p-4 sm:grid-cols-2">
        {([['allergies', 'Allergies'], ['medications', 'Medications'], ['restrictions', 'Mission restrictions'], ['history', 'Medical history']] as const).map(([field, label]) => (
          <label key={field} className="text-sm text-marble/70">{label}
            <textarea rows={2} value={record[field].join('\n')} onChange={(e) => edit(field, e.target.value)} placeholder="None"
              className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-sm text-marble" />
          </label>
        ))}
        <p className="text-sm text-marble/55 sm:col-span-2">Sample record. Do not enter real medical data.</p>
      </div>
    </details>
  );
}
