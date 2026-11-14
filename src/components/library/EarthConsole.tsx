import { useState } from 'react';
import { Satellite, Send } from 'lucide-react';
import { publish } from '../../emergency/sync';
import { useLibrary } from '../../library/store';
import type { LibraryEntry } from '../../library/entries';

// MISSION CONTROL (EARTH) CONSOLE: the only place the medical library can be changed.
// Open CHIRON with ?earth in the address. In a real system this would need Mission Control
// sign-in and a medical approval step; in the prototype the address alone opens it.

const bump = (v: string) => { const [a, b = '0'] = v.split('.'); return `${a}.${Number(b) + 1}`; };
const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

export function EarthConsole() {
  const { entries, updates } = useLibrary();
  const [id, setId] = useState(entries[0].id);
  const entry = entries.find((e) => e.id === id)!;
  const [draft, setDraft] = useState(() => toDraft(entry));
  const [note, setNote] = useState('');
  const [sent, setSent] = useState('');

  const pick = (next: string) => { setId(next); setDraft(toDraft(entries.find((e) => e.id === next)!)); setNote(''); setSent(''); };

  const release = () => {
    const updated: LibraryEntry = {
      ...entry,
      summary: draft.summary.trim(),
      doNow: lines(draft.doNow),
      getHelpNow: lines(draft.getHelpNow),
      version: bump(entry.version),
      updated: new Date().toISOString().slice(0, 10),
      approvedBy: 'Mission Control medical team (simulated)',
    };
    publish({ type: 'library', by: 'earth', entry: updated, note: note.trim() || 'Updated by Mission Control' });
    setSent(`Version ${updated.version} sent to the crew. It replaces the old version on every crew device, and the old one stays in the record.`);
    setNote('');
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#0a1220] p-4 text-marble md:p-8" style={{ height: '100%' }}>
      <header className="flex flex-wrap items-center gap-3 border-b border-[#8fb8ff]/30 pb-4">
        <Satellite className="text-[#8fb8ff]" />
        <div className="mr-auto">
          <h1 className="font-serif text-2xl tracking-[0.2em]">MISSION CONTROL · MEDICAL LIBRARY</h1>
          <p className="text-sm text-marble/60">Earth only. Changes are released as new versions to every crew device. Prototype: no real sign-in.</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Library entries">
          <ul className="space-y-1">
            {entries.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => pick(e.id)} aria-current={e.id === id}
                  className={`min-h-11 w-full px-3 text-left text-sm ${e.id === id ? 'bg-[#8fb8ff]/15 text-[#bcd3ff]' : 'text-marble/75 hover:bg-marble/5'}`}>
                  {e.title} <span className="text-xs text-marble/45">v{e.version}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="max-w-3xl space-y-4">
          <h2 className="text-xl">{entry.title} <span className="text-sm text-marble/50">· {entry.id} · now v{entry.version}</span></h2>
          <Field label="Summary" rows={3} value={draft.summary} onChange={(v) => setDraft({ ...draft, summary: v })} />
          <Field label="What to do now (one step per line)" rows={6} value={draft.doNow} onChange={(v) => setDraft({ ...draft, doNow: v })} />
          <Field label="Get help now if (one sign per line)" rows={4} value={draft.getHelpNow} onChange={(v) => setDraft({ ...draft, getHelpNow: v })} />
          <Field label="Reason for the change (shown to the crew)" rows={2} value={note} onChange={setNote} />
          <button type="button" onClick={release} disabled={!lines(draft.doNow).length}
            className="flex min-h-12 items-center gap-2 bg-[#8fb8ff] px-5 font-mono text-sm tracking-[0.15em] text-[#0a1220] hover:bg-[#bcd3ff] disabled:opacity-40">
            <Send size={16} /> RELEASE v{bump(entry.version)} TO THE CREW
          </button>
          {sent && <p role="status" className="text-[#bcd3ff]">{sent}</p>}

          <div className="border-t border-marble/10 pt-4">
            <h3 className="font-mono text-xs tracking-[0.2em] text-marble/60">RELEASED SINCE LAUNCH</h3>
            {updates.length === 0 ? <p className="mt-1 text-sm text-marble/50">Nothing yet.</p> : (
              <ul className="mt-1 space-y-1 text-sm text-marble/75">{updates.map((u) => <li key={u.id + u.version}>{new Date(u.t).toISOString().slice(11, 16)} GMT · {u.title} v{u.version} · {u.note}</li>)}</ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function toDraft(e: LibraryEntry) {
  return { summary: e.summary, doNow: e.doNow.join('\n'), getHelpNow: e.getHelpNow.join('\n') };
}

function Field({ label, rows, value, onChange }: { label: string; rows: number; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-marble/70">{label}
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-marble/20 bg-transparent p-2 text-base text-marble" />
    </label>
  );
}
