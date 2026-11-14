import { RadioTower, WifiOff } from 'lucide-react';
import type { Authority, EarthMessage } from '../../emergency/types';
import { clock } from '../../emergency/store';

// The three kinds of message are always visually distinct, so a CHIRON summary
// can never be mistaken for a doctor's instruction.
export const authorityStyle: Record<Authority, { label: string; cls: string }> = {
  procedure: { label: 'APPROVED PROCEDURE', cls: 'border-[#5cc8a8]/60 text-[#5cc8a8]' },
  medical: { label: 'AUTHORIZED MEDICAL PERSONNEL', cls: 'border-[#8fb8ff]/70 text-[#8fb8ff]' },
  chiron: { label: 'CHIRON SUMMARY · AUTOMATIC', cls: 'border-marble/30 text-marble/60' },
};

interface Props {
  messages: EarthMessage[];
  now: number;
  delayLabel: string;
  linkLost: boolean;
  onToggleLink: () => void;
  onSendUpdate: () => void;
}

export function EarthLink({ messages, now, delayLabel, linkLost, onToggleLink, onSendUpdate }: Props) {
  const inbox = messages.filter((m) => m.direction === 'in' && m.arrivesAt <= now);
  const outbox = messages.filter((m) => m.direction === 'out');
  return (
    <section className="border border-marble/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-marble/70">
          {linkLost ? <WifiOff size={13} className="text-[#e39b4b]" /> : <RadioTower size={13} />} EARTH LINK
        </div>
        <button onClick={onToggleLink} className="font-mono text-[9px] tracking-[0.15em] text-mute hover:text-marble">{linkLost ? 'RESTORE LINK (DEMO)' : 'SIMULATE LINK LOSS'}</button>
      </div>
      <p className="mt-1 text-xs text-marble/70">
        {linkLost ? 'No link. Reports are queued and sent automatically when it returns. Keep following the approved steps.' : `Connected · ${delayLabel} each way. Never wait for a reply when the approved steps say what to do.`}
      </p>

      <div className="mt-2 font-mono text-[9px] tracking-[0.25em] text-mute">FROM EARTH</div>
      {inbox.length === 0 && <p className="mt-1 text-xs text-mute">No messages yet.</p>}
      <ul className="mt-1 space-y-1.5">
        {inbox.map((m) => (
          <li key={m.id} className={`border-l-2 pl-2 text-xs ${authorityStyle[m.authority].cls}`}>
            <div className="font-mono text-[9px] tracking-[0.15em]">{authorityStyle[m.authority].label} · {clock(m.arrivesAt)}</div>
            <div className="text-marble">{m.title}</div>
            <div className="text-marble/70">{m.body}</div>
          </li>
        ))}
      </ul>

      <div className="mt-3 font-mono text-[9px] tracking-[0.25em] text-mute">TO EARTH</div>
      <ul className="mt-1 space-y-1">
        {outbox.map((m) => (
          <li key={m.id} className="flex justify-between gap-2 text-xs">
            <span className="text-marble/80">{m.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-mute">
              {m.sentAt === 0 ? 'QUEUED' : m.arrivesAt > now ? `ARRIVES ${clock(m.arrivesAt)}` : 'DELIVERED'}
            </span>
          </li>
        ))}
      </ul>
      <button onClick={onSendUpdate} className="mt-2 w-full border border-marble/30 py-2 font-mono text-[10px] tracking-[0.25em] text-marble/80 hover:border-marble">SEND STATUS UPDATE</button>
    </section>
  );
}
