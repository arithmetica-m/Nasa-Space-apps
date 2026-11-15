import { useState } from 'react';
import { Check, Watch } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { publish, useLog } from '../emergency/sync';
import { accessRole } from '../access/access';
import { ago, type LinkStatus, type LinkWarning } from '../link/link';
import { PinPad } from './ProfileGate';

export const alertIdOf = (crewId: string, w: LinkWarning) => `${crewId}:${w.key}:${w.t}`;

// One LINK warning and where it is in its life: generated → sent → delivered → acknowledged → reviewed → resolved.
// Resolved happens by itself when the reading is back inside the rule (or the band is reset).
export function AlertCard({ band, w, crew, links, now, onProfile }: { band: LinkStatus; w: LinkWarning; crew: CrewMember[]; links: Record<string, LinkStatus>; now: number; onProfile: () => void }) {
  const log = useLog();
  const [reviewing, setReviewing] = useState<CrewMember | 'choose'>();
  const id = alertIdOf(band.crewId, w);
  const ack = log.find((e) => e.type === 'alert-ack' && e.alertId === id);
  const review = log.find((e) => e.type === 'alert-review' && e.alertId === id);
  const devices = Object.values(links);
  const delivered = devices.filter((l) => l.connected).length;
  const name = (cid?: string) => crew.find((c) => c.id === cid)?.name.split(' ')[0] ?? 'Shared dashboard';
  const officers = crew.filter((m) => accessRole(m) === 'medical' && m.id !== band.crewId);
  const steps: [string, boolean, string][] = [
    ['GENERATED', true, ago(w.t, now)],
    ['SENT', true, 'to every device'],
    ['DELIVERED', delivered > 0, `${delivered} of ${devices.length} bands`],
    ['ACKNOWLEDGED', !!ack, ack ? `by ${name(ack.by)}` : 'waiting'],
    ['REVIEWED', !!review, review ? `by ${name(review.by)}` : 'medical officer'],
    ['RESOLVED', false, 'when the reading is back in range'],
  ];

  return (
    <section role="alert" className="border-2 border-[#e45b5b] bg-[#e45b5b]/15 px-5 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-[#ff8585]"><Watch size={14} className="mr-1 inline" /> LINK WARNING · {ago(w.t, now).toUpperCase()}</div>
          <div className="text-lg text-marble">{crew.find((c) => c.id === band.crewId)?.name} needs a check</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ack && <button type="button" onClick={() => publish({ type: 'alert-ack', by: 'shared-dashboard', alertId: id, crewId: band.crewId })} className="min-h-12 bg-[#e45b5b] px-4 font-mono text-xs font-semibold tracking-[0.18em] text-[#130709]">ACKNOWLEDGE</button>}
          {ack && !review && <button type="button" onClick={() => setReviewing('choose')} className="min-h-12 border-2 border-marble/40 px-4 font-mono text-xs tracking-[0.18em] text-marble">MEDICAL REVIEW</button>}
          <button type="button" onClick={onProfile} className="min-h-12 border border-[#ff8585]/60 px-4 font-mono text-xs tracking-[0.18em] text-[#ff8585]">OPEN PROFILE</button>
        </div>
      </div>
      <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Alert progress">
        {steps.map(([label, done, detail]) => (
          <li key={label} className={done ? 'text-marble' : 'text-marble/45'}>
            {done ? <Check size={14} className="mr-1 inline text-[#7bd5b8]" /> : <span className="mr-1 inline-block h-3 w-3 rounded-full border border-marble/40 align-middle" />}
            {label} <span className="text-marble/50">· {detail}</span>
          </li>
        ))}
      </ol>
      {reviewing === 'choose' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="w-full text-base text-marble">Which medical officer is reviewing?</span>
          {officers.map((m) => <button key={m.id} type="button" onClick={() => setReviewing(m)} className="min-h-12 border border-marble/30 px-4 text-lg text-marble hover:border-gold">{m.name}</button>)}
          <button type="button" onClick={() => setReviewing(undefined)} className="min-h-12 px-3 text-base text-marble/60">Cancel</button>
        </div>
      )}
      {reviewing && reviewing !== 'choose' && (
        <div className="mt-3">
          <PinPad person={reviewing} title={`${reviewing.name.split(' ')[0]}: enter your PIN to record the review`}
            onOk={() => { publish({ type: 'alert-review', by: reviewing.id, alertId: id, crewId: band.crewId, note: 'Reviewed by medical officer' }); setReviewing(undefined); }} />
        </div>
      )}
    </section>
  );
}
