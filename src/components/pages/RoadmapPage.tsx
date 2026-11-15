import { SOURCES } from '../../library/entries';
import { PageShell, Panel } from './ui';
import { SystemMap } from '../SystemMap';
import { VisionConcept } from '../VisionConcept';
import type { Page } from '../MissionDashboard';

// ABOUT CHIRON: what works today, what is simulated, and what is a future concept. Kept honest.

const NEEDS: [string, string][] = [
  ['Personalized medicine for each crew member', 'MY HEALTH: personal baselines; advice fitted to each medical record'],
  ['Training astronauts to decide independently', 'PREPARE: practice from approved protocols, chosen from the gaps CHIRON finds; "How CHIRON got here" on every recommendation'],
  ['Computer-based medical decision support', 'Medical library + RESPOND: approved steps, measurements, equipment, crew tasks'],
  ['Fewer medical resources needed', 'RESPOND: stock planning against approved procedures'],
  ['Predicting risk from crew health and resources', 'PREPARE: readiness simulation and mission-event preparation'],
  ['Rehabilitation on long missions', 'MY HEALTH: "Back to your normal" plan built from the person’s readings and schedule'],
];

const LEVELS: { title: string; note: string; items: string[] }[] = [
  { title: 'LEVEL 1 · WORKS IN THIS PROTOTYPE', note: 'Real behaviour on simulated data.', items: [
    'CHIRON CORE home: crew, status, LINK summary; shared MISSION page', 'Protected profiles: PIN, role-based access, logged emergency access', 'Astronaut dashboards: overview, history, mission', 'Daily check-in (type, sync from device, or say it)',
    'Body map with flagged areas and plain-language advice', 'Read-only medical library; only Mission Control can change it', 'Emergency mode on every device: tasks, measurements, equipment, crew roles',
    'Response Planner overview in every emergency (seven factors)', 'Report something: symptom checker with follow-up questions', 'Automatic private reports to Earth', 'Medical stock lists', 'Recovery checklist and timelines', 'Medical log of the mission', 'Voice commands',
  ] },
  { title: 'LEVEL 2 · WORKING SIMULATIONS', note: 'The logic runs; the inputs are simulated.', items: [
    'CHIRON LINK wearables: a reading sent from a band reaches CORE, breaks a warning rule and alerts every device', 'Band location, battery, vibration patterns and emergency button (future hardware, simulated here)', 'Mission medical readiness simulation', 'Crew task suggestions with reasons, changeable by the crew',
    'Procedure handover when someone takes over', 'Medical stock planning', 'Personal training recommendations', 'Mission medical record',
  ] },
  { title: 'LEVEL 3 · FUTURE RESEARCH AND DEVELOPMENT', note: 'Not built. Concepts only.', items: [
    'Physical CHIRON LINK wearable hardware', 'CHIRON VISION: helmet or suit display showing the next approved step, the body area and the equipment (not imaging, not diagnosis)',
    'Better predictive models, validated by medical teams', 'Automated medical resource intelligence', 'Rehabilitation plans that adapt, with medical approval', 'More onboard autonomy during long communication delays',
  ] },
];

export function RoadmapPage({ onOpen }: { onOpen: (p: Page) => void }) {
  return (
    <PageShell title="ABOUT CHIRON" intro="CHIRON is a medical support system that follows astronauts through the whole mission: staying healthy, preparing, responding to emergencies and recovering. Named after the healer and teacher of Greek myth.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen('demo')} className="min-h-12 bg-gold px-5 font-mono text-xs tracking-[0.18em] text-void">▶ DEMONSTRATION</button>
        <button type="button" onClick={() => onOpen('nasa')} className="min-h-12 border border-gold/60 px-5 font-mono text-xs tracking-[0.18em] text-gold">NASA DATA IN CHIRON</button>
      </div>
      <Panel title="ONE CONNECTED SYSTEM">
        <SystemMap />
      </Panel>
      <Panel title="THE RESPONSE PLANNER: OUR MAIN IDEA">
        <p className="text-base text-marble/90">During an emergency CHIRON connects the patient’s readings and medical record, the mission phase, the equipment on board, the crew’s training and availability, and the delay to Earth into one plan that updates as things change. It shows what is known, what is missing, which approved procedure applies, who could do each task, what limits the response, and what needs medical confirmation, and it explains why. It never creates a treatment.</p>
        <p className="mt-2 text-sm text-marble/60">NASA researches many of these areas. CHIRON’s proposed contribution is bringing them together in one astronaut-facing tool.</p>
      </Panel>
      <Panel title="SIX NEEDS FROM THE NASA HUMAN RESEARCH ROADMAP">
        <ul className="divide-y divide-marble/10">{NEEDS.map(([n, c]) => <li key={n} className="grid gap-1 py-2 md:grid-cols-2"><span className="text-base text-marble">{n}</span><span className="text-sm text-marble/65">{c}</span></li>)}</ul>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {LEVELS.map((l) => (
          <Panel key={l.title} title={l.title}>
            <p className="text-sm text-marble/55">{l.note}</p>
            <ul className="mt-2 space-y-1 text-sm text-marble/85">{l.items.map((i) => <li key={i}>• {i}</li>)}</ul>
          </Panel>
        ))}
      </div>
      <Panel title="CHIRON VISION" tag="FUTURE CONCEPT">
        <VisionConcept />
        <p className="mt-2 text-base text-marble/75">A helmet or suit display for when hands are busy. It would need hardware built and tested for spaceflight: ordinary consumer AR glasses are not assumed to work on an EVA.</p>
      </Panel>
      <Panel title="WHO CAN SEE WHAT">
        <ul className="space-y-1 text-base text-marble/85">
          <li>• The shared dashboard shows general status only. Medical details are in each person’s profile, behind their PIN.</li>
          <li>• Astronaut: their own profile. Medical officers: any profile, and every opening is logged.</li>
          <li>• Commander: status, location and tasks, not medical details.</li>
          <li>• Emergency access: anyone can open a profile for 15 minutes with a reason; it is logged where the owner sees it.</li>
        </ul>
        <p className="mt-2 text-sm text-marble/50">Prototype sign-in with demo PINs, not real security.</p>
      </Panel>
      <Panel title="RULES CHIRON FOLLOWS">
        <ul className="space-y-1 text-sm text-marble/85">
          {['Every reading shows where it came from and when.', 'Simulated data is labelled SIMULATED.', 'Old data is never shown as live.', 'Missing data is shown as missing, never guessed.',
            'CHIRON guides decisions with approved information; people decide together.', 'Procedures come only from approved sources; the crew cannot change them.', 'Every recommendation can show how CHIRON reached it.'].map((r) => <li key={r}>• {r}</li>)}
        </ul>
      </Panel>
      <Panel title="SOURCES">
        <ul className="space-y-1 text-sm">{Object.values(SOURCES).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-2">{s.label}</a></li>)}</ul>
      </Panel>
    </PageShell>
  );
}
