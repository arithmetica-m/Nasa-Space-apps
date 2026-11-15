import type { CrewMember } from '../emergency/types';

// WHO MAY SEE WHAT.
// One shared dashboard shows only general status. Each astronaut's medical profile is protected
// and locks again every time it is closed.
// PROTOTYPE: PINs are fixed demo values and checks run in the browser. This shows the access
// model (personal PIN, medical officer access, logged emergency access); it is not real security.

export type AccessRole = 'medical' | 'commander' | 'astronaut';

// Demo PINs for the built-in crew. A crew member added from a file brings their own PIN.
export const DEMO_PINS: Record<string, string> = { ana: '1111', lena: '2222', kai: '3333', ravi: '4444' };
export const pinOf = (m: CrewMember) => m.pin ?? DEMO_PINS[m.id] ?? '0000';

export const accessRole = (m: CrewMember): AccessRole =>
  m.qualifications.includes('cmo') || m.qualifications.includes('cmo-backup') ? 'medical' : /commander/i.test(m.position) ? 'commander' : 'astronaut';
