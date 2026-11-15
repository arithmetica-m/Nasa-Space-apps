import { useEffect, useRef, useState } from 'react';
import { Check, HardDrive, Server, Watch } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { newId } from '../emergency/events';
import { publish, useLog } from '../emergency/sync';
import { accessRole } from '../access/access';
import { ago, type LinkStatus } from '../link/link';
import { FIELD_LABEL, applyToRecord, loadCapsule, pending, saveCapsule, snapshot, type Capsule, type RecordField } from '../continuity/capsule';
import { PinPad } from './ProfileGate';
import { medicalOf } from '../library/advice';

// The Medical State Capsule on one band, as a three-step demo:
// 1 take the band offline, 2 record something on it, 3 reconnect: CHIRON merges it, nothing is lost.
// Shared screen: record values appear only to a medical officer resolving a conflict.
export function CapsulePanel({ member, link, crew, now }: { member: CrewMember; link: LinkStatus; crew: CrewMember[]; now: number }) {
  const log = useLog();
  const [cap, setCap] = useState<Capsule>(() => loadCapsule(member.id, link, log));
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [officer, setOfficer] = useState<CrewMember | 'choose'>();
  const [unlocked, setUnlocked] = useState<string>();
  const first = member.name.split(' ')[0];
  const { entries, automatic, conflicts } = pending(cap, log);
  const waiting = entries.length + automatic.length;
  const update = (c: Capsule) => { saveCapsule(c); setCap(c); };
  const officers = crew.filter((m) => accessRole(m) === 'medical');

  const sync = (c: Capsule) => {
    const p = pending(c, log);
    for (const e of p.entries) publish({ type: 'capsule-entry', by: member.id, crewId: member.id, entryId: e.id, text: e.text, recordedAt: e.t });
    for (const a of p.automatic) { applyToRecord(member.id, a.field, a.value); publish({ type: 'capsule-resolve', by: 'chiron', crewId: member.id, field: a.field, kept: 'capsule', value: a.value }); }
    const merged = p.entries.length + p.automatic.length;
    if (p.conflicts.length) {
      update({ ...c, offline: [], edits: Object.fromEntries(p.conflicts.map((x) => [x.field, x.capsule])) });
      setResult(`${merged ? `${merged} item${merged === 1 ? '' : 's'} merged. ` : ''}${p.conflicts.map((x) => FIELD_LABEL[x.field]).join(', ')} changed on both sides: a medical officer must choose.`);
      return;
    }
    update(snapshot(member.id, link, log));
    setResult(merged ? `Back online. ${merged} item${merged === 1 ? '' : 's'} from the band merged into CHIRON, and added to ${first}’s timeline. Nothing lost.` : 'Back online. Nothing new on the band: already in sync.');
  };

  // Reconnecting syncs straight away.
  const wasConnected = useRef(link.connected);
  useEffect(() => {
    if (link.connected && !wasConnected.current) sync(cap);
    if (!link.connected && wasConnected.current) setResult('');
    wasConnected.current = link.connected;
  }, [link.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBand = (connected: boolean) => publish({ type: 'band', by: member.id, crewId: member.id, connected });
  const record = () => {
    if (!text.trim()) return;
    update({ ...cap, offline: [...cap.offline, { id: newId(), text: text.trim(), t: Date.now() }] });
    setText('');
  };
  // Both sides change the same field while apart: the case CHIRON must never settle silently.
  const makeConflict = () => {
    update({ ...cap, edits: { ...cap.edits, allergies: [...(cap.edits.allergies ?? cap.record.allergies), 'Ibuprofen (added on the band)'] } });
    applyToRecord(member.id, 'allergies', [...medicalOf(member.id).allergies, 'Aspirin (added in CHIRON)']);
  };
  const resolve = (field: RecordField, kept: 'core' | 'capsule', value: string[]) => {
    if (kept === 'capsule') applyToRecord(member.id, field, value);
    publish({ type: 'capsule-resolve', by: unlocked ?? 'medical-officer', crewId: member.id, field, kept, value });
    const edits = { ...cap.edits }; delete edits[field];
    update(Object.keys(edits).length ? { ...cap, edits } : snapshot(member.id, link, log));
    setResult(`Resolved by a medical officer: kept ${kept === 'core' ? 'CHIRON’s' : 'the band’s'} version. Logged.`);
  };
  const conflictOpen = link.connected && conflicts.length > 0;
  const lineState = !link.connected ? { text: waiting || conflicts.length ? `OFFLINE · ${waiting + conflicts.length} WAITING ON THE BAND` : 'OFFLINE', cls: 'border-dashed border-[#e39b4b] text-[#f3c28d]' }
    : conflictOpen ? { text: 'CONFLICT · OFFICER TO CHOOSE', cls: 'border-[#e45b5b] text-[#ff8585]' }
      : { text: 'CONNECTED · IN SYNC', cls: 'border-[#5cc8a8] text-[#7bd5b8]' };

  const stepBox = (done: boolean, active: boolean) =>
    `border p-3 ${active ? 'border-gold/70 bg-gold/[0.06]' : done ? 'border-[#5cc8a8]/40' : 'border-marble/10 opacity-60'}`;

  return (
    <section className="border border-[#8fb8ff]/30 bg-[#8fb8ff]/[0.04] p-4" aria-label="Medical State Capsule">
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#bcd3ff]"><HardDrive size={14} /> MEDICAL STATE CAPSULE</div>
      <p className="mt-1 text-base text-marble/85">The band keeps an offline copy of {first}’s medical record. If it loses connection, nothing recorded on it is lost.</p>

      {/* Band ⇄ CHIRON */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex w-28 shrink-0 flex-col items-center border border-marble/20 p-2 text-center">
          <Watch size={20} className="text-gold" />
          <div className="mt-1 text-xs text-marble">BAND</div>
          <div className="text-[11px] text-marble/55">copy {cap.syncedAt ? ago(cap.syncedAt, now) : '—'}</div>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <div className={`border-t-2 ${lineState.cls.split(' ').slice(0, 2).join(' ')}`} />
          <div className={`mt-1 font-mono text-[10px] tracking-[0.15em] ${lineState.cls.split(' ').slice(2).join(' ')}`}>{lineState.text}</div>
        </div>
        <div className="flex w-28 shrink-0 flex-col items-center border border-marble/20 p-2 text-center">
          <Server size={20} className="text-gold" />
          <div className="mt-1 text-xs text-marble">CHIRON</div>
          <div className="text-[11px] text-marble/55">shared record</div>
        </div>
      </div>

      <div className="mt-4 font-mono text-[11px] tracking-[0.2em] text-gold">TRY IT · SIMULATED</div>
      <ol className="mt-2 space-y-2">
        <li className={stepBox(!link.connected, link.connected && !conflictOpen)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base text-marble">1 · Take the band offline</span>
            {link.connected ? <button type="button" onClick={() => setBand(false)} className="min-h-11 border border-marble/40 px-4 text-sm text-marble hover:border-gold">DISCONNECT BAND</button>
              : <span className="flex items-center gap-1 text-sm text-[#7bd5b8]"><Check size={14} /> Offline</span>}
          </div>
        </li>
        <li className={stepBox(waiting > 0, !link.connected)}>
          <div className="text-base text-marble">2 · Record something on the band</div>
          {link.connected ? <p className="mt-1 text-sm text-marble/55">Do step 1 first.</p> : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && record()} placeholder="e.g. Used reliever inhaler" aria-label="Record on the band"
                  className="min-h-11 min-w-[180px] flex-1 border border-marble/25 bg-transparent px-3 text-base text-marble placeholder:text-marble/35 focus:border-gold/70 focus:outline-none" />
                <button type="button" onClick={record} disabled={!text.trim()} className="min-h-11 bg-gold px-4 font-mono text-xs tracking-[0.15em] text-void disabled:opacity-40">SAVE ON BAND</button>
              </div>
              {cap.offline.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {cap.offline.map((e) => <li key={e.id} className="text-sm text-[#f3c28d]">● {e.text} <span className="text-marble/45">· saved on the band, waiting</span></li>)}
                </ul>
              )}
              <button type="button" onClick={makeConflict} disabled={!!cap.edits.allergies}
                className="mt-2 text-left text-sm text-[#bcd3ff] underline underline-offset-4 disabled:no-underline disabled:opacity-50">
                {cap.edits.allergies ? 'Allergies now changed on both sides ✓' : 'Optional: change the allergy list on the band AND in CHIRON (makes a conflict)'}
              </button>
            </>
          )}
        </li>
        <li className={stepBox(false, !link.connected)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base text-marble">3 · Reconnect: CHIRON merges it</span>
            {!link.connected && <button type="button" onClick={() => setBand(true)} className="min-h-11 bg-[#8fb8ff] px-4 font-mono text-xs font-semibold tracking-[0.15em] text-void">RECONNECT BAND</button>}
          </div>
          {result && <p className={`mt-2 text-base ${conflictOpen ? 'text-[#ffd9a8]' : 'text-[#7bd5b8]'}`}>{result}</p>}
        </li>
      </ol>

      {conflictOpen && (
        <div className="mt-3 border-2 border-[#e39b4b]/60 p-3">
          <p className="text-base text-[#ffd9a8]">{conflicts.map((c) => FIELD_LABEL[c.field]).join(', ')}: changed on the band and in CHIRON. Nothing was overwritten. A medical officer chooses.</p>
          {!unlocked && !officer && <button type="button" onClick={() => setOfficer('choose')} className="mt-2 min-h-11 border border-marble/40 px-4 text-sm text-marble hover:border-gold">I AM A MEDICAL OFFICER</button>}
          {officer === 'choose' && <div className="mt-2 flex flex-wrap gap-2">{officers.map((m) => <button key={m.id} type="button" onClick={() => setOfficer(m)} className="min-h-11 border border-marble/30 px-3 text-base text-marble hover:border-gold">{m.name}</button>)}</div>}
          {officer && officer !== 'choose' && !unlocked && <div className="mt-2"><PinPad person={officer} title={`${officer.name.split(' ')[0]}: enter your PIN`} onOk={() => { setUnlocked(officer.id); setOfficer(undefined); }} /></div>}
          {unlocked && conflicts.map((c) => (
            <div key={c.field} className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => resolve(c.field, 'core', c.core)} className="min-h-14 border border-marble/30 p-2 text-left text-base text-marble hover:border-gold"><span className="block text-sm text-marble/55">KEEP CHIRON’S VERSION</span>{c.core.join(', ') || 'None'}</button>
              <button type="button" onClick={() => resolve(c.field, 'capsule', c.capsule)} className="min-h-14 border border-[#8fb8ff]/50 p-2 text-left text-base text-marble hover:border-gold"><span className="block text-sm text-marble/55">KEEP THE BAND’S VERSION</span>{c.capsule.join(', ') || 'None'}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
