import { useSyncExternalStore } from 'react';
import { newId, type ChironEvent, type NewEvent } from './events';

// Shares the event log between every CHIRON screen:
//  - other tabs and windows on this device, through a BroadcastChannel;
//  - other devices on the same network, through the relay (npm run relay), when it is running.
// The log is also kept on the device, so CHIRON works offline and catches up when reconnected.

const KEY = 'chiron-log-v1';
const RELAY_PORT = 5175;

let log: ChironEvent[] = load();
let status: 'local' | 'relay' = 'local';
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('chiron') : undefined;
let socket: WebSocket | undefined;

function load(): ChironEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

// Adds events we have not seen yet, keeping the log in time order.
function merge(incoming: ChironEvent[]) {
  const known = new Set(log.map((e) => e.id));
  const fresh = incoming.filter((e) => !known.has(e.id));
  if (!fresh.length) return;
  log = [...log, ...fresh].sort((a, b) => a.t - b.t);
  emit();
}

channel?.addEventListener('message', (m) => merge(m.data as ChironEvent[]));

// Retries back off from 5 s to 1 minute while no relay is running.
let retry = 5000;
function connect() {
  try {
    socket = new WebSocket(`ws://${location.hostname}:${RELAY_PORT}`);
  } catch { return; }
  socket.onopen = () => { retry = 5000; status = 'relay'; socket!.send(JSON.stringify(log)); emit(); };
  socket.onmessage = (m) => { try { merge(JSON.parse(m.data)); } catch { /* ignore */ } };
  socket.onclose = () => { status = 'local'; emit(); setTimeout(connect, retry); retry = Math.min(60_000, retry * 2); };
  socket.onerror = () => socket?.close();
}
if (typeof window !== 'undefined') connect();

export function publish(e: NewEvent) {
  const event = { ...e, id: newId(), t: Date.now() } as ChironEvent;
  merge([event]);
  channel?.postMessage([event]);
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify([event]));
  return event;
}

export function clearLog() {
  log = [];
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useLog() {
  return useSyncExternalStore(subscribe, () => log);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, () => status);
}
