import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Boxes, FlaskConical, HeartPulse, Lock, Satellite, Search, Siren, X } from 'lucide-react';
import type { MissionId } from '../../types';
import type { Procedure as EmergencyProtocol } from '../../emergency/types';
import { procedures as guides } from '../../data/procedures';
import { studiesFor } from '../../data/research';
import { systems } from '../../data/indicators';
import { inventoryNow } from '../../emergency/plan';
import { useLog } from '../../emergency/sync';
import { useLibrary } from '../../library/store';
import { SOURCES, type LibraryEntry } from '../../library/entries';
import { WhyBlock } from '../Explained';

type Section = 'problems' | 'guides' | 'emergency' | 'stock' | 'science' | 'updates';

const SECTIONS: { id: Section; label: string; icon: typeof BookOpen }[] = [
  { id: 'problems', label: 'Health problems', icon: HeartPulse },
  { id: 'guides', label: 'Step-by-step guides', icon: BookOpen },
  { id: 'emergency', label: 'Emergency protocols', icon: Siren },
  { id: 'stock', label: 'Medical stock', icon: Boxes },
  { id: 'science', label: 'Science and sources', icon: FlaskConical },
  { id: 'updates', label: 'Updates from Earth', icon: Satellite },
];

interface Props {
  mission: MissionId;
  kb: EmergencyProtocol[];
  startWith?: string;
  startProtocol?: string;
  onGuide: (id: string) => void;
  onClose: () => void;
}

// THE MISSION MEDICAL LIBRARY: read-only for the crew. Only Mission Control can release changes.
export function Library({ mission, kb, startWith, startProtocol, onGuide, onClose }: Props) {
  const { entries, updates, rejected } = useLibrary();
  const log = useLog();
  const [section, setSection] = useState<Section>(startProtocol ? 'emergency' : 'problems');
  const [openId, setOpenId] = useState<string | undefined>(startWith);
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const found = useMemo(() => entries.filter((e) => !query
    || [e.title, e.summary, ...e.doNow, ...e.getHelpNow, ...(e.triggers.symptoms ?? [])].join(' ').toLowerCase().includes(query)), [entries, query]);
  const open = entries.find((e) => e.id === openId);
  const stock = inventoryNow(log, mission);
  const changed = new Set(updates.map((u) => u.id));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-void/97 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <header className="flex flex-wrap items-center gap-3 border-b border-marble/10 px-4 py-3 md:px-8">
        <div className="mr-auto">
          <h1 id="library-title" className="font-serif text-xl tracking-[0.2em] text-marble">⚷ MEDICAL LIBRARY</h1>
          <p className="flex items-center gap-1.5 text-xs text-marble/55"><Lock size={12} /> Read-only on board. Only Mission Control can change it.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 border border-marble/20 px-3">
          <Search size={16} className="text-marble/50" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setSection('problems'); setOpenId(undefined); }} placeholder="Search: headache, sleep…"
            aria-label="Search the library" className="w-40 bg-transparent text-sm text-marble outline-none sm:w-56" />
        </label>
        <button type="button" onClick={onClose} aria-label="Close library" className="flex min-h-11 min-w-11 items-center justify-center border border-marble/20 text-marble/70 hover:text-marble"><X size={18} /></button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Library sections" className="flex gap-1 overflow-x-auto border-b border-marble/10 p-2 md:w-60 md:flex-col md:border-b-0 md:border-r md:p-3">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setSection(id); setOpenId(undefined); }} aria-current={section === id}
              className={`flex min-h-11 shrink-0 items-center gap-2 px-3 text-left text-sm ${section === id ? 'bg-gold/10 text-gold' : 'text-marble/70 hover:bg-marble/5'}`}>
              <Icon size={16} /> {label}{id === 'updates' && updates.length > 0 && <span className="ml-1 bg-[#8fb8ff] px-1.5 text-[10px] text-void">{updates.length}</span>}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          {section === 'problems' && (open ? <EntryView e={open} stock={stock} changed={changed.has(open.id)} onBack={() => setOpenId(undefined)} onGuide={onGuide} /> : (
            <ul className="grid gap-2 md:grid-cols-2">
              {found.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpenId(e.id)} className="flex min-h-16 w-full flex-col border border-marble/10 bg-marble/[0.02] px-4 py-3 text-left hover:border-gold/50">
                    <span className="text-base text-marble">{e.title}</span>
                    <span className="mt-0.5 text-xs text-marble/50">{systems.find((s) => s.id === e.system)?.name} · v{e.version}{changed.has(e.id) && <span className="ml-2 text-[#8fb8ff]">UPDATED BY EARTH</span>}</span>
                  </button>
                </li>
              ))}
              {!found.length && <p className="text-marble/60">Nothing matches “{q}”. Try a simpler word, or ask the medical officer.</p>}
            </ul>
          ))}

          {section === 'guides' && (
            <ul className="grid gap-2 md:grid-cols-2">
              {guides.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => onGuide(g.id)} className="flex min-h-16 w-full items-center justify-between border border-marble/10 px-4 text-left hover:border-gold/50">
                    <span className="text-base text-marble">{g.title}</span><span className="font-mono text-xs tracking-[0.2em] text-gold">OPEN</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {section === 'emergency' && (
            <div className="space-y-3">
              {kb.filter((p) => p.status === 'approved' && p.missions.includes(mission)).map((p) => (
                <details key={p.id + p.version} open={p.id === startProtocol} className="border border-marble/10">
                  <summary className="min-h-14 cursor-pointer px-4 py-3 text-base text-marble">{p.title} <span className="text-xs text-marble/50">· {p.id} v{p.version}</span></summary>
                  <div className="border-t border-marble/10 px-4 py-3 text-sm">
                    <ol className="list-decimal space-y-1 pl-5 text-marble/85">{p.steps.map((s) => <li key={s.id}>{s.text}</li>)}</ol>
                    {p.escalation.length > 0 && <p className="mt-2 text-[#ff8585]">Escalate if: {p.escalation.join(' · ')}</p>}
                    <p className="mt-3 border-t border-marble/10 pt-2 text-xs text-mute">Onboard source record: {p.source.name}. This demonstration contains no flight-approved mission medication formulary; use only patient-specific prescribed medication and its onboard instructions. CHIRON does not calculate a dose.</p>
                    {[...new Map(p.steps.filter((step) => step.source).map((step) => [step.source!.url, step.source!])).values()].length > 0 && (
                      <div className="mt-3">
                        <h3 className="font-semibold text-marble">Published guidance referenced by this onboard protocol</h3>
                        <ul className="mt-1 space-y-2">
                          {[...new Map(p.steps.filter((step) => step.source).map((step) => [step.source!.url, step.source!])).values()].map((source) => (
                            <li key={source.url} className="border-l-2 border-gold/60 pl-2">
                              <p className="text-marble">{source.label}</p>
                              <p className="text-marble/60">{p.steps.filter((step) => step.source?.url === source.url).map((step) => step.why).join(' ')}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}

          {section === 'stock' && (
            <ul className="divide-y divide-marble/10 border-y border-marble/10">
              {stock.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div><div className="text-base text-marble">{i.name}</div><div className="text-sm text-marble/55">{i.location} · {i.quantity} on board{i.expires ? ` · expires ${i.expires}` : ''}</div></div>
                  <span className={`font-mono text-xs tracking-[0.15em] ${i.status === 'available' && i.quantity > 0 ? 'text-[#7bd5b8]' : 'text-[#e39b4b]'}`}>{i.status.toUpperCase()}</span>
                </li>
              ))}
              <li className="py-2 text-xs text-mute">Simulated manifest. Stock changes are logged; check the physical item before use.</li>
            </ul>
          )}

          {section === 'science' && (
            <div className="space-y-6">
              <section>
                <h2 className="font-serif text-lg tracking-[0.12em] text-marble">NASA SOURCES THIS LIBRARY USES</h2>
                <ul className="mt-2 space-y-1">{Object.values(SOURCES).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-2">{s.label}</a></li>)}</ul>
              </section>
              <section>
                <h2 className="font-serif text-lg tracking-[0.12em] text-marble">NASA STUDIES BY BODY SYSTEM</h2>
                <p className="text-sm text-marble/55">From NASA’s Open Science Data Repository (OSDR). They explain how spaceflight affects the body; they are not a diagnosis.</p>
                {systems.map((s) => {
                  const st = studiesFor(s.id);
                  return st.length ? (
                    <div key={s.id} className="mt-3">
                      <div className="font-mono text-xs tracking-[0.2em] text-marble/60">{s.name.toUpperCase()}</div>
                      <ul className="mt-1 space-y-1 text-sm">{st.map((x) => <li key={x.accession}><a href={x.url} target="_blank" rel="noreferrer" className="text-marble/85 underline decoration-marble/30 underline-offset-2">{x.title}</a> <span className="text-mute">· {x.kind}</span></li>)}</ul>
                    </div>
                  ) : null;
                })}
              </section>
            </div>
          )}

          {section === 'updates' && (
            <div>
              <p className="text-base text-marble">Every change comes from Mission Control as a new version. Older versions stay in the record.</p>
              {updates.length === 0 && <p className="mt-3 text-marble/60">No updates since launch. All entries are the launch versions.</p>}
              <ul className="mt-3 space-y-2">
                {updates.map((u) => (
                  <li key={u.id + u.version} className="border border-[#8fb8ff]/30 px-4 py-3">
                    <div className="text-base text-marble">{u.title} → v{u.version}</div>
                    <div className="text-sm text-marble/60">{new Date(u.t).toISOString().slice(0, 16).replace('T', ' ')} GMT · {u.note}</div>
                    <div className="text-sm text-[#7bd5b8]">✓ From Mission Control · integrity check passed (demo key)</div>
                    <button type="button" onClick={() => { setSection('problems'); setOpenId(u.id); }} className="mt-1 font-mono text-xs tracking-[0.15em] text-gold">READ IT</button>
                  </li>
                ))}
              </ul>
              {rejected.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-base text-[#ff9c9c]">Rejected updates</h3>
                  <ul className="mt-2 space-y-2">
                    {rejected.map((r) => <li key={r.t + r.title} className="border border-[#e45b5b]/40 px-4 py-2 text-sm text-marble/80">{r.title} v{r.version} · {r.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function EntryView({ e, stock, changed, onBack, onGuide }: { e: LibraryEntry; stock: ReturnType<typeof inventoryNow>; changed: boolean; onBack: () => void; onGuide: (id: string) => void }) {
  const items = (e.equipment ?? []).map((id) => stock.find((s) => s.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <article className="max-w-3xl space-y-4 text-[15px] leading-relaxed">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm text-marble/70 hover:text-marble"><ArrowLeft size={16} /> All health problems</button>
      <div>
        <h2 className="font-serif text-2xl tracking-[0.1em] text-marble">{e.title.toUpperCase()}</h2>
        <p className="text-xs text-mute">{e.id} · version {e.version} · {e.updated} · approved by {e.approvedBy}{changed && <span className="ml-2 text-[#8fb8ff]">UPDATED BY EARTH</span>}</p>
      </div>
      <p className="text-marble/90">{e.summary}</p>
      <div className="border-l-2 border-gold bg-gold/[0.07] px-3 py-2">
        <div className="font-mono text-[11px] tracking-[0.2em] text-gold">WHAT TO DO</div>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-marble">{e.doNow.map((x) => <li key={x}>{x}</li>)}</ol>
        {e.guide && <button type="button" onClick={() => onGuide(e.guide!)} className="mt-2 font-mono text-xs tracking-[0.15em] text-gold">OPEN THE STEP-BY-STEP GUIDE</button>}
      </div>
      <div className="border-l-2 border-[#e45b5b] bg-[#e45b5b]/[0.07] px-3 py-2">
        <div className="font-mono text-[11px] tracking-[0.2em] text-[#ff8585]">GET HELP NOW IF</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-marble">{e.getHelpNow.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      {e.personal && e.personal.length > 0 && (
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-[#8fb8ff]">EXTRA ADVICE FOR SOME MEDICAL HISTORIES</div>
          <ul className="mt-1 space-y-1 text-marble/85">{e.personal.map((p) => <li key={p.note}><span className="text-marble/50">{p.match.join(', ')}:</span> {p.note}</li>)}</ul>
        </div>
      )}
      {items.length > 0 && (
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">EQUIPMENT ON BOARD</div>
          <ul className="mt-1 space-y-0.5 text-marble/85">{items.map((i) => <li key={i.id}>{i.name} · {i.location} · <span className={i.status === 'available' && i.quantity > 0 ? 'text-[#7bd5b8]' : 'text-[#e39b4b]'}>{i.status}</span></li>)}</ul>
        </div>
      )}
      <div>
        <div className="font-mono text-[11px] tracking-[0.2em] text-marble/50">WHY THESE STEPS · SOURCES</div>
        <div className="mt-1"><WhyBlock reasoning={e.reasoning} basis={e.basis} /></div>
      </div>
      <p className="text-xs text-mute">Prototype content written from public NASA material. A real mission would load its approved medical checklist here. No medicine doses are given: the medical officer or flight surgeon decides.</p>
    </article>
  );
}
