import type { MissionId } from '../types';
import type { CrewMember, InventoryItem, Procedure, Telemetry } from './types';

// ALL DATA IN THIS FILE IS SIMULATED FOR THE PROTOTYPE.
// Procedures are demo records: they show the structure CHIRON needs (version, approval,
// equipment, roles, branches, escalation) but are not clinical guidance. Clinical steps
// point to "the approved card", which must come from the mission's medical authority.

export const crew: CrewMember[] = [
  { id: 'ana', name: 'Ana Rocha', position: 'Flight engineer · Crew Medical Officer', qualifications: ['cmo', 'life-support', 'eva'], available: true,
    medical: { allergies: ['Penicillin (simulated)'], conditions: [], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'lena', name: 'Lena Sørensen', position: 'Flight engineer · backup Crew Medical Officer', qualifications: ['cmo-backup', 'life-support', 'eva'], available: true,
    medical: { allergies: [], conditions: [], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'kai', name: 'Kai Mensah', position: 'Commander', qualifications: ['life-support', 'eva', 'comms'], available: true,
    medical: { allergies: ['Latex (simulated)'], conditions: [], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'ravi', name: 'Ravi Iyer', position: 'Mission specialist', qualifications: ['life-support', 'comms', 'peer-support'], available: true,
    medical: { allergies: [], conditions: [], notes: 'Baseline from pre-flight exam (simulated).' } },
];

const base: Omit<InventoryItem, 'log'>[] = [
  { id: 'o2-mask', name: 'Oxygen mask set', category: 'protective', quantity: 3, location: 'Medical bay, drawer M2', status: 'available' },
  { id: 'pba', name: 'Portable breathing apparatus', category: 'protective', quantity: 4, location: 'Beside each module hatch', status: 'available' },
  { id: 'pulse-ox', name: 'Pulse oximeter', category: 'diagnostic', quantity: 2, location: 'Medical bay, kit A', status: 'available' },
  { id: 'bp-monitor', name: 'Blood pressure monitor', category: 'diagnostic', quantity: 1, location: 'Medical bay, wall mount', status: 'available' },
  { id: 'ecg', name: 'ECG unit', category: 'diagnostic', quantity: 1, location: 'Medical bay, cabinet M1', status: 'available' },
  { id: 'co2-monitor', name: 'Portable CO2 monitor', category: 'diagnostic', quantity: 1, location: 'Laboratory, rack L2', status: 'available' },
  { id: 'anaph-kit', name: 'Anaphylaxis kit (contents per mission formulary)', category: 'medication', quantity: 2, location: 'Medical bay, drawer M1', expires: '2027-06-30', storage: 'Room temperature, away from light', status: 'available' },
  { id: 'restraint', name: 'Patient restraint board', category: 'equipment', quantity: 1, location: 'Medical bay, wall stowage', status: 'available' },
  { id: 'pressure', name: 'Suit and airlock pressurisation (treatment capability)', category: 'equipment', quantity: 1, location: 'Airlock', status: 'available' },
  { id: 'bh-kit', name: 'Private support kit (headset, private channel)', category: 'behavioral', quantity: 1, location: 'Crew quarters, locker Q1', status: 'available' },
];

// Mission-specific differences, so the same emergency meets different constraints.
const overrides: Partial<Record<MissionId, Partial<Record<string, Partial<InventoryItem>>>>> = {
  moon: { 'anaph-kit': { quantity: 1, status: 'unverified' }, pressure: { status: 'unverified' }, ecg: { quantity: 0, status: 'depleted' } },
  'mars-transit': { 'anaph-kit': { quantity: 1 }, 'o2-mask': { quantity: 1, status: 'damaged' } },
  'mars-surface': { 'co2-monitor': { status: 'in-use' } },
};

export function inventoryFor(mission: MissionId): InventoryItem[] {
  return base.map((i) => ({ ...i, ...(overrides[mission]?.[i.id] ?? {}), log: [{ time: 'Pre-launch', by: 'Manifest import', change: 'Loaded from simulated manifest' }] }));
}

export function telemetryFor(mission: MissionId): Telemetry[] {
  const now = new Date().toISOString().slice(11, 16);
  const pressure = mission === 'moon' || mission === 'mars-surface' ? 70.3 : 101.3;
  return [
    { time: now, module: 'Habitat', o2: 21.1, co2: 2.6, pressure, airQuality: 'nominal' },
    mission === 'mars-transit'
      ? { time: now, module: 'Laboratory', o2: 20.4, co2: 6.2, pressure, airQuality: 'alert' }
      : { time: now, module: 'Laboratory', o2: 21.0, co2: 2.9, pressure, airQuality: 'nominal' },
  ];
}

export const missionContext: Record<MissionId, { evacuation: string; eva: string }> = {
  iss: { evacuation: 'Return capsule docked: Earth in a few hours', eva: 'EVA ended 6 hours ago (Kai, Lena)' },
  moon: { evacuation: 'Return to Earth takes about 3 days', eva: 'Surface EVA ended 2 hours ago (Ana, Kai)' },
  'mars-transit': { evacuation: 'No evacuation possible', eva: 'No EVA during this transit' },
  'mars-surface': { evacuation: 'No evacuation possible', eva: 'Surface EVA ended 4 hours ago (Ana, Ravi)' },
};

const DEMO = { name: 'CHIRON demo record · not clinically validated · replace with mission-approved procedure', approvedBy: 'Demo medical authority (simulated)', approvedOn: '2026-09-01' };

export const procedures: Procedure[] = [
  {
    id: 'DEMO-DCS-01', title: 'Suspected decompression sickness after EVA', category: 'dcs', version: '1.2', status: 'approved', source: DEMO,
    missions: ['iss', 'moon', 'mars-surface'],
    equipment: [{ itemId: 'o2-mask', quantity: 1, alternatives: ['pba'] }, { itemId: 'pulse-ox', quantity: 1 }, { itemId: 'pressure', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'], equipment: ['eva'] },
    steps: [
      { id: 'd1', role: 'lead', text: 'Make sure the crew member is inside a pressurised module and secured.', why: 'Every later step assumes a safe, pressurised place.', verify: 'confirm', ifCannot: 'Keep them in the airlock and call the commander.' },
      { id: 'd2', role: 'lead', text: 'Ask when the symptoms started.', why: 'Timing relative to the EVA decides which card section applies.', ask: { question: 'Did symptoms start during or after an EVA in the last 24 hours?' }, after: ['d1'], ifCannot: 'Record "timing unknown" and continue.' },
      { id: 'd2b', role: 'lead', when: { step: 'd2', answer: 'no' }, text: 'Record that this may not be pressure-related. Use the assessment section of the approved card.', why: 'CHIRON does not decide the cause; the card and the flight surgeon do.', verify: 'confirm', ifCannot: 'Send the question to Earth.' },
      { id: 'd3', role: 'equipment', text: 'Bring the oxygen mask set and the pulse oximeter to the medical lead.', why: 'The approved card needs them for the next steps.', equipment: ['o2-mask', 'pulse-ox'], verify: 'confirm', ifCannot: 'Use the portable breathing apparatus, the approved alternative, and report it.' },
      { id: 'd4', role: 'lead', when: { step: 'd2', answer: 'yes' }, after: ['d2', 'd3'], text: 'Follow the treatment section of the approved decompression card. Do not improvise pressure changes.', why: 'Pressure treatment must follow the approved card for this vehicle.', equipment: ['pressure'], verify: 'clinical', ifCannot: 'Stop, keep monitoring and escalate to Earth.' },
      { id: 'd5', role: 'monitor', after: ['d1'], text: 'Reassess and record symptoms on the timeline every 15 minutes.', why: 'The card needs repeated observations to judge progress.', verify: 'confirm', ifCannot: 'Ask another crew member to take over monitoring.' },
      { id: 'd6', role: 'earth', text: 'Send the report to the flight surgeon and watch for replies.', why: 'Earth reviews the case; the crew does not wait for the reply.', verify: 'confirm', ifCannot: 'Queue it; CHIRON sends it when the link returns.' },
    ],
    escalation: ['Symptoms worsen after treatment starts', 'Loss of consciousness or new weakness'],
    monitoring: ['Symptoms every 15 minutes (demo interval)', 'Oxygen saturation'],
  },
  {
    id: 'DEMO-DCS-01', title: 'Suspected decompression sickness after EVA', category: 'dcs', version: '1.1', status: 'superseded', source: DEMO,
    missions: ['iss'], equipment: [], qualifications: {}, steps: [], escalation: [], monitoring: [],
  },
  {
    id: 'DEMO-ENV-02', title: 'Breathing difficulty or cabin air hazard', category: 'respiratory', version: '2.0', status: 'approved', source: DEMO,
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'pba', quantity: 1 }, { itemId: 'pulse-ox', quantity: 1 }, { itemId: 'co2-monitor', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'] },
    steps: [
      { id: 'e1', role: 'lead', text: 'Check whether this affects one person or the whole cabin.', why: 'A cabin hazard needs everyone protected before anyone is treated.', ask: { question: 'Are others affected, or is a cabin air alarm active?' }, ifCannot: 'Treat it as a cabin hazard to be safe.' },
      { id: 'e2', role: 'lead', when: { step: 'e1', answer: 'yes' }, text: 'Everyone puts on a breathing apparatus and moves to the safest module.', why: 'Protect the whole crew first.', equipment: ['pba'], verify: 'confirm', ifCannot: 'Move to the module with the best air readings shown here.' },
      { id: 'e3', role: 'lead', when: { step: 'e1', answer: 'no' }, text: 'Move the affected crew member to the module with the best air readings.', why: 'Rules out the cabin air as the cause.', verify: 'confirm', ifCannot: 'Stay put and fit a breathing apparatus.' },
      { id: 'e4', role: 'monitor', after: ['e2', 'e3'], text: 'Measure blood oxygen with the pulse oximeter and record it.', why: 'The approved card branches on this reading.', equipment: ['pulse-ox'], verify: 'confirm', ifCannot: 'Record "not measured" and tell the medical lead.' },
      { id: 'e5', role: 'equipment', text: 'Take the portable CO2 monitor to the affected module and report the reading.', why: 'Confirms or rules out a cabin air problem.', equipment: ['co2-monitor'], verify: 'confirm', ifCannot: 'Use the module readings shown in this screen.' },
      { id: 'e6', role: 'lead', after: ['e4', 'e5'], text: 'Follow the approved respiratory card for the next steps.', why: 'Clinical steps come from the approved card only.', verify: 'clinical', ifCannot: 'Escalate to Earth and keep monitoring.' },
      { id: 'e7', role: 'earth', text: 'Send the report, with the cabin readings, to Earth.', why: 'Mission control can check the life support data too.', verify: 'confirm', ifCannot: 'Queue it for the next link.' },
    ],
    escalation: ['Blood oxygen keeps falling', 'More crew become unwell'],
    monitoring: ['Blood oxygen every 5 minutes (demo interval)', 'Cabin CO2 and O2'],
  },
  {
    id: 'DEMO-ANA-03', title: 'Severe allergic reaction', category: 'anaphylaxis', version: '1.0', status: 'approved', source: DEMO,
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'anaph-kit', quantity: 1 }, { itemId: 'pulse-ox', quantity: 1 }, { itemId: 'bp-monitor', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'] },
    steps: [
      { id: 'a1', role: 'lead', text: "Check the crew member's recorded allergies, shown on this screen.", why: 'A known allergy helps the flight surgeon and the approved card.', verify: 'confirm', ifCannot: 'Record "allergy history not checked".' },
      { id: 'a2', role: 'lead', text: 'Check breathing and the face and throat.', why: 'The approved card branches on this answer.', ask: { question: 'Is breathing difficult, or is the face or throat swelling?' }, after: ['a1'], ifCannot: 'Assume yes and continue.' },
      { id: 'a3', role: 'equipment', text: 'Bring the anaphylaxis kit to the medical lead now.', why: 'The approved card needs it immediately.', equipment: ['anaph-kit'], verify: 'confirm', ifCannot: 'Tell the lead at once; CHIRON escalates to Earth.' },
      { id: 'a4', role: 'lead', when: { step: 'a2', answer: 'yes' }, after: ['a2', 'a3'], text: 'Follow the medication section of the approved anaphylaxis card. CHIRON does not give doses.', why: 'Medicine and doses come only from the approved card or a flight surgeon.', verify: 'clinical', ifCannot: 'Escalate to Earth immediately.' },
      { id: 'a5', role: 'monitor', after: ['a2'], text: 'Record breathing, pulse and skin every 5 minutes.', why: 'Reactions can return after improving.', equipment: ['pulse-ox', 'bp-monitor'], verify: 'confirm', ifCannot: 'Ask another crew member to monitor.' },
      { id: 'a6', role: 'earth', text: 'Send the report to the flight surgeon.', why: 'Earth decides on follow-up care.', verify: 'confirm', ifCannot: 'Queue it for the next link.' },
    ],
    escalation: ['Breathing gets worse', 'Symptoms return after improving'],
    monitoring: ['Breathing, pulse and skin every 5 minutes (demo interval)'],
  },
  {
    id: 'DEMO-BHP-04', title: 'Acute distress, panic or disorientation', category: 'behavioral', version: '1.0', status: 'approved', source: DEMO,
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'bh-kit', quantity: 1 }], qualifications: {}, steps: [],
    escalation: ['Chest pain, fainting or trouble breathing: switch to a physical emergency', 'Confusion or unsafe behaviour', 'Any thought of self-harm'],
    monitoring: ['Follow-up check-in within 24 hours (demo)'],
  },
];
