import type { MissionId } from '../types';
import type { ChironEvent } from '../emergency/events';
import type { Category, Procedure } from '../emergency/types';
import { crew, inventoryFor } from '../emergency/data';
import { assignRoles, checkResources, resolveProcedure } from '../emergency/engine';
import { DELAY_MIN } from '../emergency/plan';
import { categoryText } from '../emergency/report';
import { skillStatus } from '../train/training';
import { bandInfo } from '../link/link';

// MISSION MEDICAL READINESS SIMULATION (Level 2).
// For each emergency scenario, CHIRON plays it through with the real engine: which approved
// protocol it would use, whether the equipment is there, who would lead if each crew member
// were the patient, whether the lead's training is current, and how much Earth can help.
// It only reports gaps. It never proposes unapproved substitutes.

// A gap and what the crew should do about it.
export interface Gap { text: string; fix: string; action?: 'practice' | 'stock'; who?: string }

export interface ScenarioCheck {
  category: Category;
  name: string;
  ready: boolean;
  gaps: Gap[];
  ok: string[];
  logic: string[];
}

export function readiness(kb: Procedure[], mission: MissionId, log?: ChironEvent[]): ScenarioCheck[] {
  const inventory = inventoryFor(mission);
  const delay = DELAY_MIN[mission];
  return (['dcs', 'respiratory', 'anaphylaxis', 'behavioral'] as Category[]).map((category) => {
    const gaps: Gap[] = [];
    const ok: string[] = [];
    const logic: string[] = [];
    const { procedure, reason } = resolveProcedure(kb, category, mission);
    if (procedure) {
      ok.push(`Approved protocol on board: ${procedure.title} (v${procedure.version}).`);
      logic.push(`Protocol: newest approved version for this mission (${procedure.id} v${procedure.version}). Drafts and old versions are ignored.`);
    } else {
      gaps.push({ text: reason ?? 'No approved protocol on board.', fix: 'Ask Earth to approve the protocol for this mission. Until then, practise the general version.', action: 'practice' });
      logic.push('Protocol: none approved for this mission → the crew would need paper procedures and Earth.');
    }

    if (procedure) {
      const checks = checkResources(procedure, inventory);
      for (const c of checks) {
        if (c.ok) continue;
        gaps.push(c.alternative
          ? { text: `${c.name} is ${c.status}.`, fix: `Use the approved alternative: ${c.alternative.name}. Check where it is stored.`, action: 'stock' }
          : { text: `${c.name} is ${c.status}, with no approved alternative.`, fix: 'Ask Earth for a resupply or an approved alternative.', action: 'stock' });
      }
      logic.push(`Equipment: ${checks.length} items needed; ${checks.filter((c) => c.ok).length} available on the simulated manifest. Unknown status counts as unavailable.`);
      if (checks.every((c) => c.ok)) ok.push('All required equipment is available.');
    }

    // Who would lead, for each possible patient.
    const leads = crew.map((patient) => {
      const { roles, warnings } = assignRoles(crew, patient.id, category, procedure);
      return { patient, lead: roles.lead.person, warnings };
    });
    const noLead = leads.filter((l) => !l.lead || l.warnings.some((w) => w.includes('No clinically trained')));
    if (noLead.length) gaps.push({ text: `No trained lead if ${noLead.map((l) => l.patient.name).join(', ')} is the patient.`, fix: 'Train a backup lead: practise this emergency.', action: 'practice' });
    else ok.push(`A trained lead is available whoever is the patient (${[...new Set(leads.map((l) => l.lead?.name))].join(' or ')}).`);
    logic.push(...leads.map((l) => `If ${l.patient.name} is the patient → ${l.lead?.name ?? 'nobody trained'} leads.`));
    const medical = crew.filter((c) => c.qualifications.includes('cmo') || c.qualifications.includes('cmo-backup'));
    gaps.push({ text: `If ${medical.map((m) => m.name.split(' ')[0]).join(' and ')} both cannot help, nobody medically trained is left.`, fix: 'Everyone practises this emergency as a backup.', action: 'practice' });

    // Training of the people who would lead.
    for (const m of medical) {
      const s = skillStatus(m.id, mission).find((x) => x.skill.id === category);
      if (s?.due) gaps.push({ text: `${m.name.split(' ')[0]} last practised this ${s.daysSince} days ago.`, fix: `${m.name.split(' ')[0]}: practise it again now.`, action: 'practice', who: m.id });
      if (s) logic.push(`Training: ${m.name.split(' ')[0]} practised ${s.daysSince} days ago (demo rule: medical crew refresh every 60 days).`);
    }

    // Crew availability: a band that is offline means alerts and tasks may not reach that person.
    for (const m of crew.filter((x) => !bandInfo(x.id, log).connected)) {
      gaps.push({ text: `${m.name.split(' ')[0]}’s LINK band is offline: alerts and tasks may not reach them.`, fix: `Check ${m.name.split(' ')[0]}’s band and battery today.` });
    }
    if (procedure) logic.push(`Protocol version: ${procedure.id} v${procedure.version}, the newest approved for this mission. Steps that depend on equipment were checked against the stock.`);

    // Help from Earth.
    if (delay >= 5) gaps.push({ text: `Earth is ${delay} min away each way: no live help.`, fix: 'Practise the whole emergency without asking Earth.', action: 'practice' });
    else ok.push('Earth can help almost in real time.');
    logic.push(`Communication: ${delay} min each way → round trip at least ${Math.round(delay * 2 * 10) / 10} min.`);

    const blocking = gaps.filter((g) => !g.text.includes('both cannot help') && !g.fix.startsWith('Use the approved alternative'));
    return { category, name: categoryText[category], ready: blocking.length === 0, gaps, ok, logic };
  });
}
