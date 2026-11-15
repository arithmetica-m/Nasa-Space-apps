import { VOICE_HELP as COMMAND_HELP } from '../lib/voiceCommands';
import { useEffect, useRef, useState } from 'react';

interface SpeechResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

interface RecognitionResultEvent extends Event {
  results: ArrayLike<SpeechResult>;
  resultIndex?: number;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface RecognitionConstructor {
  new(): Recognition;
}

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export const NEXT_STEP_EVENT = 'chiron-next-step';

// ─── Speaking ──────────────────────────────────────────────────────────────
// CHIRON speaks only a few words, quickly, and never repeats itself.
const MAX_WORDS = 7;
const speechListeners = new Set<(speaking: boolean) => void>();
let speaking = false;
let speakingTimer: number | undefined;
let spokeUntil = 0;           // when the last spoken phrase finished (the mic ignores itself until then)
let lastSaid = '';
let lastSaidAt = 0;

function setSpeaking(next: boolean) {
  speaking = next;
  if (!next) spokeUntil = Date.now();
  speechListeners.forEach((listener) => listener(next));
}

const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Keeps the first sentence, at most a few words.
export function shortPhrase(text: string, maxWords = MAX_WORDS) {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  const words = first.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return first;
  // Never end on a joining word ("and", "or", "the"…): that sounds broken.
  const cut = words.slice(0, maxWords);
  while (cut.length > 2 && /^(and|or|but|the|a|an|to|of|in|on|for|with|at|by|from|if|their|your|is|are|below|above)$/i.test(cut[cut.length - 1].replace(/[^a-z]/gi, ''))) cut.pop();
  return `${cut.join(' ').replace(/[,;:–—-]+$/, '')}.`;
}

// `again` lets a crew member's "repeat" say the same words twice.
export function speak(text: string, { maxWords = MAX_WORDS, again = false }: { maxWords?: number; again?: boolean } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const phrase = shortPhrase(text, maxWords);
  if (!phrase) return false;
  // The same words within a few seconds are not said again.
  if (!again && normal(phrase) === normal(lastSaid) && Date.now() - lastSaidAt < 8000) return false;
  lastSaid = phrase;
  lastSaidAt = Date.now();
  // Chrome can drop a phrase spoken straight after cancel(), so only cancel when something is playing.
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = 'en-US';
  utterance.rate = 1.3;
  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  setSpeaking(true);
  // Some browsers never fire onend. Without this, the mic would ignore the crew forever.
  window.clearTimeout(speakingTimer);
  speakingTimer = window.setTimeout(() => setSpeaking(false), 800 + phrase.length * 70);
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  window.clearTimeout(speakingTimer);
  setSpeaking(false);
}

// ─── Listening ─────────────────────────────────────────────────────────────
// One microphone for the whole app. Once turned on it keeps listening, on every screen,
// until it is turned off. A screen that needs the words for itself (the daily check-in)
// borrows them with captureVoice(); everything else goes to the voice commands.
type Capture = (text: string) => boolean;
interface EngineState { active: boolean; listening: boolean; message: string }

const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const stateListeners = new Set<(s: EngineState) => void>();
const captures: Capture[] = [];
let commandHandler: ((text: string) => void) | undefined;
let state: EngineState = { active: false, listening: false, message: supported ? '' : 'Voice commands are unavailable in this browser. Use the touch controls.' };
let recognition: Recognition | undefined;
let restartTimer: number | undefined;

function setState(patch: Partial<EngineState>) {
  state = { ...state, ...patch };
  stateListeners.forEach((listener) => listener(state));
}

export function setVoiceMessage(message: string) { setState({ message }); }

// True only when the microphone clearly picked up CHIRON's own voice: the same words,
// heard while it was speaking or just after. A crew member's short "yes" or "done" is never dropped.
function heardItself(transcript: string) {
  const t = normal(transcript);
  const said = normal(lastSaid);
  if (!t || !said) return false;
  const recent = speaking || Date.now() - spokeUntil < 2500;
  const sameWords = t === said || (said.includes(t) && t.length >= said.length * 0.7);
  return recent && sameWords;
}

function handle(transcript: string) {
  setState({ message: `Heard: “${transcript}”` });
  for (let i = captures.length - 1; i >= 0; i -= 1) if (captures[i](transcript)) return;
  commandHandler?.(transcript);
}

function startRecognition() {
  if (!state.active || !supported) return;
  const Api = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Api) return;
  const r = new Api();
  recognition = r;
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (event) => {
    for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim() ?? '';
      if (!result || result.isFinal === false || !transcript || heardItself(transcript)) continue;
      handle(transcript);
    }
  };
  r.onerror = (event) => {
    // Silence and interruptions are normal: keep listening.
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    const errors: Record<string, string> = {
      'not-allowed': 'Microphone permission is needed for voice commands.',
      'service-not-allowed': 'Speech recognition is blocked by the browser. Touch controls remain available.',
      'audio-capture': 'No microphone was found. Touch controls remain available.',
      network: 'Voice needs the browser’s online speech service, which is not reachable here. Try Chrome, or use the touch controls.',
    };
    setState({ active: false, listening: false, message: errors[event.error] ?? `Voice stopped (${event.error}). Tap the microphone to try again.` });
  };
  r.onend = () => {
    if (recognition !== r) return;
    recognition = undefined;
    // Browsers end recognition after a pause. While the mic is on, start again straight away.
    if (state.active) { window.clearTimeout(restartTimer); restartTimer = window.setTimeout(startRecognition, 150); }
    else setState({ listening: false });
  };
  try {
    r.start();
    setState({ listening: true });
  } catch {
    // Already running: try again shortly.
    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(startRecognition, 400);
  }
}

export function startListening() {
  if (!supported || state.active) return;
  setState({ active: true, listening: true, message: `Listening. ${COMMAND_HELP}` });
  startRecognition();
}

export function stopListening(message = 'Voice off. Tap the microphone to listen again.') {
  if (!state.active && !recognition) return;
  window.clearTimeout(restartTimer);
  const r = recognition;
  recognition = undefined;
  setState({ active: false, listening: false, message });
  try { r?.stop(); } catch { /* already stopped */ }
}

export function isListening() { return state.active; }

// A screen borrows the words while it is open. Return true from the handler to keep a phrase.
export function captureVoice(handler: Capture) {
  captures.push(handler);
  return () => { const i = captures.indexOf(handler); if (i >= 0) captures.splice(i, 1); };
}

export function useVoiceState() {
  const [s, setS] = useState(state);
  useEffect(() => { stateListeners.add(setS); setS(state); return () => { stateListeners.delete(setS); }; }, []);
  return s;
}

export function useVoiceControl(onCommand: (text: string) => void) {
  const s = useVoiceState();
  const [voiceSpeaking, setVoiceSpeaking] = useState(speaking);
  const handler = useRef(onCommand);
  handler.current = onCommand;

  useEffect(() => {
    commandHandler = (text) => handler.current(text);
    return () => { commandHandler = undefined; };
  }, []);

  useEffect(() => {
    speechListeners.add(setVoiceSpeaking);
    return () => { speechListeners.delete(setVoiceSpeaking); };
  }, []);

  const toggle = () => { if (state.active) stopListening(); else startListening(); };

  return { listening: s.active, supported, message: s.message, speaking: voiceSpeaking, toggle };
}
