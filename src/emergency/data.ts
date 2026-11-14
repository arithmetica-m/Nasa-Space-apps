import type { MissionId } from '../types';
import type { CrewMember, InventoryItem, Procedure } from './types';

// ALL DATA IN THIS FILE IS SIMULATED FOR THE PROTOTYPE.
// Procedures are demo records: they show the structure CHIRON needs (version, approval,
// equipment, roles, branches, escalation) but are not clinical guidance. Clinical steps
// direct the crew to mission-authorized instructions and qualified medical personnel.

export const crew: CrewMember[] = [
  { id: 'ana', name: 'Ana Rocha', position: 'Flight engineer · Crew Medical Officer', qualifications: ['cmo', 'life-support', 'eva'], available: true,
    medical: { allergies: ['Penicillin (simulated)'], conditions: [], history: ['Migraine, well controlled (simulated)'], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'lena', name: 'Lena Sørensen', position: 'Flight engineer · backup Crew Medical Officer', qualifications: ['cmo-backup', 'life-support', 'eva'], available: true,
    medical: { allergies: [], conditions: [], history: ['Mild asthma in childhood (simulated)'], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'kai', name: 'Kai Mensah', position: 'Commander', qualifications: ['life-support', 'eva', 'comms'], available: true,
    medical: { allergies: ['Latex (simulated)'], conditions: [], history: ['Kidney stone, 2019 (simulated)'], notes: 'Baseline from pre-flight exam (simulated).' } },
  { id: 'ravi', name: 'Ravi Iyer', position: 'Mission specialist', qualifications: ['life-support', 'comms', 'peer-support'], available: true,
    medical: { allergies: [], conditions: [], history: ['Motion sickness during training (simulated)'], notes: 'Baseline from pre-flight exam (simulated).' } },
];

const base: Omit<InventoryItem, 'log'>[] = [
  { id: 'o2-mask', name: 'Oxygen mask set', category: 'protective', quantity: 3, location: 'Medical bay, drawer M2', status: 'available' },
  { id: 'pba', name: 'Portable breathing apparatus', category: 'protective', quantity: 4, location: 'Beside each module hatch', status: 'available' },
  { id: 'pulse-ox', name: 'Pulse oximeter', category: 'diagnostic', quantity: 2, location: 'Medical bay, kit A', status: 'available' },
  { id: 'bp-monitor', name: 'Blood pressure monitor', category: 'diagnostic', quantity: 1, location: 'Medical bay, wall mount', status: 'available' },
  { id: 'ecg', name: 'ECG unit', category: 'diagnostic', quantity: 1, location: 'Medical bay, cabinet M1', status: 'available' },
  { id: 'anaph-kit', name: 'Anaphylaxis kit (contents per mission formulary)', category: 'medication', quantity: 2, location: 'Medical bay, drawer M1', expires: '2027-06-30', storage: 'Room temperature, away from light', status: 'available' },
  { id: 'restraint', name: 'Patient restraint board', category: 'equipment', quantity: 1, location: 'Medical bay, wall stowage', status: 'available' },
  { id: 'pressure', name: 'Suit and airlock pressurisation (treatment capability)', category: 'equipment', quantity: 1, location: 'Airlock', status: 'available' },
  { id: 'bh-kit', name: 'Private support kit (headset, private channel)', category: 'behavioral', quantity: 1, location: 'Crew quarters, locker Q1', status: 'available' },
];

// Mission-specific differences, so the same emergency meets different constraints.
const overrides: Partial<Record<MissionId, Partial<Record<string, Partial<InventoryItem>>>>> = {
  moon: { 'anaph-kit': { quantity: 1, status: 'unverified' }, pressure: { status: 'unverified' }, ecg: { quantity: 0, status: 'depleted' } },
  'mars-transit': { 'anaph-kit': { quantity: 1 }, 'o2-mask': { quantity: 1, status: 'damaged' } },
};

export function inventoryFor(mission: MissionId): InventoryItem[] {
  return base.map((i) => ({ ...i, ...(overrides[mission]?.[i.id] ?? {}), log: [{ time: 'Pre-launch', by: 'Manifest import', change: 'Loaded from simulated manifest' }] }));
}

const TRAINING_SCENARIO = { name: 'Hypothetical CHIRON training scenario · NASA research-informed · not NASA-approved' };

export const procedures: Procedure[] = [
  {
    id: 'TRAINING-DCS-01', title: 'Suspected decompression sickness after EVA', category: 'dcs', version: '1.0', status: 'approved', source: TRAINING_SCENARIO,
    measurements: [
      { key: 'symptoms', label: 'Symptoms and where they are (for example joint pain, tingling)', source: 'manual' },
      { key: 'eva_end', label: 'Time the EVA ended', source: 'manual' },
      { key: 'spo2', label: 'Blood oxygen', unit: '%', source: 'link' },
      { key: 'hr', label: 'Heart rate', unit: 'bpm', source: 'link' },
      { key: 'bp', label: 'Blood pressure', unit: 'mmHg', source: 'manual' },
    ],
    missions: ['iss', 'moon', 'mars-surface'],
    equipment: [{ itemId: 'o2-mask', quantity: 1, alternatives: ['pba'] }, { itemId: 'pulse-ox', quantity: 1 }, { itemId: 'pressure', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'], equipment: ['eva'] },
    steps: [
      { id: 'dcs-01', role: 'lead', text: 'Confirm the crew member’s identity and ask them to describe what they are experiencing.', why: 'A clear report helps the crew and medical team coordinate.', verify: 'confirm', ifCannot: 'Record that the crew member could not provide a report.' },
      { id: 'dcs-02', role: 'lead', text: 'Record when the concern began and whether it followed an EVA.', why: 'Timing and recent activities provide context for the medical team.', ask: { question: 'Did the concern begin during or after an EVA?' }, after: ['dcs-01'], ifCannot: 'Record that the timing is unknown.' },
      { id: 'dcs-03', role: 'equipment', text: 'Bring the mission medical assessment kit to the response lead.', why: 'The lead can use mission-authorized instructions and equipment.', equipment: ['pulse-ox'], verify: 'confirm', ifCannot: 'Tell the response lead that the kit is unavailable.' },
      { id: 'dcs-04', role: 'monitor', after: ['dcs-01'], text: 'Record the crew member’s reported symptoms and any measurements requested by the medical lead.', why: 'The medical team needs a time-stamped record, not an automated interpretation.', verify: 'confirm', ifCannot: 'Record which information could not be collected.' },
      { id: 'dcs-05', role: 'lead', after: ['dcs-02', 'dcs-03'], text: 'Choose the treatment with the medical lead, using the mission medical checklist. If nobody knows what to do, follow the treatment steps in the CHIRON medical library.', why: 'Treatment is chosen by people, with CHIRON’s library as the guide when no one is sure.', verify: 'clinical', ifCannot: 'Contact the flight surgeon for direction.' },
      { id: 'dcs-06', role: 'earth', text: 'Send the event summary and recorded observations to the flight surgeon.', why: 'Mission Control medical staff need the crew’s report.', verify: 'confirm', ifCannot: 'Queue the report until the communication link returns.' },
    ],
    escalation: ['Symptoms worsen after treatment starts', 'Loss of consciousness or new weakness'],
    monitoring: ['Symptoms every 15 minutes (demo interval)', 'Oxygen saturation'],
  },
  {
    id: 'TRAINING-DCS-01', title: 'Suspected decompression sickness after EVA', category: 'dcs', version: '0.9', status: 'superseded', source: TRAINING_SCENARIO,
    missions: ['iss'], equipment: [], qualifications: {}, steps: [], escalation: [], monitoring: [],
  },
  {
    id: 'TRAINING-RESP-02', title: 'Breathing difficulty or cabin air problem', category: 'respiratory', version: '1.0', status: 'approved', source: TRAINING_SCENARIO,
    measurements: [
      { key: 'spo2', label: 'Blood oxygen', unit: '%', source: 'link' },
      { key: 'resp', label: 'Breathing rate', unit: 'breaths/min', source: 'manual' },
      { key: 'hr', label: 'Heart rate', unit: 'bpm', source: 'link' },
      { key: 'co2', label: 'Cabin CO₂ reading in this module', unit: 'mmHg', source: 'manual' },
    ],
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'pulse-ox', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'] },
    steps: [
      { id: 'resp-01', role: 'lead', text: 'Confirm who is affected and ask them to describe the breathing concern.', why: 'A direct crew report gives the medical lead useful context.', ask: { question: 'Is the crew member able to speak comfortably?' }, ifCannot: 'Record that the crew member cannot provide a report and contact the medical lead.' },
      { id: 'resp-02', role: 'equipment', text: 'Bring the mission pulse oximeter to the response lead if requested.', why: 'The medical lead decides whether a measurement is needed.', equipment: ['pulse-ox'], verify: 'confirm', ifCannot: 'Tell the response lead the device is unavailable.' },
      { id: 'resp-03', role: 'monitor', after: ['resp-01'], text: 'Record the crew member’s report and any measurements requested by the medical lead.', why: 'Time-stamped observations help Mission Control follow the event.', verify: 'confirm', ifCannot: 'Record what could not be measured.' },
      { id: 'resp-04', role: 'lead', after: ['resp-01', 'resp-02'], text: 'Choose the treatment with the medical lead, using the respiratory checklist. If nobody knows what to do, follow the breathing steps in the CHIRON medical library.', why: 'Treatment is chosen by people, with CHIRON’s library as the guide when no one is sure.', verify: 'clinical', ifCannot: 'Contact the flight surgeon for direction.' },
      { id: 'resp-05', role: 'earth', text: 'Send the event summary and recorded observations to the flight surgeon.', why: 'Mission Control medical staff need the crew’s report.', verify: 'confirm', ifCannot: 'Queue the report until the communication link returns.' },
    ],
    escalation: ['The crew member reports a worsening condition', 'Additional crew request medical support'],
    monitoring: ['Record updates requested by the medical lead'],
  },
  {
    id: 'TRAINING-ALLERGY-03', title: 'Severe allergic reaction', category: 'anaphylaxis', version: '1.0', status: 'approved', source: TRAINING_SCENARIO,
    measurements: [
      { key: 'exposure', label: 'What they were exposed to, and when', source: 'manual' },
      { key: 'swelling', label: 'Swelling or rash: where?', source: 'manual' },
      { key: 'spo2', label: 'Blood oxygen', unit: '%', source: 'link' },
      { key: 'hr', label: 'Heart rate', unit: 'bpm', source: 'link' },
      { key: 'bp', label: 'Blood pressure', unit: 'mmHg', source: 'manual' },
    ],
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'anaph-kit', quantity: 1 }, { itemId: 'pulse-ox', quantity: 1 }, { itemId: 'bp-monitor', quantity: 1 }],
    qualifications: { lead: ['cmo', 'cmo-backup'] },
    steps: [
      { id: 'allergy-01', role: 'lead', text: 'Ask the crew member what happened and whether they have a known allergy.', why: 'This report helps the medical lead communicate with Mission Control.', verify: 'confirm', ifCannot: 'Record that the crew member could not provide a report.' },
      { id: 'allergy-02', role: 'lead', text: 'Ask whether the crew member is having breathing difficulty or swelling.', why: 'The response team should accurately report symptoms to the medical lead.', ask: { question: 'Is breathing difficult or is swelling reported?' }, after: ['allergy-01'], ifCannot: 'Record the answer as unknown and contact the medical lead.' },
      { id: 'allergy-03', role: 'equipment', text: 'Bring the mission medical kit to the response lead; do not administer medication based on this demo.', why: 'Only mission-authorized personnel and procedures determine treatment.', equipment: ['anaph-kit'], verify: 'confirm', ifCannot: 'Tell the lead the kit is unavailable.' },
      { id: 'allergy-04', role: 'monitor', after: ['allergy-02'], text: 'Record the crew member’s reported symptoms and any observations requested by the medical lead.', why: 'Time-stamped observations support the medical report.', equipment: ['pulse-ox'], verify: 'confirm', ifCannot: 'Record what could not be collected.' },
      { id: 'allergy-05', role: 'lead', after: ['allergy-02', 'allergy-03'], text: 'Use the mission-authorized allergy response checklist and follow the flight surgeon’s direction. CHIRON provides no medication or dosing instructions.', why: 'This is a hypothetical training workflow, not a treatment protocol.', verify: 'clinical', ifCannot: 'Contact the flight surgeon for direction.' },
      { id: 'allergy-06', role: 'earth', text: 'Send the event summary and observations to the flight surgeon.', why: 'Mission Control medical staff need the crew’s report.', verify: 'confirm', ifCannot: 'Queue the report until the communication link returns.' },
    ],
    escalation: ['Breathing gets worse', 'Symptoms return after improving'],
    monitoring: ['Breathing, pulse and skin every 5 minutes (demo interval)'],
  },
  {
    id: 'TRAINING-SUPPORT-04', title: 'Acute psychological distress', category: 'behavioral', version: '1.0', status: 'approved', source: TRAINING_SCENARIO,
    missions: ['iss', 'moon', 'mars-transit', 'mars-surface'],
    equipment: [{ itemId: 'bh-kit', quantity: 1 }], qualifications: {}, steps: [],
    escalation: ['Chest pain, fainting or trouble breathing: switch to a physical emergency', 'Confusion or unsafe behaviour', 'Any thought of self-harm'],
    monitoring: ['Follow-up check-in within 24 hours (demo)'],
  },
];
