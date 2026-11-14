import { useRef, useState } from 'react';
import { FileUp, ShieldCheck, X } from 'lucide-react';
import type { Category, Procedure, Step } from '../emergency/types';

const CATS: Category[] = ['dcs', 'respiratory', 'anaphylaxis', 'behavioral'];
const catLabel: Record<Category, string> = { dcs: 'Pressure or EVA', respiratory: 'Breathing or cabin air', anaphylaxis: 'Allergic reaction', behavioral: 'Behavioral' };

// Turns a plain-text procedure (numbered lines) into a structured draft record.
function fromText(fileName: string, text: string, category: Category): Procedure | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const steps = lines.filter((l) => /^\d+[.)]\s+/.test(l)).map((l, i): Step => ({
    id: `u${i + 1}`, role: 'lead', text: l.replace(/^\d+[.)]\s+/, ''), why: 'From the uploaded document.', verify: 'confirm', ifCannot: 'Contact Earth.',
  }));
  if (!steps.length) return undefined;
  return {
    id: `UPLOAD-${fileName.replace(/\W+/g, '-').toUpperCase().slice(0, 24)}`, title: lines[0].replace(/^#+\s*/, ''), category, version: '1.0', status: 'draft',
    source: { name: 'Uploaded document', document: fileName }, missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [], qualifications: {}, steps, escalation: [], monitoring: [],
  };
}

interface Props { kb: Procedure[]; onChange: (kb: Procedure[]) => void; onClose: () => void }

// The mission's medical knowledge base: approved procedures with versions and sources.
// Uploads always arrive as drafts. Only approving one makes it the version CHIRON uses.
export function KnowledgeBase({ kb, onChange, onClose }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>('respiratory');
  const [message, setMessage] = useState<string>();
  const [originals, setOriginals] = useState<{ name: string; size: number }[]>([]);

  const upload = async (f?: File) => {
    setMessage(undefined);
    if (!f) return;
    if (/\.json$/i.test(f.name)) {
      try {
        const parsed = JSON.parse(await f.text());
        const list: Procedure[] = (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({ ...p, status: 'draft' as const }));
        if (!list.every((p) => p.id && p.title && p.category && Array.isArray(p.steps))) throw new Error('missing fields');
        onChange([...kb, ...list]);
        setMessage(`${list.length} structured record(s) added as drafts. A medical administrator must approve them.`);
      } catch { setMessage('That JSON file does not match the procedure format (id, title, category, steps).'); }
    } else if (/\.txt$/i.test(f.name)) {
      const p = fromText(f.name, await f.text(), category);
      if (!p) { setMessage('No numbered steps found in that text file.'); return; }
      onChange([...kb, p]);
      setMessage(`"${p.title}" added as a draft with ${p.steps.length} steps. Check roles, equipment and branches before approving.`);
    } else if (/\.(pdf|docx)$/i.test(f.name)) {
      setOriginals((o) => [...o, { name: f.name, size: f.size }]);
      setMessage('PDF and Word files are kept as originals but not parsed automatically in this prototype. Enter the steps as structured records.');
    } else setMessage('Supported: JSON (structured), TXT (numbered steps), PDF and DOCX (stored as originals).');
  };

  // Approving a draft supersedes the previous approved version with the same ID.
  const approve = (p: Procedure) => onChange(kb.map((x) => {
    if (x === p) return { ...x, status: 'approved', source: { ...x.source, approvedBy: 'Medical administrator (demo)', approvedOn: new Date().toISOString().slice(0, 10) } };
    if (x.id === p.id && x.status === 'approved') return { ...x, status: 'superseded' };
    return x;
  }));

  const sorted = [...kb].sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id) || b.version.localeCompare(a.version, undefined, { numeric: true }));
  const statusCls = { approved: 'text-[#5cc8a8] border-[#5cc8a8]/60', draft: 'text-[#e39b4b] border-[#e39b4b]/60', superseded: 'text-mute border-marble/20' };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-void/95 backdrop-blur-md" style={{ animation: 'fade-in 0.4s ease-out' }}>
      <header className="flex items-center justify-between px-6 pt-5">
        <div>
          <div className="font-mono text-[10px] tracking-[0.4em] text-gold">⚷ MISSION MEDICAL LIBRARY</div>
          <div className="mt-1 font-serif text-2xl tracking-[0.15em] text-marble">APPROVED PROCEDURES</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-marble/70 hover:text-marble"><X /></button>
      </header>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <table className="h-fit w-full text-left text-sm">
          <thead className="font-mono text-[9px] tracking-[0.2em] text-mute"><tr><th className="pb-2">PROCEDURE</th><th>VERSION</th><th>STATUS</th><th>MISSIONS</th><th>SOURCE</th><th /></tr></thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={`${p.id}-${p.version}-${i}`} className="border-t border-marble/10 align-top">
                <td className="py-2 pr-3"><div className="font-mono text-[10px] text-gold">{p.id}</div><div className="text-marble">{p.title}</div><div className="text-xs text-mute">{catLabel[p.category]} · {p.steps.length} steps</div></td>
                <td className="py-2 font-mono text-marble/80">v{p.version}</td>
                <td className="py-2"><span className={`border px-1.5 font-mono text-[9px] tracking-[0.15em] ${statusCls[p.status]}`}>{p.status.toUpperCase()}</span></td>
                <td className="py-2 text-xs text-marble/60">{p.missions.join(', ')}</td>
                <td className="py-2 text-xs text-marble/60">{p.source.name}{p.source.approvedOn ? ` · approved ${p.source.approvedOn}` : ''}{p.source.document ? ` · ${p.source.document}` : ''}</td>
                <td className="py-2">{p.status === 'draft' && <button onClick={() => approve(p)} className="flex items-center gap-1 border border-[#5cc8a8]/60 px-2 py-1 font-mono text-[9px] tracking-[0.15em] text-[#5cc8a8]"><ShieldCheck size={11} /> APPROVE</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="space-y-3 text-sm">
          <div className="font-mono text-[9px] tracking-[0.3em] text-mute">UPLOAD (MEDICAL TEAM, BEFORE LAUNCH)</div>
          <label className="block text-xs text-marble/70">For text files, emergency type:
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="mt-1 block w-full border border-marble/20 bg-void px-2 py-1.5 text-marble">
              {CATS.map((c) => <option key={c} value={c}>{catLabel[c]}</option>)}
            </select>
          </label>
          <button onClick={() => file.current?.click()} className="flex w-full items-center justify-center gap-2 border border-dashed border-gold/50 py-3 font-mono text-[10px] tracking-[0.25em] text-gold hover:bg-gold/5"><FileUp size={14} /> UPLOAD DOCUMENT</button>
          <input ref={file} type="file" accept=".json,.txt,.pdf,.docx" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          {message && <p className="text-xs text-marble/80">{message}</p>}
          {originals.length > 0 && <ul className="text-xs text-mute">{originals.map((o) => <li key={o.name}>Original kept: {o.name} ({Math.round(o.size / 1024)} KB), not parsed</li>)}</ul>}
          <p className="text-xs leading-relaxed text-mute">
            CHIRON only ever uses the newest <span className="text-[#5cc8a8]">approved</span> version that applies to the current mission. Drafts and superseded versions never override it. If none applies, CHIRON says so instead of making one up.
          </p>
          <p className="text-xs leading-relaxed text-mute">All records shown are demo records, not clinical guidance. Approval here is a demo of the workflow; a real system needs signed-in medical administrators.</p>
        </aside>
      </div>
    </div>
  );
}
