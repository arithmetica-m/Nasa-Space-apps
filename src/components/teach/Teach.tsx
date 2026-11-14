import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, FileUp, TriangleAlert } from 'lucide-react';
import { parseProtocol, procedures, type Procedure } from '../../data/procedures';
import { StepIllustration } from '../StepIllustration';
import { NEXT_STEP_EVENT, speak } from '../VoiceControl';

interface Props {
  startWith?: string;
  uploaded: Procedure[];
  onUpload: (p: Procedure) => void;
  onComplete: (p: Procedure) => void;
  onMedicalLibrary: () => void;
  onClose: () => void;
}

// TEACH: Chiron as a visual instructor. One instruction per card, a picture,
// progress, and a confirmation for each step.
export function Teach({ startWith, uploaded, onUpload, onComplete, onMedicalLibrary, onClose }: Props) {
  const all = [...procedures, ...uploaded];
  const [current, setCurrent] = useState<Procedure | undefined>(all.find((p) => p.id === startWith));
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);

  const open = (p: Procedure) => { setCurrent(p); setStep(0); setDone(false); };

  const upload = async (f?: File) => {
    setError(undefined);
    if (!f) return;
    if (!/\.(txt|md)$/i.test(f.name)) { setError('This prototype can read .txt and .md protocols. Other formats are not supported yet.'); return; }
    const p = parseProtocol(f.name, await f.text());
    if (!p) { setError('Chiron could not find any steps in that file.'); return; }
    onUpload(p);
    open(p);
  };

  const s = current?.steps[step];
  useEffect(() => {
    const onNextStep = () => {
      if (current && !done && step + 1 < current.steps.length) {
        setStep((value) => value + 1);
        speak('Moving to the next step.');
      }
      else if (current && !done && step + 1 === current.steps.length) {
        setDone(true);
        onComplete(current);
        speak('Guide complete.');
      } else speak('Choose a guide first.');
    };
    window.addEventListener(NEXT_STEP_EVENT, onNextStep);
    return () => window.removeEventListener(NEXT_STEP_EVENT, onNextStep);
  }, [current, done, onComplete, step]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-void/95 backdrop-blur-md" style={{ animation: 'fade-in 0.5s ease-out' }}>
      <header className="flex items-center justify-between px-6 pt-5 md:px-8">
        <div>
          <div className="font-mono text-[10px] tracking-[0.4em] text-gold">⚷ CHIRON IS TEACHING</div>
          <div className="mt-1 font-serif text-2xl tracking-[0.18em] text-marble">PROCEDURES</div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onMedicalLibrary} className="flex min-h-11 items-center gap-2 border border-marble/20 px-3 font-mono text-[10px] tracking-[0.15em] text-marble/70 hover:border-gold/60 hover:text-gold">
            <BookOpen size={14} /> MISSION MEDICAL LIBRARY
          </button>
          <button onClick={onClose} className="flex min-h-11 items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-marble/70 hover:text-gold">
            <ArrowLeft size={14} /> BACK TO WATCH
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 px-6 py-5 md:grid-cols-[260px_minmax(0,1fr)] md:px-8">
        {/* Library */}
        <nav className="min-h-0 overflow-y-auto" aria-label="Procedures">
          <div className="font-mono text-[9px] tracking-[0.3em] text-mute">FROM MISSION PROTOCOLS</div>
          <ul className="mt-2 space-y-1">
            {procedures.map((p) => (
              <li key={p.id}>
                <button onClick={() => open(p)} className={`w-full border-l-2 px-3 py-2 text-left text-sm transition ${current?.id === p.id ? 'border-gold bg-gold/10 text-marble' : 'border-transparent text-marble/70 hover:bg-marble/5'}`}>{p.title}</button>
              </li>
            ))}
          </ul>
          {uploaded.length > 0 && (
            <>
              <div className="mt-5 font-mono text-[9px] tracking-[0.3em] text-mute">UPLOADED BY YOU</div>
              <ul className="mt-2 space-y-1">
                {uploaded.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => open(p)} className={`w-full border-l-2 px-3 py-2 text-left text-sm transition ${current?.id === p.id ? 'border-gold bg-gold/10 text-marble' : 'border-transparent text-marble/70 hover:bg-marble/5'}`}>{p.title}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button onClick={() => file.current?.click()} className="mt-5 flex w-full items-center justify-center gap-2 border border-dashed border-gold/50 px-3 py-3 font-mono text-[10px] tracking-[0.25em] text-gold hover:bg-gold/5">
            <FileUp size={14} /> UPLOAD A PROTOCOL
          </button>
          <input ref={file} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          <p className="mt-2 text-[11px] leading-relaxed text-mute">A text file with numbered steps works best. Chiron turns each step into a card.</p>
          {error && <p className="mt-2 text-xs text-[#e39b4b]">{error}</p>}
        </nav>

        {/* Card stage */}
        <section className="flex min-h-0 flex-col items-center justify-center overflow-y-auto">
          {!current ? (
            <div className="max-w-md text-center">
              <h2 className="font-serif text-xl tracking-[0.15em] text-marble">WHAT DO YOU NEED TO DO?</h2>
              <p className="mt-3 text-sm text-marble/65">Pick a procedure, or upload a protocol document. Chiron shows it one step at a time, with a picture for each step.</p>
            </div>
          ) : done ? (
            <div className="rise max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold"><Check size={26} /></div>
              <h2 className="mt-4 font-serif text-xl tracking-[0.15em] text-marble">PROCEDURE COMPLETE</h2>
              <p className="mt-2 text-sm text-marble/65">{current.title}. Recorded on today's health line.</p>
              <div className="mt-6 flex justify-center gap-2">
                <button onClick={() => open(current)} className="border border-marble/20 px-4 py-2.5 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:border-marble/40">REPEAT</button>
                <button onClick={onClose} className="bg-gold px-4 py-2.5 font-mono text-[10px] tracking-[0.25em] text-void hover:bg-marble">BACK TO TODAY</button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl">
              <h2 className="font-serif text-xl tracking-[0.12em] text-marble">{current.title.toUpperCase()}</h2>
              <p className="mt-1 text-sm text-marble/60">{current.purpose}</p>
              <div className={`mt-2 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] ${current.source.kind === 'uploaded' ? 'text-[#e39b4b]' : 'text-[#c8a96a]'}`}>
                <TriangleAlert size={12} />
                {current.source.label.toUpperCase()}
              </div>

              <div className="mt-4 flex gap-1">
                {current.steps.map((_, i) => <span key={i} className={`h-1 flex-1 ${i < step ? 'bg-gold' : i === step ? 'bg-gold/60' : 'bg-marble/10'}`} />)}
              </div>

              {/* One instruction per card; the key forces a fresh entry animation */}
              <div key={`${current.id}-${step}`} className="rise mt-4 grid items-center gap-6 border border-gold/30 bg-void/70 p-6 sm:grid-cols-[180px_minmax(0,1fr)]">
                <StepIllustration icon={s!.icon} className="mx-auto h-40 w-44" />
                <div>
                  <div className="font-mono text-[10px] tracking-[0.3em] text-mute">STEP {step + 1} OF {current.steps.length}</div>
                  <p className="mt-2 text-xl leading-snug text-marble md:text-2xl">{s!.text}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setStep(step - 1)} disabled={step === 0} className="border border-marble/20 px-5 py-3 font-mono text-[10px] tracking-[0.25em] text-marble/70 hover:border-marble/40 disabled:opacity-30">BACK</button>
                <button onClick={() => { if (step + 1 < current.steps.length) setStep(step + 1); else { setDone(true); onComplete(current); } }}
                  className="flex flex-1 items-center justify-center gap-2 bg-gold py-3 font-mono text-[11px] tracking-[0.3em] text-void hover:bg-marble">
                  <Check size={14} /> {step + 1 < current.steps.length ? 'DONE, NEXT STEP' : 'DONE, FINISH'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
