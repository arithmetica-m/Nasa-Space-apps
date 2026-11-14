// Turns what the astronaut said into one command. Matches key words, not exact sentences,
// so "show me the crew", "crew status" and "go home" all work.

export type VoiceCommand =
  | { type: 'emergency' }
  | { type: 'next' }
  | { type: 'home' }
  | { type: 'profile'; crewId?: string } // no crewId = my own profile
  | { type: 'checkin' }
  | { type: 'teach' }
  | { type: 'equipment' }
  | { type: 'library' }
  | { type: 'silence' }
  | { type: 'unknown' };

export const VOICE_HELP = 'Try: “crew status”, “my profile”, “Ana’s profile”, “check in”, “procedures”, “equipment”, “next step” or “emergency”.';

const clean = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/['’]s\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function parseCommand(text: string, crew: { id: string; name: string }[]): VoiceCommand {
  const t = clean(text);
  const has = (re: RegExp) => re.test(t);
  if (!t) return { type: 'unknown' };

  if (has(/\b(emergenc\w*|mayday|help me)\b/)) return { type: 'emergency' };
  if (has(/\b(next( step)?|step done|continue)\b/)) return { type: 'next' };
  if (has(/\b(stop talking|be quiet|quiet|silence|stop)\b/)) return { type: 'silence' };

  // A crew member's name anywhere in the sentence opens their profile.
  const words = t.split(' ');
  const person = crew.find((c) => clean(c.name).split(' ').some((n) => n.length > 2 && words.includes(n)));
  if (person) return { type: 'profile', crewId: person.id };
  if (has(/\b(check ?in|log|add (my )?readings?|measure\w*|enter (my )?readings?)\b/)) return { type: 'checkin' };
  if (has(/\b(my|me|mine)\b/) && has(/\b(profile|health|body|readings?)\b/)) return { type: 'profile' };

  if (has(/\b(teach|procedures?|guides?|how (do i|to))\b/)) return { type: 'teach' };
  if (has(/\b(equipment|inventory|supplies|kit)\b/)) return { type: 'equipment' };
  if (has(/\blibrary\b/)) return { type: 'library' };
  if (has(/\b(crew|home|overview|everyone|status|back|all)\b/)) return { type: 'home' };
  return { type: 'unknown' };
}

// Spoken numbers for entering readings by voice: "seventy two", "six point five", "72".
const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

export function parseSpokenNumber(text: string): number | undefined {
  const digits = text.replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (digits) return Number(digits[0]);
  const words = clean(text).split(' ');
  let whole = 0, frac = '', seen = false, afterPoint = false;
  for (const w of words) {
    if (w === 'point' || w === 'dot') { afterPoint = true; continue; }
    if (afterPoint && w in UNITS && UNITS[w] < 10) { frac += String(UNITS[w]); seen = true; continue; }
    if (w in UNITS) { whole += UNITS[w]; seen = true; }
    else if (w in TENS) { whole += TENS[w]; seen = true; }
    else if (w === 'hundred') { whole = (whole || 1) * 100; seen = true; }
  }
  if (!seen) return undefined;
  return frac ? Number(`${whole}.${frac}`) : whole;
}
