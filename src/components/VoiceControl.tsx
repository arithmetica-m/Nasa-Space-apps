import { useEffect, useRef, useState } from 'react';

interface RecognitionResultEvent extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
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

export function useVoiceControl(onCommand: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognition = useRef<Recognition>();
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) setMessage('Voice commands are unavailable in this browser. Use the touch controls.');
    return () => recognition.current?.stop();
  }, [supported]);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const RecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionApi) return;
    const activeRecognition = new RecognitionApi();
    recognition.current = activeRecognition;
    activeRecognition.lang = 'en-US';
    activeRecognition.interimResults = false;
    activeRecognition.maxAlternatives = 1;
    activeRecognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      setMessage(transcript ? `Heard: “${transcript}”` : 'No command heard. Try again.');
      if (transcript) onCommand(transcript);
    };
    activeRecognition.onerror = (event) => {
      setListening(false);
      setMessage(event.error === 'not-allowed' ? 'Microphone permission is needed for voice commands.' : 'Voice input ended. Touch controls remain available.');
    };
    activeRecognition.onend = () => setListening(false);
    setMessage('Try “show crew status” or “open emergency mode”.');
    setListening(true);
    activeRecognition.start();
  };

  return { listening, supported, message, toggle };
}

export function speak(text: string) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  return true;
}
