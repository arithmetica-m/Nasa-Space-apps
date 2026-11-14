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

export const NEXT_STEP_EVENT = 'chiron-next-step';
const speechListeners = new Set<(speaking: boolean) => void>();
let speaking = false;
let speakingTimer: number | undefined;

function setSpeaking(next: boolean) {
  speaking = next;
  speechListeners.forEach((listener) => listener(next));
}

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export function useVoiceControl(onCommand: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [voiceSpeaking, setVoiceSpeaking] = useState(speaking);
  const recognition = useRef<Recognition>();
  const active = useRef(false);
  const restartTimer = useRef<number>();
  const commandHandler = useRef(onCommand);
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    commandHandler.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const listener = (next: boolean) => setVoiceSpeaking(next);
    speechListeners.add(listener);
    return () => { speechListeners.delete(listener); };
  }, []);

  useEffect(() => {
    // The command list appears only while listening, so the home page stays quiet.
    if (!supported) setMessage('Voice commands are unavailable in this browser. Use the touch controls.');
    return () => {
      active.current = false;
      window.clearTimeout(restartTimer.current);
      recognition.current?.stop();
    };
  }, [supported]);

  const startRecognition = () => {
    if (!active.current || !supported) return;
    const RecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionApi) return;
    const activeRecognition = new RecognitionApi();
    recognition.current = activeRecognition;
    activeRecognition.lang = 'en-US';
    activeRecognition.continuous = true;
    activeRecognition.interimResults = true;
    activeRecognition.maxAlternatives = 1;
    activeRecognition.onresult = (event) => {
      const start = event.resultIndex ?? 0;
      for (let index = start; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result || result.isFinal === false || speaking) continue;
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (transcript) {
          setMessage(`Heard: “${transcript}”`);
          commandHandler.current(transcript);
        }
      }
    };
    activeRecognition.onerror = (event) => {
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone permission is needed for voice commands.',
        'service-not-allowed': 'Speech recognition is blocked by the browser. Touch controls remain available.',
        'audio-capture': 'No microphone was found. Touch controls remain available.',
        'no-speech': 'No speech detected. Still listening…',
        network: 'Voice needs the browser’s online speech service, which is not reachable here. Try Chrome, or use the touch controls.',
      };
      setMessage(errors[event.error] ?? `Voice recognition error (${event.error}). Touch Voice to try again.`);
      if (event.error !== 'no-speech') {
        active.current = false;
        setListening(false);
      }
    };
    activeRecognition.onend = () => {
      if (recognition.current !== activeRecognition) return;
      recognition.current = undefined;
      if (active.current) {
        setListening(true);
        window.clearTimeout(restartTimer.current);
        restartTimer.current = window.setTimeout(startRecognition, 300);
      } else {
        setListening(false);
      }
    };
    try {
      activeRecognition.start();
      setListening(true);
      setMessage(`Listening. ${COMMAND_HELP}`);
    } catch (error) {
      active.current = false;
      setListening(false);
      setMessage(error instanceof Error ? `Could not start voice input: ${error.message}` : 'Could not start voice input. Touch controls remain available.');
    }
  };

  const toggle = () => {
    if (!supported) return;
    if (active.current) {
      active.current = false;
      window.clearTimeout(restartTimer.current);
      recognition.current?.stop();
      setListening(false);
      setMessage('Voice commands stopped. Tap Voice to listen again.');
      return;
    }

    active.current = true;
    setMessage('Starting voice commands…');
    startRecognition();
  };

  return { listening, supported, message, speaking: voiceSpeaking, toggle };
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  // Some browsers never fire onend. Without this, every later voice command would be ignored.
  window.clearTimeout(speakingTimer);
  speakingTimer = window.setTimeout(() => setSpeaking(false), 1500 + text.length * 90);
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  setSpeaking(false);
}

// Listens for one phrase (for example a reading: "seventy two") and hands back the text.
export function listenOnce(onText: (text: string) => void, onError: (message: string) => void) {
  const Api = typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  if (!Api) { onError('Voice entry is not available in this browser. Type the number instead.'); return () => {}; }
  const r = new Api();
  r.lang = 'en-US';
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 1;
  let got = false;
  let failed = false;
  const fail = (m: string) => { if (!failed && !got) { failed = true; onError(m); } };
  r.onresult = (event) => {
    const t = event.results[0]?.[0]?.transcript?.trim();
    if (t) { got = true; onText(t); }
  };
  r.onerror = (event) => fail(event.error === 'not-allowed' ? 'Allow the microphone to enter readings by voice.'
    : event.error === 'network' ? 'Voice needs the browser’s online speech service, which is not reachable here. Type the number instead.'
      : 'I did not catch that. Try again or type the number.');
  r.onend = () => fail('I did not catch that. Try again or type the number.');
  try { r.start(); } catch { fail('Could not start the microphone.'); }
  return () => r.stop();
}
