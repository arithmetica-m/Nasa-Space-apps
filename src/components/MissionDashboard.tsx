import { CircleAlert, Mic, Siren, VolumeX } from 'lucide-react';
import type { Mission } from '../types';
import type { CrewMember } from '../emergency/types';
import { MissionProgress } from './MissionProgress';

type Mode = 'watch' | 'teach' | 'act';

interface Props {
  mission: Mission;
  mode: Mode;
  crew: CrewMember[];
  account: string;
  selectedProfile?: string;
  activePatientIds: string[];
  overallStatus: string;
  statusNeedsAttention: boolean;
  gmt: string;
  listening: boolean;
  speaking: boolean;
  voiceSupported: boolean;
  onAccount: (id: string) => void;
  onProfile: (id: string) => void;
  onCloseProfile: () => void;
  onEmergency: () => void;
  onVoice: () => void;
  onStopSpeaking: () => void;
  onChangeMission: () => void;
}

export function MissionDashboard({
  mission, mode, crew, account, selectedProfile, activePatientIds, overallStatus, statusNeedsAttention, gmt,
  listening, speaking, voiceSupported, onAccount, onProfile, onEmergency, onVoice, onStopSpeaking, onChangeMission,
  onCloseProfile,
}: Props) {
  const phaseLabel = mission.today / mission.totalDays > 0.85 ? 'RETURN / ARRIVAL' : mission.today / mission.totalDays > 0.4 ? 'CRUISE OPERATIONS' : 'OUTBOUND TRANSIT';

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-4 md:px-8">
      <header className="flex flex-wrap items-center gap-4 border-b border-marble/10 pb-4">
        <div className="mr-auto min-w-[180px]">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.32em] text-marble/60">
            <span className="instrument-mark" aria-hidden="true" /> CHIRON · MISSION STATUS
          </div>
          <h1 className="mt-1 font-sans text-xl font-semibold tracking-wide text-marble md:text-2xl">{mission.name}</h1>
          <button onClick={onChangeMission} className="mt-1 text-xs text-marble/50 underline decoration-marble/20 underline-offset-4 hover:text-marble">Change mission</button>
        </div>
        <div className="order-3 w-full md:order-none md:w-[min(42vw,520px)]">
          <MissionProgress mission={mission} />
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="crew-account">Signed in as</label>
          <select id="crew-account" value={account} onChange={(event) => onAccount(event.target.value)} className="min-h-11 max-w-[190px] border border-marble/20 bg-void/90 px-3 text-sm text-marble">
            {crew.map((member) => <option key={member.id} value={member.id}>Signed in: {member.name}</option>)}
          </select>
          <button type="button" onClick={onVoice} disabled={!voiceSupported} aria-label={listening ? 'Stop voice commands' : 'Start voice commands'}
            className={`flex min-h-11 items-center gap-2 border px-3 text-xs font-medium transition ${listening ? 'border-[#67c9d5] bg-[#67c9d5]/15 text-[#9be7ef]' : 'border-marble/20 text-marble/75 hover:border-[#67c9d5]/70 hover:text-marble'} disabled:cursor-not-allowed disabled:opacity-40`}>
            <Mic size={16} /> <span className="hidden sm:inline">{listening ? 'Listening…' : 'Voice'}</span>
          </button>
          {speaking && <button type="button" onClick={onStopSpeaking} aria-label="Silence spoken response" title="Silence spoken response"
            className="flex min-h-11 items-center gap-2 border border-[#e39b4b]/60 px-3 text-xs text-[#f3c28d] hover:bg-[#e39b4b]/10">
            <VolumeX size={16} /><span className="hidden sm:inline">Silence</span>
          </button>}
          <div className="hidden text-right font-mono text-[10px] tracking-wider text-marble/60 lg:block">{gmt} GMT<br />EARTH {mission.delayLabel}</div>
        </div>
      </header>

      <section aria-labelledby="crew-heading" className="instrument-panel p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.24em] text-marble/50">SHARED MISSION DISPLAY</div>
            <h2 id="crew-heading" className="mt-1 text-lg font-semibold text-marble md:text-xl">Mission overview</h2>
          </div>
          <div className={`flex items-center gap-2 text-xs ${statusNeedsAttention ? 'text-[#ff8585]' : 'text-[#7bd5b8]'}`}>
            <span className={`h-2 w-2 rounded-full ${statusNeedsAttention ? 'animate-pulse bg-[#e45b5b]' : 'bg-[#63c9a8]'}`} />
            {overallStatus}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {crew.map((member) => {
            const affected = activePatientIds.includes(member.id);
            const selected = selectedProfile === member.id;
            const initials = member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
            return (
              <button key={member.id} type="button" onClick={() => onProfile(member.id)}
                aria-pressed={selected}
                className={`crew-card min-h-[100px] border p-3 text-left transition hover:-translate-y-0.5 hover:border-marble/35 md:p-4 ${selected ? 'border-[#67c9d5]/70 bg-[#67c9d5]/[0.07]' : 'border-marble/10 bg-void/65'}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-marble/20 bg-[radial-gradient(circle_at_35%_30%,#60717b,#202b32_62%,#111820)] font-mono text-sm text-marble shadow-inner">{initials}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-marble md:text-base">{member.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-marble/50 md:text-xs">{member.position.split(' · ')[0]}</span>
                  </span>
                </div>
                <span className={`mt-3 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] md:text-[10px] ${affected ? 'text-[#ff8585]' : 'text-[#7bd5b8]'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${affected ? 'animate-pulse bg-[#e45b5b]' : 'bg-[#63c9a8]'}`} />
                  {affected ? 'SUPPORT NEEDED' : member.id === account ? 'ON WATCH · YOU' : 'ON DUTY'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-marble/10 pt-4">
          <div className="flex items-center gap-3">
            <div className="instrument-dial" aria-hidden="true"><span>{mission.today}</span></div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] text-marble/50">MISSION PHASE · {phaseLabel}</div>
              <div className="mt-1 text-sm text-marble/75">Day {mission.today} of {mission.totalDays} · {mission.gravity} · {gmt} GMT</div>
            </div>
          </div>
          {selectedProfile && (
            <button type="button" onClick={onCloseProfile} className="min-h-11 border border-marble/20 px-4 text-sm text-marble/75 hover:border-marble/40 hover:text-marble">
              Back to mission overview
            </button>
          )}
        </div>
      </section>

      {mode === 'watch' && (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onEmergency} className="flex min-h-12 items-center gap-2 border border-[#e45b5b]/65 bg-[#e45b5b]/10 px-5 font-mono text-xs font-semibold tracking-[0.16em] text-[#ff8585] transition hover:bg-[#e45b5b]/20 focus-visible:outline-[#ff8585]">
            <Siren size={17} /> REPORT EMERGENCY <CircleAlert size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
