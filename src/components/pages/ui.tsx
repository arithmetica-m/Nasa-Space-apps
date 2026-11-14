import type { ReactNode } from 'react';

// Small shared building blocks so every CHIRON page looks and reads the same.

export function PageShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 pb-24 pt-2 md:px-8">
      <div>
        <h1 className="font-serif text-2xl tracking-[0.2em] text-marble">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-base text-marble/70">{intro}</p>}
      </div>
      {children}
    </main>
  );
}

export function Panel({ title, tag, children, tone }: { title?: string; tag?: string; children: ReactNode; tone?: 'alert' | 'warn' }) {
  const border = tone === 'alert' ? 'border-[#e45b5b]/50' : tone === 'warn' ? 'border-[#e39b4b]/50' : 'border-marble/10';
  return (
    <section className={`border ${border} bg-void/80 p-4 backdrop-blur-md md:p-5`}>
      {(title || tag) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && <h2 className="font-serif text-lg tracking-[0.12em] text-marble">{title}</h2>}
          {tag && <Tag kind={tag} />}
        </div>
      )}
      {children}
    </section>
  );
}

// Labels that say what kind of information something is.
const TAGS: Record<string, string> = {
  SIMULATED: 'border-marble/30 text-marble/60',
  'SIMULATION (LEVEL 2)': 'border-[#8fb8ff]/50 text-[#8fb8ff]',
  MEASURED: 'border-[#5cc8a8]/50 text-[#7bd5b8]',
  'POSSIBLE WARNING SIGN': 'border-[#e39b4b]/50 text-[#f3c28d]',
  'CONFIRMED FINDING': 'border-[#e45b5b]/50 text-[#ff8585]',
  LIVE: 'border-[#5cc8a8]/50 text-[#7bd5b8]',
  'LAST KNOWN': 'border-[#e39b4b]/50 text-[#f3c28d]',
  'NOT AVAILABLE': 'border-marble/30 text-marble/50',
};
export function Tag({ kind }: { kind: string }) {
  return <span className={`border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.15em] ${TAGS[kind] ?? 'border-marble/30 text-marble/60'}`}>{kind}</span>;
}
