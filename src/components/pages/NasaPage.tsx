import { ArrowRight } from 'lucide-react';
import type { Page } from '../MissionDashboard';
import { PageShell, Panel } from './ui';

// NASA SOURCE → CHIRON FUNCTION → PRACTICAL OUTPUT.
// Every source says what kind of thing it is, so a dataset is never presented as a paper,
// and a research gap is never presented as data.

type Kind = 'DATASET' | 'STANDARD' | 'RESEARCH GAP' | 'CONCEPT OF OPERATIONS' | 'RESEARCH' | 'MODEL';

const KIND_STYLE: Record<Kind, string> = {
  DATASET: 'border-[#5cc8a8]/60 text-[#7bd5b8]',
  STANDARD: 'border-gold/60 text-gold',
  'RESEARCH GAP': 'border-[#e39b4b]/60 text-[#f3c28d]',
  'CONCEPT OF OPERATIONS': 'border-[#8fb8ff]/60 text-[#bcd3ff]',
  RESEARCH: 'border-marble/40 text-marble/80',
  MODEL: 'border-marble/40 text-marble/80',
};

interface Row {
  kind: Kind;
  source: string;
  url: string;
  provides: string;
  need: string;
  feature: string;
  output: string;
  page?: Page;
  status: 'USED IN THE PROTOTYPE' | 'SHAPES THE DESIGN' | 'PROPOSED FUTURE USE';
}

const ROWS: Row[] = [
  {
    kind: 'DATASET', source: 'NASA Open Science Data Repository (OSDR)', url: 'https://osdr.nasa.gov/bio/repo/',
    provides: 'Study records on how spaceflight affects each body system (heart, bone and muscle, balance, brain, sleep, metabolism, immunity, radiation). Fetched from the OSDR search API and stored for offline use.',
    need: '1 · Personalized medicine', feature: 'Health insights and the medical library’s science section',
    output: 'When a reading is flagged, CHIRON lists the real OSDR studies (OSD-… numbers) for that body system, so the crew sees the evidence behind the concern.', page: 'profile', status: 'USED IN THE PROTOTYPE',
  },
  {
    kind: 'STANDARD', source: 'NASA-STD-3001 Vol. 1, §6 Medical Operations', url: 'https://www.nasa.gov/reference/6-0-medical-operations/',
    provides: 'Requirements for crew medical care: a trained crew medical officer, private medical communication, medical capability matched to the mission.',
    need: '3 · Decision support', feature: 'RESPOND: crew roles and automatic Earth reports',
    output: 'Emergency roles put the medical officer or backup in the lead. Earth reports are marked PRIVATE MEDICAL COMMUNICATION and sent store-and-forward.', page: 'respond', status: 'USED IN THE PROTOTYPE',
  },
  {
    kind: 'RESEARCH GAP', source: 'NASA Human Research Roadmap · Medical-401', url: 'https://humanresearchroadmap.nasa.gov/',
    provides: 'Gap: characterize the resource and risk limits of exploration missions to decide which medical capabilities and resources to carry.',
    need: '4 · Fewer resources · 5 · Risk prediction', feature: 'RESPOND stock planning · PREVENT readiness simulation',
    output: 'CHIRON checks every approved procedure against the mission’s stock: missing items, one use left, items expiring before the mission ends. The readiness simulation lists gaps per emergency.', page: 'train', status: 'USED IN THE PROTOTYPE',
  },
  {
    kind: 'RESEARCH GAP', source: 'NASA Human Research Roadmap · Medical-701', url: 'https://humanresearchroadmap.nasa.gov/',
    provides: 'Gap: increase in-flight medical capability while reducing the cost to crew time, mission and vehicle resources.',
    need: '3 · Decision support · 4 · Fewer resources', feature: 'Response Planner',
    output: 'One plan from equipment already on board, crew already trained and readings already measured. CHIRON never asks for extra hardware and only uses alternatives written into an approved procedure.', page: 'respond', status: 'USED IN THE PROTOTYPE',
  },
  {
    kind: 'CONCEPT OF OPERATIONS', source: 'Earth-Independent Medical Operations (EIMO) ConOps · NTRS 20250000009', url: 'https://ntrs.nasa.gov/citations/20250000009',
    provides: 'Gradual transfer of medical decision-making from Earth to the crew, using reference databases, wearable sensors and training tools for the crew medical officer when Earth is delayed.',
    need: '2 · Training · 3 · Decision support', feature: 'Medical library · CHIRON LINK · TRAIN practice · Response Planner',
    output: 'Each EIMO element has a CHIRON part: the library is the reference database, LINK is the wearable layer, practice runs use the same approved steps, and the planner works through the communication delay.', page: 'link', status: 'SHAPES THE DESIGN',
  },
  {
    kind: 'RESEARCH', source: 'EIMO Technical Interchange Meetings summary · NTRS 20250000057', url: 'https://ntrs.nasa.gov/citations/20250000057',
    provides: 'Summary of the 2023–2024 NASA meetings that defined EIMO, including crew health data and training.',
    need: '2 · Training · 3 · Decision support', feature: '“How CHIRON got here” on every recommendation',
    output: 'Every recommendation shows its data, rule, protocol and limits, so the crew can check it, and it doubles as training in medical reasoning.', status: 'SHAPES THE DESIGN',
  },
  {
    kind: 'RESEARCH', source: 'Medical capability gaps beyond low Earth orbit (AsMA 2023) · NTRS 20230007411', url: 'https://ntrs.nasa.gov/citations/20230007411',
    provides: 'NASA’s nine high-level medical capability gaps: more autonomy is needed because of distance, delay and no evacuation.',
    need: 'All six objectives', feature: 'The whole CHIRON system',
    output: 'Mission settings change CHIRON’s behaviour: with an 11-minute delay to Mars the planner says “act first”; near Earth it says “ask Earth”.', page: 'respond', status: 'SHAPES THE DESIGN',
  },
  {
    kind: 'RESEARCH', source: 'NASA Human Research Program: human spaceflight risks', url: 'https://www.nasa.gov/hrp/risks/',
    provides: 'The hazards of spaceflight (altered gravity, isolation, radiation, distance from Earth, hostile environment) and the health risks they cause.',
    need: '1 · Personalized medicine · 5 · Risk prediction · 6 · Rehabilitation', feature: 'PREVENT readings and event checks · RECOVER checklist',
    output: 'Each reading CHIRON tracks is tied to a hazard. Before Mars arrival, CHIRON checks muscles, balance and blood pressure because gravity returns.', page: 'train', status: 'USED IN THE PROTOTYPE',
  },
  {
    kind: 'MODEL', source: 'NASA Integrated Medical Model (IMM)', url: 'https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/',
    provides: 'A probabilistic model of which medical conditions may occur on a mission and what resources they need.',
    need: '4 · Fewer resources · 5 · Risk prediction', feature: 'PREVENT readiness simulation (future)',
    output: 'Today the simulation checks each emergency with fixed rules. A future version could weight emergencies by IMM-style likelihood.', status: 'PROPOSED FUTURE USE',
  },
];

export function NasaPage({ onPage }: { onPage: (p: Page) => void }) {
  return (
    <PageShell title="NASA DATA IN CHIRON">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_STYLE) as Kind[]).map((k) => <span key={k} className={`border px-2 py-0.5 font-mono text-[11px] tracking-[0.15em] ${KIND_STYLE[k]}`}>{k}</span>)}
      </div>
      <p className="text-base text-marble/70">Only OSDR is live data. Standards, gaps and concepts are documents that shaped how CHIRON works; none of them is presented as a dataset.</p>

      <ol className="space-y-3">
        {ROWS.map((r) => (
          <li key={r.source}>
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-0.5 font-mono text-[11px] tracking-[0.15em] ${KIND_STYLE[r.kind]}`}>{r.kind}</span>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-lg text-marble underline decoration-gold/50 underline-offset-4 hover:decoration-gold">{r.source}</a>
                <span className={`ml-auto font-mono text-[11px] tracking-[0.15em] ${r.status === 'USED IN THE PROTOTYPE' ? 'text-[#7bd5b8]' : r.status === 'SHAPES THE DESIGN' ? 'text-gold' : 'text-marble/50'}`}>{r.status}</span>
              </div>
              <div className="mt-3 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <div className="border border-marble/10 p-3"><div className="font-mono text-[10px] tracking-[0.2em] text-marble/50">NASA INFORMATION</div><p className="mt-1 text-base text-marble/85">{r.provides}</p></div>
                <ArrowRight className="hidden self-center text-gold md:block" />
                <div className="border border-marble/10 p-3"><div className="font-mono text-[10px] tracking-[0.2em] text-marble/50">CHIRON FUNCTION</div><p className="mt-1 text-base text-marble">{r.feature}</p><p className="mt-1 text-sm text-marble/55">Need: {r.need}</p></div>
                <ArrowRight className="hidden self-center text-gold md:block" />
                <div className="border border-gold/30 bg-gold/[0.04] p-3"><div className="font-mono text-[10px] tracking-[0.2em] text-gold">PRACTICAL OUTPUT</div><p className="mt-1 text-base text-marble/90">{r.output}</p></div>
              </div>
              {r.page && <button type="button" onClick={() => onPage(r.page!)} className="mt-2 min-h-10 font-mono text-xs tracking-[0.18em] text-gold hover:text-marble">SEE IT IN CHIRON →</button>}
            </Panel>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
