import type { SystemId } from '../types';

// THE MISSION MEDICAL LIBRARY
// One entry per health problem. CHIRON's advice is looked up here, never made up on the spot.
// The crew can read the library but not change it. Only Mission Control (Earth) can send a
// new version (see EarthConsole), and every change keeps its version, date and approver.
//
// CONTENT STATUS: written for this prototype from public NASA material listed in `basis`.
// It is general, conservative self-care and escalation guidance. It contains NO medication
// doses and NO diagnoses: medicine decisions stay with the medical officer or flight surgeon.
// A real mission would load the program's approved medical checklist here instead.

export interface Source { label: string; url: string }

export const SOURCES = {
  medOps: { label: 'NASA-STD-3001 Vol. 1, §6 Medical Operations', url: 'https://www.nasa.gov/reference/6-0-medical-operations/' },
  std3001: { label: 'NASA-STD-3001 Vol. 1 (crew health standard)', url: 'https://www.nasa.gov/reference/nasa-std-3001v1/' },
  hrpRisks: { label: 'NASA Human Research Program: human spaceflight risks', url: 'https://www.nasa.gov/hrp/risks/' },
  inFlight: { label: 'NASA OCHMO: in-flight medical care', url: 'https://www.nasa.gov/ochmo/health-and-medical-systems/in-flight-medical-care/' },
  imm: { label: 'NASA Integrated Medical Model', url: 'https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/' },
  eimo: { label: 'NASA Earth-independent medical operations concept (NTRS 20250000009)', url: 'https://ntrs.nasa.gov/citations/20250000009' },
  csaRadiation: { label: 'Canadian Space Agency: monitoring astronaut radiation', url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp' },
} satisfies Record<string, Source>;

export type Direction = 'high' | 'low';

export interface PersonalRule {
  match: string[];      // words looked for in the person's medical history, allergies or medications
  note: string;         // extra advice for that person
}

export interface LibraryEntry {
  id: string;
  title: string;
  system: SystemId;
  version: string;
  updated: string;        // date of this version
  approvedBy: string;     // who released it (simulated in the prototype)
  triggers: { readings?: { id: string; direction: Direction }[]; symptoms?: string[] };
  summary: string;        // what is going on, in plain words
  doNow: string[];        // steps the astronaut can take themselves
  getHelpNow: string[];   // warning signs: start an emergency
  personal?: PersonalRule[];
  equipment?: string[];   // medical stock item ids (emergency/data.ts)
  guide?: string;         // step-by-step Teach procedure id
  reasoning: string;      // why these steps make sense
  basis: { claim: string; source: Source }[];
}

const RELEASE = { version: '1.0', updated: '2026-11-14', approvedBy: 'Mission Control medical team (simulated)' };

export const LIBRARY: LibraryEntry[] = [
  {
    id: 'LIB-SLEEP', title: 'Short or broken sleep', system: 'sleep', ...RELEASE,
    triggers: { readings: [{ id: 'sleep_h', direction: 'low' }, { id: 'wakeups', direction: 'high' }, { id: 'reaction', direction: 'high' }] },
    summary: 'Sleep in space is often shorter and more broken: there is no normal day and night, the cabin is noisy, and work runs late. Short sleep slows reactions before you notice it.',
    doNow: [
      'Protect a full sleep period tonight (NASA plans 8.5 hours) at the same time as usual.',
      'Use earplugs and an eye mask, and check the airflow at your sleep station.',
      'Bright light after waking, dim light and no screens for the hour before sleep.',
      'No caffeine in the last 6 hours before sleep.',
      'Avoid critical or risky tasks while you are tired; tell the commander so the schedule can change.',
    ],
    getHelpNow: ['You fall asleep or make errors during a critical task', 'Confusion or slurred speech'],
    personal: [{ match: ['insomnia', 'sleep disorder'], note: 'Your record lists a sleep problem. Tell the medical officer early rather than waiting a few nights.' }],
    reasoning: 'NASA treats sleep loss and a shifted body clock as a mission risk because they reduce alertness and performance. Fixing sleep timing, light and noise are the first steps NASA lists before any medicine.',
    basis: [
      { claim: 'Crew schedules include a recommended 8.5-hour sleep period, avoid critical tasks during the body-clock low point, and use light, naps and other countermeasures.', source: SOURCES.medOps },
      { claim: 'Sleep loss, circadian desynchronization and work overload are tracked NASA spaceflight risks.', source: SOURCES.hrpRisks },
    ],
  },
  {
    id: 'LIB-MOOD', title: 'Low mood or stress', system: 'mind', ...RELEASE,
    triggers: { readings: [{ id: 'mood', direction: 'low' }, { id: 'spatial', direction: 'low' }] },
    summary: 'Long isolation, a small shared space and being far from home can wear mood down, often after the middle of a mission. It is common and it is treatable.',
    doNow: [
      'Talk to a crewmate you trust today.',
      'Keep your exercise sessions: they help mood as well as muscles.',
      'Contact family or friends, or open saved messages from home.',
      'Ask for a private psychological conference (PPC) with the behavioral health team: it is private and routine.',
    ],
    getHelpNow: ['Any thought of harming yourself', 'You cannot do your work or look after yourself', 'Confusion or behaviour that is unsafe'],
    reasoning: 'NASA requires routine private psychological conferences and support programs because behavioral health problems affect safety and teamwork. Early talking support is the first step.',
    basis: [
      { claim: 'Private psychological conferences are scheduled routinely and are treated as private communication.', source: SOURCES.medOps },
      { claim: 'Adverse cognitive or behavioral conditions are a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks },
    ],
  },
  {
    id: 'LIB-HEART', title: 'Heart rate or blood pressure outside your normal', system: 'cardiovascular', ...RELEASE,
    triggers: { readings: [
      { id: 'hr', direction: 'high' }, { id: 'hr', direction: 'low' }, { id: 'hrv', direction: 'low' },
      { id: 'bp_sys', direction: 'high' }, { id: 'bp_sys', direction: 'low' },
    ] },
    summary: 'In weightlessness, fluid moves toward the head and the heart works differently. Stress, poor sleep, dehydration or illness can also change heart rate and blood pressure.',
    doNow: [
      'Rest for 5 minutes, then measure again the same way (use the guide).',
      'Drink water, and think about caffeine, sleep and exercise today.',
      'If it is still outside your normal tomorrow morning, record it and tell the medical officer.',
    ],
    getHelpNow: ['Chest pain or pressure', 'Fainting or nearly fainting', 'Shortness of breath at rest', 'A racing or irregular heartbeat that does not settle'],
    personal: [
      { match: ['hypertension', 'high blood pressure'], note: 'Your record lists high blood pressure. Report a high reading today, not tomorrow.' },
      { match: ['arrhythmia', 'palpitation'], note: 'Your record lists heart rhythm problems. Report any racing or irregular beat straight away.' },
    ],
    equipment: ['bp-monitor', 'ecg'],
    guide: 'resting-heart-rate',
    reasoning: 'One reading can be wrong. Repeating it at rest removes the most common causes (movement, stress, caffeine). Warning signs are listed separately because they need help at once.',
    basis: [
      { claim: 'Cardiovascular adaptation and orthostatic intolerance are tracked NASA spaceflight risks.', source: SOURCES.hrpRisks },
      { claim: 'In-flight medical care relies on trained crew, onboard monitoring equipment and ground flight surgeons.', source: SOURCES.inFlight },
    ],
  },
  {
    id: 'LIB-BREATH', title: 'Low blood oxygen or fast breathing', system: 'cardiovascular', ...RELEASE,
    triggers: { readings: [{ id: 'spo2', direction: 'low' }, { id: 'resp', direction: 'high' }] },
    summary: 'Low oxygen readings can come from the sensor, from the cabin air, or from the lungs. Check the simple causes first, quickly.',
    doNow: [
      'Warm your hand and measure again on a different finger.',
      'Check the cabin CO₂ and oxygen readings for your module.',
      'If the cabin air reading is high, move to another module and tell the crew.',
    ],
    getHelpNow: ['Oxygen stays low on a second reading', 'Breathless at rest or cannot speak in full sentences', 'Blue lips or confusion', 'Several crew feel unwell at once (possible air problem)'],
    personal: [{ match: ['asthma'], note: 'Your record lists asthma. Follow the personal asthma plan from your pre-flight medical team and tell the medical officer.' }],
    equipment: ['pulse-ox', 'o2-mask', 'pba'],
    reasoning: 'Sensor errors are common, so a second reading comes first. Cabin air problems can affect everyone, so they are checked before assuming an illness.',
    basis: [
      { claim: 'NASA-STD-3001 sets limits for cabin air, including carbon dioxide.', source: SOURCES.std3001 },
      { claim: 'In-flight medical care relies on onboard monitoring equipment and ground flight surgeons.', source: SOURCES.inFlight },
    ],
  },
  {
    id: 'LIB-HEADACHE', title: 'Headache', system: 'sensorimotor', ...RELEASE,
    triggers: { symptoms: ['Headache'] },
    summary: 'Headaches are common in space. Fluid moving toward the head, higher cabin CO₂, poor sleep and not drinking enough are frequent causes.',
    doNow: [
      'Check the cabin CO₂ reading. If it is high, tell the crew and move to fresher air.',
      'Drink water and rest your eyes.',
      'Protect your next sleep period.',
      'Ask the medical officer before taking any medicine from the kit, and check it against your allergies.',
    ],
    getHelpNow: ['Worst headache of your life, or it started suddenly', 'Headache after hitting your head', 'Confusion, weakness, or vision changes', 'Fever with a stiff neck'],
    personal: [{ match: ['migraine'], note: 'Your record lists migraine. If this feels like your usual migraine, follow your pre-flight migraine plan. If it feels different, tell the medical officer.' }],
    reasoning: 'The common space causes (CO₂, fluids, sleep) are easy to check and fix. Sudden or unusual headaches are listed as warning signs because they can be serious.',
    basis: [
      { claim: 'NASA-STD-3001 sets cabin carbon dioxide limits to protect crew health.', source: SOURCES.std3001 },
      { claim: 'Spaceflight changes to the head and eyes (SANS) are a tracked NASA risk.', source: SOURCES.hrpRisks },
    ],
  },
  {
    id: 'LIB-MOTION', title: 'Dizziness, nausea or balance problems', system: 'sensorimotor', ...RELEASE,
    triggers: {
      readings: [{ id: 'dizziness', direction: 'high' }, { id: 'nausea', direction: 'high' }, { id: 'balance', direction: 'low' }, { id: 'coordination', direction: 'low' }],
      symptoms: ['Dizziness', 'Nausea'],
    },
    summary: 'The inner ear has to adapt every time gravity changes. Space motion sickness is common in the first days and after landings, and usually fades.',
    doNow: [
      'Keep your head still and avoid fast head turns.',
      'Keep a fixed "up": look at a wall or a window with a clear horizon.',
      'Small sips of water and small, plain meals.',
      'Hold on when moving between modules and avoid fine, risky tasks for now.',
      'Anti-nausea medicine is in the medical kit: the medical officer decides if you take it.',
    ],
    getHelpNow: ['Vomiting again and again, or cannot keep water down', 'Dizziness with chest pain, fainting or a severe headache', 'Weakness or numbness on one side'],
    personal: [{ match: ['motion sickness'], note: 'Your record lists motion sickness in training. You may need the medical officer’s help earlier than others.' }],
    reasoning: 'Limiting head movement reduces the mixed signals between eyes and inner ear that cause motion sickness. Fluids matter because vomiting quickly dehydrates you in space.',
    basis: [{ claim: 'Altered sensorimotor and vestibular function is a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks }],
  },
  {
    id: 'LIB-BONE', title: 'Bone loss and kidney stone risk', system: 'musculoskeletal', ...RELEASE,
    triggers: { readings: [{ id: 'calcium', direction: 'high' }] },
    summary: 'Without gravity your bones carry no load and release calcium. More calcium in the urine means bone is being lost, and it also raises the chance of kidney stones.',
    doNow: [
      'Do every resistance exercise session in your plan: loading the bones is the main protection.',
      'Drink extra water through the day to dilute the urine.',
      'Keep to your planned diet; do not add calcium supplements unless the medical team says so.',
    ],
    getHelpNow: ['Sudden severe pain in the side or back, often coming in waves', 'Blood in the urine', 'Pain with fever'],
    personal: [{ match: ['kidney stone', 'renal'], note: 'You have had a kidney stone before, so your risk is higher. Drink extra water and tell the medical officer today.' }],
    reasoning: 'Exercise slows bone loss, and more fluid lowers the chance of stones forming. The warning signs are typical of a kidney stone, which needs medical help.',
    basis: [
      { claim: 'Bone loss and renal (kidney) stone formation are tracked NASA spaceflight risks.', source: SOURCES.hrpRisks },
      { claim: 'NASA medical operations include countermeasures and monitoring throughout the mission.', source: SOURCES.medOps },
    ],
  },
  {
    id: 'LIB-MUSCLE', title: 'Muscle weakness or missed exercise', system: 'musculoskeletal', ...RELEASE,
    triggers: { readings: [{ id: 'endurance', direction: 'low' }, { id: 'emg', direction: 'low' }, { id: 'activity', direction: 'low' }] },
    summary: 'Without gravity, muscles are barely used and shrink, especially in the legs and back. You need them strong for landing and for any emergency.',
    doNow: [
      'Complete your planned resistance and aerobic exercise sessions and log them.',
      'If something stops you exercising (pain, schedule, equipment), tell the commander so it can be fixed.',
      'Repeat the weekly strength test as planned.',
    ],
    getHelpNow: ['Sudden pain or a pop during exercise', 'Swelling or pain in one leg', 'Weakness that comes on suddenly'],
    reasoning: 'Exercise is NASA’s main countermeasure against muscle loss. Sudden weakness is different from slow loss and needs checking.',
    basis: [{ claim: 'Reduced muscle size, strength and endurance is a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks }],
  },
  {
    id: 'LIB-BACK', title: 'Back pain', system: 'musculoskeletal', ...RELEASE,
    triggers: { symptoms: ['Back pain'] },
    summary: 'Without gravity, the spine lengthens a little. This often causes lower back pain, especially in the first weeks of a mission.',
    doNow: [
      'Curl into a knees-to-chest position for a few minutes: it often eases the pain.',
      'Gentle stretching, and use foot restraints to brace when working.',
      'Ask the medical officer before taking any pain medicine from the kit.',
    ],
    getHelpNow: ['Numbness or weakness in the legs', 'Loss of bladder or bowel control', 'Pain after a fall or a hard impact', 'Pain with fever'],
    reasoning: 'Curling up shortens the spine again, which relieves the stretched tissues. The warning signs can mean a nerve is being pressed and need help at once.',
    basis: [{ claim: 'Spinal and intervertebral disc changes are tracked NASA spaceflight risks.', source: SOURCES.hrpRisks }],
  },
  {
    id: 'LIB-SKIN', title: 'Rash, itchy skin or a small wound', system: 'immune', ...RELEASE,
    triggers: { symptoms: ['Rash', 'Itchy skin', 'Cut or graze'] },
    summary: 'Skin problems are among the most common complaints in space. Cabin air is dry, washing is limited, and small wounds can heal more slowly.',
    doNow: [
      'Keep the area clean and dry. Use the skin wipes from the hygiene kit.',
      'Do not scratch. Cover a cut or graze with a clean dressing from the medical kit.',
      'Think about what is new: gloves, wipes, clothing, food. Stop using it and tell the medical officer.',
      'Ask the medical officer before using any cream or medicine from the kit.',
    ],
    getHelpNow: ['Swelling of the lips, face or throat, or trouble breathing', 'A rash that spreads fast or comes with fever', 'A wound that is red, hot, swollen or leaking', 'Bleeding that does not stop with firm pressure'],
    personal: [{ match: ['latex'], note: 'Your record shows a latex allergy: use only the latex-free gloves and dressings.' }],
    reasoning: 'Keeping skin clean and covered lowers the chance of infection while the immune system is under spaceflight stress. Swelling with breathing trouble can be a severe allergic reaction and needs help at once.',
    basis: [
      { claim: 'Immune changes in spaceflight are a tracked NASA risk, which makes infection of small wounds more likely.', source: SOURCES.hrpRisks },
      { claim: 'In-flight medical care covers common minor conditions with the onboard medical kit.', source: SOURCES.inFlight },
    ],
  },
  {
    id: 'LIB-EYES', title: 'Vision changes or eye strain', system: 'sensorimotor', ...RELEASE,
    triggers: { readings: [{ id: 'vision', direction: 'low' }], symptoms: ['Eye strain'] },
    summary: 'In space, fluid moving toward the head can slowly change the shape of the eye (called SANS). Tired eyes from screens are also common. Any change in sight should be recorded.',
    doNow: [
      'Rest your eyes: every 20 minutes, look at something far away for 20 seconds.',
      'Record any change in how well you see, near or far, in CHIRON.',
      'Tell the medical officer about vision changes: they may schedule an eye exam with the onboard equipment.',
    ],
    getHelpNow: ['Sudden loss of vision, in one or both eyes', 'Eye pain with redness', 'Flashes of light or a curtain over your vision'],
    reasoning: 'SANS develops slowly and is tracked with regular eye checks, so early recording helps. Sudden vision loss is different and urgent.',
    basis: [{ claim: 'Spaceflight Associated Neuro-ocular Syndrome (SANS) is a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks }],
  },
  {
    id: 'LIB-INFECTION', title: 'Raised temperature or inflammation', system: 'immune', ...RELEASE,
    triggers: { readings: [{ id: 'temp', direction: 'high' }, { id: 'temp', direction: 'low' }, { id: 'crp', direction: 'high' }], symptoms: ['Congestion'] },
    summary: 'The immune system changes in space, and in a closed cabin an infection can spread to the whole crew. A rise in temperature or inflammation can be the first sign.',
    doNow: [
      'Measure your temperature again in one hour (use the guide).',
      'Rest, drink water, and wash or sanitise your hands often.',
      'Keep some distance: eat separately and wipe shared surfaces if you can.',
      'Tell the medical officer today. Any antibiotic must be checked against your allergies.',
    ],
    getHelpNow: ['Temperature keeps rising or you shake with chills', 'Stiff neck, rash, or confusion', 'Trouble breathing', 'More than one crew member is ill'],
    personal: [{ match: ['penicillin'], note: 'Penicillin allergy on your record: penicillin-type antibiotics must not be used. The medical officer must check every antibiotic.' }],
    guide: 'temperature',
    reasoning: 'A repeat reading confirms the change. Hygiene and distance protect the rest of the crew, and early reporting gives Earth time to advise despite the delay.',
    basis: [
      { claim: 'Altered immune response is a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks },
      { claim: 'In-flight medical care relies on the onboard kit, trained crew and ground flight surgeons.', source: SOURCES.inFlight },
    ],
  },
  {
    id: 'LIB-SUGAR', title: 'Blood sugar outside your normal', system: 'metabolic', ...RELEASE,
    triggers: { readings: [{ id: 'glucose', direction: 'high' }, { id: 'glucose', direction: 'low' }] },
    summary: 'Less movement, stress and poor sleep can change how the body handles sugar. Low blood sugar can make you shaky and slow.',
    doNow: [
      'If LOW and you feel shaky or weak: eat or drink something sugary now, then measure again in 15 minutes.',
      'If HIGH: measure again tomorrow before breakfast, and keep your exercise sessions.',
      'Record what you ate and how you slept.',
    ],
    getHelpNow: ['Confusion, or shaking that does not improve after eating', 'Fainting', 'Very high reading with vomiting or fast breathing'],
    personal: [{ match: ['diabetes', 'insulin'], note: 'Your record lists a blood sugar condition. Follow your personal plan and tell the medical officer today.' }],
    guide: 'blood-sugar',
    reasoning: 'Fast sugar is the standard first step for low blood sugar. A high single reading is rechecked fasting before anything else.',
    basis: [{ claim: 'Medical conditions that occur during a mission are modelled and planned for by NASA.', source: SOURCES.imm }],
  },
  {
    id: 'LIB-RADIATION', title: 'Higher radiation dose', system: 'radiation', ...RELEASE,
    triggers: { readings: [{ id: 'dose', direction: 'high' }] },
    summary: 'Outside Earth’s protection, radiation adds up over the whole mission. During a solar storm it can rise quickly.',
    doNow: [
      'If Mission Control announces a solar event, go to the shielded area as the mission procedure says.',
      'Keep your personal dosimeter on you.',
      'Review your dose trend with the medical officer.',
    ],
    getHelpNow: ['A solar particle event alarm', 'Nausea and vomiting soon after a high dose reading'],
    reasoning: 'Shielding and limiting time exposed are the protections available on board. Dose is tracked because the risk adds up over a career.',
    basis: [
      { claim: 'Radiation exposure is a tracked NASA spaceflight risk.', source: SOURCES.hrpRisks },
      { claim: 'Astronauts wear dosimeters to monitor their radiation exposure.', source: SOURCES.csaRadiation },
    ],
  },
];

// Applies when no medical officer can help: they are busy, asleep, or they are the patient.
export const NO_MEDICAL_OFFICER = {
  reasoning: 'On deep-space missions Earth may be minutes away, so the crew must be able to act alone using the onboard library.',
  basis: { claim: 'NASA’s Earth-independent medical operations concept supports the crew medical officer when ground support is delayed or unavailable.', source: SOURCES.eimo },
};
