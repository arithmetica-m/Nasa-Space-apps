// Data model for CHIRON's emergency response system.

export type Category = 'dcs' | 'respiratory' | 'anaphylaxis' | 'behavioral';
export type Qualification = 'cmo' | 'cmo-backup' | 'life-support' | 'eva' | 'comms' | 'peer-support';
export type RoleId = 'lead' | 'equipment' | 'earth' | 'monitor';

export interface CrewMember {
  id: string;
  name: string;
  position: string;
  qualifications: Qualification[];
  available: boolean;
  medical: {
    allergies: string[];
    conditions: string[];
    notes: string;
    medications?: string[];
    restrictions?: string[];
    history?: string[];
  };
}

export interface DemoMedicalProfile {
  allergies: string[];
  medications: string[];
  restrictions: string[];
  history: string[];
  baselineNotes: string;
  author: string;
  version: string;
  status: 'sample' | 'draft' | 'demo-reviewed';
  updatedAt: string;
  reviewedAt?: string;
}

export type ItemStatus = 'available' | 'in-use' | 'reserved' | 'depleted' | 'damaged' | 'expired' | 'unverified';
export type ItemCategory = 'diagnostic' | 'equipment' | 'supplies' | 'medication' | 'protective' | 'behavioral';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  location: string;
  expires?: string;
  storage?: string;
  status: ItemStatus;
  log: { time: string; by: string; change: string }[];
}

export interface Step {
  id: string;
  role: RoleId;
  text: string;
  why: string;
  equipment?: string[];
  // 'confirm': the person doing it confirms. 'clinical': the medical lead must verify before moving on.
  verify?: 'confirm' | 'clinical';
  ask?: { question: string };
  // Only part of the plan when an earlier question got this answer.
  when?: { step: string; answer: 'yes' | 'no' };
  // Steps that must be finished (or not apply) first. No dependency means it can run in parallel.
  after?: string[];
  ifCannot: string;
}

export interface Procedure {
  id: string;
  title: string;
  category: Category;
  version: string;
  status: 'approved' | 'draft' | 'superseded';
  source: { name: string; approvedBy?: string; approvedOn?: string; document?: string };
  missions: string[];
  equipment: { itemId: string; quantity: number; alternatives?: string[] }[];
  qualifications: Partial<Record<RoleId, Qualification[]>>;
  steps: Step[];
  escalation: string[];
  monitoring: string[];
}

export type Authority = 'procedure' | 'medical' | 'chiron';
export interface EarthMessage {
  id: string;
  direction: 'out' | 'in';
  authority: Authority;
  title: string;
  body: string;
  sentAt: number;
  arrivesAt: number;
}
