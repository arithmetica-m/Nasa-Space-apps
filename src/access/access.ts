import { useEffect, useState } from 'react';
import type { CrewMember } from '../emergency/types';
import type { ChironEvent } from '../emergency/events';

// WHO MAY SEE WHAT.
// One shared dashboard shows only general status. Each astronaut's medical profile is protected.
// PROTOTYPE: PINs are fixed demo values and checks run in the browser. This shows the access
// model (roles, logged access); it is not real security.

export type AccessRole = 'medical' | 'commander' | 'astronaut';

// Demo PINs, one per crew member. A real system would use the mission's own sign-in.
export const DEMO_PINS: Record<string, string> = { ana: '1111', lena: '2222', kai: '3333', ravi: '4444' };

export const accessRole = (m: CrewMember): AccessRole =>
  m.qualifications.includes('cmo') || m.qualifications.includes('cmo-backup') ? 'medical' : /commander/i.test(m.position) ? 'commander' : 'astronaut';

export const ROLE_LABEL: Record<AccessRole, string> = { medical: 'Medical officer', commander: 'Commander', astronaut: 'Astronaut' };

// What each role may open, in plain words (shown on the lock screen and the About page).
export const ROLE_RULES: Record<AccessRole, string> = {
  medical: 'You can open any crew member’s medical profile. Every opening is logged.',
  commander: 'As commander you see each person’s status, location and tasks, not their medical details.',
  astronaut: 'You can open your own medical profile only.',
};

export type View = 'full' | 'limited';

// Emergency access lasts this long, then the profile locks again.
export const EMERGENCY_ACCESS_MIN = 15;

// What `viewer` may see of `owner`'s profile right now.
export function viewFor(viewer: CrewMember, owner: CrewMember, log: ChironEvent[], now: number): { view: View; why: string } {
  if (viewer.id === owner.id) return { view: 'full', why: 'Your own profile' };
  if (accessRole(viewer) === 'medical') return { view: 'full', why: 'Medical officer access (logged)' };
  const grant = [...log].reverse().find((e) => e.type === 'profile-access' && e.by === viewer.id && e.crewId === owner.id && e.role === 'emergency');
  if (grant && now - grant.t < EMERGENCY_ACCESS_MIN * 60_000) return { view: 'full', why: `Emergency access (logged), ${Math.max(1, Math.ceil(EMERGENCY_ACCESS_MIN - (now - grant.t) / 60_000))} min left` };
  return { view: 'limited', why: accessRole(viewer) === 'commander' ? 'Command view' : 'Private profile' };
}

// Who has unlocked this device with their PIN, for this browser tab.
const KEY = 'chiron-unlocked';
export function useUnlocked(account: string) {
  const [who, setWho] = useState<string | undefined>(() => { try { return sessionStorage.getItem(KEY) ?? undefined; } catch { return undefined; } });
  useEffect(() => { try { if (who) sessionStorage.setItem(KEY, who); else sessionStorage.removeItem(KEY); } catch { /* ignore */ } }, [who]);
  return { unlocked: who === account, unlock: () => setWho(account), lock: () => setWho(undefined) };
}
