/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional secure relay for multi-device sync on a hosted site, e.g. wss://relay.example.org
  readonly VITE_CHIRON_RELAY?: string;
}
