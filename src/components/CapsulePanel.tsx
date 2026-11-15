import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import type { CrewMember } from '../emergency/types';
import { newId } from '../emergency/events';
import { publish, useLog } from '../emergency/sync';
import { accessRole } from '../access/access';
import { ago, type LinkStatus } from '../link/link';
import { FIELD_LABEL, applyToRecord, loadCapsule, pending, saveCapsule, snapshot, type Capsule, type RecordField } from '../continuity/capsule';
import { PinPad } from './ProfileGate';
import { medicalOf } from '../library/advice';

// The Medical State Capsule on one band: status, offline entries, and reconciliation with CORE.
// Shared screen: shows counts only. Record values appear only to a medical officer resolving a conflict.
export function CapsulePanel({ member, link, crew, now }: { member: CrewMember; link: LinkStatus; crew: CrewMember[]; now: number }) {
  const log = useLog();
  const [cap, setCap] = useState<Capsule>(() => loadCapsule(member.id, link, log));
  const [text, setText] = useState('');
  const [officer, setOfficer] = useState<CrewMember | 'choose'>();
  const [unlocked, setUnlocked] = useState<string>();
  const first = member.name.split(' ')[0];
  const { entries, automatic, conflicts } = pending(cap, log);
  const update = (c: Capsule) => { saveCapsule(c); setCap(c); };
  const officers = crew.filter((m) => accessRole(m) === 'medical');

  const sync = () => {
    for (const e of entries) publish({ type: 'capsule-entry', by: member.id, crewId: member.id, entryId: e.id, text: e.text, recordedAt: e.t });
    for (const a of automatic) { applyToRecord(member.id, a.field, a.value); publish({ type: 'capsule-resolve', by: 'chiron', crewId: member.id, field: a.field, kept: 'capsule', value: a.value }); }
    if (conflicts.length) { const edits = Object.fromEntries(conflicts.map((c) => [c.field, c.capsule])); update({ ...cap, offline: [], edits }); return; }
    update(snapshot(member.id, link, log));
  };
  const resolve = (field: RecordField, kept: 'core' | 'capsule', value: string[]) => {
    if (kept === 'capsule') applyToRecord(member.id, field, value);
    publish({ type: 'capsule-resolve', by: unlocked ?? 'medical-officer', crewId: member.id, field, kept, value });
    const edits = { ...cap.edits }; delete edits[field];
    update(Object.keys(edits).length ? { ...cap, edits } : snapshot(member.id, link, log));
  };

  const state = !link.connected ? `Band offline: CORE cannot reach it. The capsule keeps the copy from ${cap.syncedAt ? ago(cap.syncedAt, now) : 'before'}.`
    : entries.length || automatic.length || conflicts.length ? `Waiting to reconcile: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} recorded on the band, ${automatic.length + conflicts.length} record change${automatic.length + conflicts.length === 1 ? '' : 's'}.`
      : `In sync with CORE · last sync ${cap.syncedAt ? ago(cap.syncedAt, now) : 'never'}.`;

  return (
    <div className="border border-[#8fb8ff]/30 bg-[#8fb8ff]/[0.04] p-3">
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#bcd3ff]"><HardDrive size={14} /> MEDICAL STATE CAPSULE · OFFLINE COPY ON THE BAND</div>
      <p className={`mt-1 text-base ${!link.connected || entries.length || automatic.length || conflicts.length ? 'text-[#f3c28d]' : 'text-[#7bd5b8]'}`}>{state}</p>
      <p className="text-sm text-marble/55">Holds {first}’s allergies, medications, history, latest readings{cap.openEmergencies.length ? ' and the open emergency' : ''}, readable without CORE.</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Record on the band, e.g. used reliever inhaler" aria-label="Record on the band"
          className="min-h-11 min-w-[200px] flex-1 border border-marble/25 bg-transparent px-3 text-base text-marble" />
        <button type="button" disabled={!text.trim()} onClick={() => { update({ ...cap, offline: [...cap.offline, { id: newId(), text: text.trim(), t: Date.now() }] }); setText(''); }}
          className="min-h-11 border border-marble/30 px-3 text-sm text-marble disabled:opacity-40">RECORD ON BAND</button>
        <button type="button" onClick={() => update({ ...cap, edits: { ...cap.edits, allergies: [...(cap.edits.allergies ?? cap.record.allergies), 'Ibuprofen (recorded on band)'] } })}
          className="min-h-11 border border-marble/30 px-3 text-sm text-marble/80">Simulate an allergy added on the band</button>
        <button type="button" onClick={() => { const core = medicalOf(member.id); applyToRecord(member.id, 'allergies', [...core.allergies, 'Aspirin (entered in CORE)']); setCap({ ...cap }); }}
          className="min-h-11 border border-marble/30 px-3 text-sm text-marble/80">Simulate a different change in CORE</button>
        <button type="button" onClick={() => publish({ type: 'band', by: member.id, crewId: member.id, connected: !link.connected })}
          className="min-h-11 border border-marble/30 px-3 text-sm text-marble/80">{link.connected ? 'Disconnect band (simulate)' : 'Reconnect band (simulate)'}</button>
        <button type="button" disabled={!link.connected} onClick={sync}
          className="min-h-11 bg-[#8fb8ff] px-4 font-mono text-xs font-semibold tracking-[0.15em] text-void disabled:opacity-40">SYNC AND RECONCILE</button>
      </div>

      {link.connected && conflicts.length > 0 && entries.length === 0 && (
        <div className="mt-3 border-2 border-[#e39b4b]/60 p-3">
          <p className="text-base text-[#ffd9a8]">{conflicts.map((c) => FIELD_LABEL[c.field]).join(', ')} changed on the band and in CORE. Nothing was overwritten: a medical officer chooses.</p>
          {!unlocked && !officer && <button type="button" onClick={() => setOfficer('choose')} className="mt-2 min-h-11 border border-marble/40 px-4 text-sm text-marble">I AM A MEDICAL OFFICER</button>}
          {officer === 'choose' && <div className="mt-2 flex flex-wrap gap-2">{officers.map((m) => <button key={m.id} type="button" onClick={() => setOfficer(m)} className="min-h-11 border border-marble/30 px-3 text-base text-marble">{m.name}</button>)}</div>}
          {officer && officer !== 'choose' && !unlocked && <div className="mt-2"><PinPad person={officer} title={`${officer.name.split(' ')[0]}: enter your PIN`} onOk={() => { setUnlocked(officer.id); setOfficer(undefined); }} /></div>}
          {unlocked && conflicts.map((c) => (
            <div key={c.field} className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => resolve(c.field, 'core', c.core)} className="min-h-14 border border-marble/30 p-2 text-left text-base text-marble"><span className="block text-sm text-marble/55">KEEP CORE</span>{c.core.join(', ') || 'None'}</button>
              <button type="button" onClick={() => resolve(c.field, 'capsule', c.capsule)} className="min-h-14 border border-[#8fb8ff]/50 p-2 text-left text-base text-marble"><span className="block text-sm text-marble/55">KEEP THE BAND’S VERSION</span>{c.capsule.join(', ') || 'None'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
