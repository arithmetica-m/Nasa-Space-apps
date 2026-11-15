import type { MissionId } from '../types';
import type { Category, CrewMember, InventoryItem, Procedure, Qualification, RoleId } from './types';

// ---------- Procedure retrieval ----------

// Only the newest approved version that applies to this mission is ever used.
// Drafts and superseded versions never override it. If none exists, say so.
export function resolveProcedure(kb: Procedure[], category: Category, mission: MissionId) {
  const approved = kb
    .filter((p) => p.category === category && p.status === 'approved' && p.missions.includes(mission))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (approved.length) return { procedure: approved[0] };
  const elsewhere = kb.some((p) => p.category === category && p.status === 'approved');
  return {
    procedure: undefined,
    reason: elsewhere
      ? 'A procedure exists in the demo library, but not for this mission. CHIRON will not adapt it on its own.'
      : 'No matching procedure is loaded for this emergency.',
  };
}

// ---------- Resource checks ----------

export interface ResourceCheck {
  itemId: string;
  name: string;
  location: string;
  status: InventoryItem['status'] | 'missing';
  ok: boolean;
  alternative?: { itemId: string; name: string; location: string };
}

const usable = (i: InventoryItem | undefined, qty: number) => !!i && i.status === 'available' && i.quantity >= qty;

// Runs before any guidance is shown. Unknown status counts as unavailable.
// Alternatives are only those the procedure itself lists as approved.
export function checkResources(p: Procedure, inventory: InventoryItem[]): ResourceCheck[] {
  return p.equipment.map((req) => {
    const item = inventory.find((i) => i.id === req.itemId);
    const ok = usable(item, req.quantity);
    let alternative: ResourceCheck['alternative'];
    if (!ok) {
      const alt = (req.alternatives ?? []).map((id) => inventory.find((i) => i.id === id)).find((i) => usable(i, req.quantity));
      if (alt) alternative = { itemId: alt.id, name: alt.name, location: alt.location };
    }
    return {
      itemId: req.itemId,
      name: item?.name ?? req.itemId,
      location: item?.location ?? 'Not on the manifest',
      status: item ? (item.quantity < req.quantity && item.status === 'available' ? 'depleted' : item.status) : 'missing',
      ok,
      alternative,
    };
  });
}

// ---------- Crew roles ----------

export interface Assignment { person?: CrewMember; note: string }
export type Roles = Record<RoleId, Assignment>;

export const roleName: Record<RoleId, string> = {
  lead: 'Medical lead',
  equipment: 'Equipment support',
  earth: 'Earth communication',
  monitor: 'Monitoring and support',
};

const has = (c: CrewMember, q: Qualification[]) => q.some((x) => c.qualifications.includes(x));

// Builds a role plan for this event. Clinical work only goes to trained crew;
// if the Crew Medical Officer is the patient, the backup takes the lead.
export function assignRoles(crew: CrewMember[], patientId: string, category: Category, p?: Procedure) {
  const pool = crew.filter((c) => c.available && c.id !== patientId);
  const taken = new Set<string>();
  const warnings: string[] = [];
  const pick = (prefer: Qualification[], fallback = true) => {
    const free = pool.filter((c) => !taken.has(c.id));
    const best = free.find((c) => has(c, prefer)) ?? (fallback ? free[0] : undefined);
    if (best) taken.add(best.id);
    return best;
  };

  const leadQuals = p?.qualifications.lead ?? ['cmo', 'cmo-backup'];
  const cmo = pool.find((c) => c.qualifications.includes('cmo'));
  const backup = pool.find((c) => c.qualifications.includes('cmo-backup'));
  let lead = cmo ?? backup ?? pool.find((c) => has(c, leadQuals));
  let leadNote = cmo ? 'Crew Medical Officer' : backup ? 'Backup Crew Medical Officer: the Crew Medical Officer is the patient or unavailable' : '';
  if (!lead) {
    lead = pool.find((c) => c.qualifications.includes('life-support'));
    leadNote = 'Life-support trained only. Clinical steps need guidance from Earth.';
    warnings.push('No clinically trained crew member is available. CHIRON will not assign clinical steps to untrained crew.');
  }
  if (lead) taken.add(lead.id);

  const equipment = pick(category === 'dcs' ? ['eva'] : p?.qualifications.equipment ?? []);
  const earth = pick(['comms']);
  const monitor = pick(category === 'behavioral' ? ['peer-support'] : ['life-support'], false)
    ?? pool.find((c) => c.id !== lead?.id)
    ?? lead;

  // Small crews: non-clinical roles go to helpers first so the medical lead can stay with
  // the patient. Monitoring is close to the patient, so it falls back to the lead.
  const helper = equipment ?? earth;
  const roles: Roles = {
    lead: { person: lead, note: leadNote },
    equipment: { person: equipment ?? earth ?? lead, note: equipment ? (category === 'dcs' && has(equipment, ['eva']) ? 'EVA trained, knows the suit and airlock' : 'Nearest free crew member') : 'Covered by another role: small crew' },
    earth: { person: earth ?? helper ?? lead, note: earth ? (has(earth, ['comms']) ? 'Trained on the medical communication link' : 'Free crew member') : 'Covered by a helper: small crew' },
    monitor: { person: monitor, note: monitor && monitor.id !== lead?.id ? 'Repeats observations and supports the patient' : 'Covered by the medical lead: small crew' },
  };
  if (pool.length < 2) warnings.push('Only one crew member is available to help. CHIRON combined all roles.');
  return { roles, warnings };
}
