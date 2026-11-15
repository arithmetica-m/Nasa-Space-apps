import { useRef, useState } from 'react';
import { Download, FileUp, X } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { CREW_FILE_FIELDS, CREW_FILE_TEMPLATE, loadExtraCrew, parseCrewFile, saveExtraCrew } from '../access/crewFile';
import { Avatar } from './Avatar';

// ADD A CREW MEMBER: load their crew file. CHIRON checks it and builds their profile.
export function AddCrew({ crew, onClose }: { crew: CrewMember[]; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<CrewMember>();
  const [format, setFormat] = useState(false);
  const added = crew.filter((m) => m.added);

  const read = async (file?: File) => {
    if (!file) return;
    const result = parseCrewFile(await file.text(), crew);
    setErrors(result.errors);
    setReady(result.member);
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(CREW_FILE_TEMPLATE, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'chiron-crew-file-template.json'; a.click();
    URL.revokeObjectURL(url);
  };
  // The crew list is read when CHIRON starts, so it restarts to include the change everywhere.
  const add = () => { if (!ready) return; saveExtraCrew([...loadExtraCrew(), ready]); window.location.reload(); };
  const remove = (id: string) => { saveExtraCrew(loadExtraCrew().filter((m) => m.id !== id)); window.location.reload(); };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#020408]/90 p-3 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-labelledby="addcrew-title">
      <section className="mx-auto w-full max-w-2xl border border-gold/30 bg-[#07090d] p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 id="addcrew-title" className="font-serif text-2xl tracking-[0.15em] text-marble">ADD A CREW MEMBER</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-12 w-12 items-center justify-center border border-marble/20 text-marble/70 hover:text-marble"><X /></button>
        </div>
        <p className="mt-2 text-lg text-marble/80">Load the astronaut’s crew file. CHIRON checks it, then builds their profile, medical record and LINK band.</p>

        <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-16 items-center justify-center gap-2 bg-gold px-5 text-lg font-semibold text-void"><FileUp size={22} /> CHOOSE THE CREW FILE</button>
          <button type="button" onClick={template} className="flex min-h-16 items-center justify-center gap-2 border-2 border-gold/60 px-5 text-lg text-gold"><Download size={22} /> GET AN EMPTY TEMPLATE</button>
        </div>

        {errors.length > 0 && (
          <div role="alert" className="mt-4 border-l-4 border-[#e45b5b] bg-[#e45b5b]/10 px-4 py-3">
            <p className="text-xl text-marble">This file cannot be used yet:</p>
            <ul className="mt-2 space-y-1 text-lg text-[#ffb3b3]">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>
          </div>
        )}

        {ready && (
          <div className="mt-4 border-2 border-[#5cc8a8]/60 bg-[#5cc8a8]/[0.06] p-4">
            <div className="flex items-center gap-4">
              <Avatar id={ready.id} name={ready.name} size={64} />
              <div>
                <div className="text-2xl text-marble">{ready.name}</div>
                <div className="text-lg text-marble/70">{ready.position}</div>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-lg sm:grid-cols-2">
              <div><dt className="text-sm text-marble/50">ALLERGIES</dt><dd className="text-marble">{ready.medical.allergies.join(', ') || 'None'}</dd></div>
              <div><dt className="text-sm text-marble/50">MEDICATIONS</dt><dd className="text-marble">{ready.medical.medications?.join(', ') || 'None'}</dd></div>
              <div><dt className="text-sm text-marble/50">MEDICAL HISTORY</dt><dd className="text-marble">{ready.medical.history?.join(', ') || 'None'}</dd></div>
              <div><dt className="text-sm text-marble/50">RESPONSIBILITIES</dt><dd className="text-marble">{ready.duties?.join(', ')}</dd></div>
            </dl>
            <button type="button" onClick={add} className="mt-4 min-h-16 w-full bg-[#5cc8a8] text-xl font-bold text-[#06110d]">FILE IS COMPLETE · ADD {ready.name.split(' ')[0].toUpperCase()} TO THE CREW</button>
            <p className="mt-2 text-sm text-marble/55">Their health history will be simulated, like the rest of the crew’s. Added on this device.</p>
          </div>
        )}

        <button type="button" onClick={() => setFormat(!format)} aria-expanded={format} className="mt-4 min-h-12 text-base text-gold underline-offset-4 hover:underline">{format ? 'Hide' : 'Show'} what the file must contain</button>
        {format && (
          <table className="mt-2 w-full text-base">
            <tbody>
              {CREW_FILE_FIELDS.map(([k, v]) => <tr key={k} className="border-t border-marble/10"><td className="py-1.5 pr-4 font-mono text-sm text-gold">{k}</td><td className="py-1.5 text-marble/85">{v}</td></tr>)}
            </tbody>
          </table>
        )}

        {added.length > 0 && (
          <div className="mt-5 border-t border-marble/10 pt-4">
            <h3 className="text-lg text-marble">Added from a file</h3>
            <ul className="mt-2 space-y-2">
              {added.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 border border-marble/10 px-3 py-2">
                  <span className="text-lg text-marble">{m.name} <span className="text-base text-marble/55">· {m.position}</span></span>
                  <button type="button" onClick={() => remove(m.id)} className="min-h-11 border border-marble/25 px-4 text-base text-marble/75 hover:border-[#e45b5b] hover:text-[#ff9c9c]">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
