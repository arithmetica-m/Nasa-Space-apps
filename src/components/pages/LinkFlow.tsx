import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { publish, useLog } from '../../emergency/sync';
import { WARNING_RULES, ago, type LinkStatus } from '../../link/link';

const KEYS = [
  { key: 'spo2', label: 'Blood oxygen', unit: '%' },
  { key: 'hr', label: 'Heart rate', unit: 'bpm' },
  { key: 'skin', label: 'Skin temperature', unit: '°C' },
  { key: 'activity', label: 'Exercise today', unit: 'min' },
] as const;

const PRESETS: { label: string; key: (typeof KEYS)[number]['key']; value: number }[] = [
  { label: 'Low oxygen · 89%', key: 'spo2', value: 89 },
  { label: 'Fast heart · 128 bpm', key: 'hr', value: 128 },
  { label: 'Normal oxygen · 98%', key: 'spo2', value: 98 },
];

// LINK → CORE, step by step: send a simulated reading from this band and watch it travel.
export function LinkFlow({ link, name, now, onProfile }: { link: LinkStatus; name: string; now: number; onProfile: () => void }) {
  const log = useLog();
  const [key, setKey] = useState<(typeof KEYS)[number]['key']>('spo2');
  const [value, setValue] = useState('');
  const send = (k: (typeof KEYS)[number]['key'], v: number) => publish({ type: 'link-reading', by: link.crewId, crewId: link.crewId, key: k, value: v });

  const last = [...log].reverse().find((e) => (e.type === 'link-reading' || e.type === 'link-clear') && e.crewId === link.crewId);
  const sent = last?.type === 'link-reading' ? last : undefined;
  const unitRaw = KEYS.find((k) => k.key === sent?.key)?.unit ?? '';
  const unit = unitRaw === '%' ? '%' : ` ${unitRaw}`;
  const label = KEYS.find((k) => k.key === sent?.key)?.label ?? '';
  const rule = sent && WARNING_RULES.find((w) => w.key === sent.key);
  const broke = !!(sent && rule?.test(sent.value));
  const time = sent ? new Date(sent.t).toISOString().slice(11, 19) : '';

  const steps = sent ? [
    { title: '1 · LINK measures', text: `${label} ${sent.value}${unit} at ${time} GMT (simulated band).` },
    { title: '2 · CORE receives', text: `Sent over the crew network, stored in the shared crew log ${ago(sent.t, now)}.` },
    { title: '3 · Profile updates', text: `${name}’s dashboard now shows ${sent.value}${unit} as LIVE, with its time.` },
    { title: '4 · Warning check', text: rule ? `Rule: ${rule.rule}. ${broke ? 'Broken → WARNING.' : 'Within limits → no warning.'}` : 'No warning rule for this reading.' },
    { title: '5 · Dashboard alert', text: broke ? `Alert on every CHIRON device; ${name.split(' ')[0]}’s status → MEDICAL ATTENTION.` : 'No alert needed.' },
  ] : [];

  return (
    <div className="border border-gold/30 bg-gold/[0.04] p-3">
      <div className="font-mono text-[11px] tracking-[0.2em] text-gold">SEND A READING FROM THIS BAND TO CORE · SIMULATED</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => send(p.key, p.value)} className="min-h-11 border border-marble/25 px-3 text-base text-marble hover:border-gold">{p.label}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={key} onChange={(e) => setKey(e.target.value as typeof key)} aria-label="Reading" className="min-h-11 border border-marble/25 bg-void px-2 text-base text-marble">
          {KEYS.map((k) => <option key={k.key} value={k.key}>{k.label} ({k.unit})</option>)}
        </select>
        <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" placeholder="Value"
          className="min-h-11 w-28 border border-marble/25 bg-transparent px-3 text-base text-marble" />
        <button type="button" disabled={!Number.isFinite(parseFloat(value))} onClick={() => { send(key, parseFloat(value)); setValue(''); }}
          className="flex min-h-11 items-center gap-2 bg-gold px-4 font-mono text-xs tracking-[0.2em] text-void disabled:opacity-40"><Send size={14} /> SEND</button>
        {sent && <button type="button" onClick={() => publish({ type: 'link-clear', by: link.crewId, crewId: link.crewId })} className="min-h-11 px-3 text-sm text-marble/60 underline-offset-2 hover:underline">Reset band</button>}
      </div>

      {sent && (
        <ol className="mt-3 grid gap-2 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className={`border p-2 ${i >= 3 && broke ? 'border-[#e45b5b]/60 bg-[#e45b5b]/10' : 'border-[#5cc8a8]/40'}`}>
              <div className="flex items-center gap-1 font-mono text-[11px] tracking-[0.12em] text-marble"><Check size={13} className={i >= 3 && broke ? 'text-[#ff8585]' : 'text-[#7bd5b8]'} /> {s.title}</div>
              <p className="mt-1 text-sm text-marble/80">{s.text}</p>
            </li>
          ))}
        </ol>
      )}
      {sent && <button type="button" onClick={onProfile} className="mt-2 min-h-10 font-mono text-xs tracking-[0.18em] text-gold hover:text-marble">SEE IT ON {name.split(' ')[0].toUpperCase()}’S DASHBOARD →</button>}
    </div>
  );
}
