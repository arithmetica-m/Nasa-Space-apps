import { Play } from 'lucide-react';
import type { Mission } from '../../types';
import { PageShell } from './ui';

export type DemoAction = 'prepare' | 'monitor' | 'emergency' | 'coordinate' | 'recover' | 'nasa' | 'future' | 'reset';

// THE DEMONSTRATION: one astronaut's mission, told in seven steps, each opening the real screen.
export function DemoPage({ mission, onAction }: { mission: Mission; onAction: (a: DemoAction) => void }) {
  const far = mission.id.startsWith('mars');
  const chapters: { n: number; title: string; text: string; action?: DemoAction; button?: string; show: string }[] = [
    { n: 1, title: 'THE PROBLEM', show: 'This screen',
      text: far
        ? `Ana Rocha is the medical officer on ${mission.name}, day ${mission.today}. Earth is ${mission.delayLabel} away each way, there is no evacuation, and the crew is four people. If something goes wrong, the crew must act before Earth can answer.`
        : `Ana Rocha is the medical officer on ${mission.name}. Earth is close today, but on a Mars mission it would be up to 22 minutes away each way. Switch the mission to Mars Transit in settings to see CHIRON change its advice.` },
    { n: 2, title: 'THE PREPARATION', action: 'prepare', button: 'OPEN PREPARE', show: 'PREPARE (prevent + train)',
      text: 'CHIRON knows each astronaut’s normal and plays every emergency through with this mission’s protocols, equipment and crew. Each gap becomes an action: “Ana last practised this 130 days ago → practise it now.”' },
    { n: 3, title: 'THE MONITORING', action: 'monitor', button: 'SEND A LOW OXYGEN READING FROM ANA’S BAND', show: 'CORE home: LINK warning',
      text: 'Ana’s CHIRON LINK band measures blood oxygen 89%. The reading travels to CORE, breaks the warning rule (below 94%), and every device shows a LINK WARNING. Her status becomes MEDICAL ATTENTION.' },
    { n: 4, title: 'THE EMERGENCY', action: 'emergency', button: 'START THE EMERGENCY FOR ANA', show: 'RESPOND with the Response Planner',
      text: 'The Response Planner connects Ana’s readings, her medical record, the mission phase, equipment, crew skills, availability and Earth delay. It selects a source-cited demo workflow and gives the crew actionable tasks; answers can add follow-up or backup tasks. Ana is the patient, so Lena, the backup medical officer, leads.' },
    { n: 5, title: 'THE COORDINATION', action: 'coordinate', button: 'OPEN CHIRON LINK', show: 'Tasks sent to each band',
      text: 'Each crew member’s band receives their own task, and CHIRON shows whether it was delivered. Ravi’s band is offline, so CHIRON says: tell him in person. Earth gets an automatic private report and updates.' },
    { n: 6, title: 'THE RECOVERY', action: 'recover', button: 'OPEN ANA’S DASHBOARD', show: 'Ana’s checklist and medical log',
      text: 'After the emergency, Ana’s daily checklist brings her readings back to normal (sleep, light, exercise), and the medical log records everything that happened, for the next medical officer and the flight surgeon.' },
    { n: 7, title: 'THE FUTURE', action: 'future', button: 'OPEN ABOUT CHIRON', show: 'System map and roadmap',
      text: 'What works today, what is simulated, and what comes next: physical LINK hardware, CHIRON VISION in the helmet, and prediction validated by medical teams.' },
  ];

  return (
    <PageShell title="DEMONSTRATION · ONE ASTRONAUT’S MISSION">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction('nasa')} className="min-h-11 border border-gold/60 px-4 font-mono text-xs tracking-[0.18em] text-gold hover:bg-gold/10">NASA DATA IN CHIRON</button>
        <button type="button" onClick={() => onAction('reset')} className="min-h-11 border border-marble/20 px-4 text-sm text-marble/70">Reset the demo (close open emergencies, Ana’s band back to normal)</button>
      </div>
      <ol className="relative space-y-3 border-l-2 border-gold/40 pl-6">
        {chapters.map((c) => (
          <li key={c.n} className="relative border border-marble/10 bg-void/80 p-4 backdrop-blur-md">
            <span className="absolute -left-[41px] top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gold bg-void font-serif text-sm text-gold">{c.n}</span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg tracking-[0.15em] text-marble">{c.title}</h2>
              <span className="text-sm text-marble/50">{c.show}</span>
            </div>
            <p className="mt-1 text-lg leading-relaxed text-marble/85">{c.text}</p>
            {c.action && (
              <button type="button" onClick={() => onAction(c.action!)} className={`mt-3 flex min-h-12 items-center gap-2 px-5 font-mono text-xs tracking-[0.18em] ${c.action === 'emergency' || c.action === 'monitor' ? 'bg-[#e45b5b] text-[#130709]' : 'bg-gold text-void'}`}>
                <Play size={14} /> {c.button}
              </button>
            )}
          </li>
        ))}
      </ol>
      <p className="text-sm text-marble/50">All crew, health, wearable and stock data is simulated. Emergency protocols are training scenarios, not NASA-approved procedures.</p>
    </PageShell>
  );
}
