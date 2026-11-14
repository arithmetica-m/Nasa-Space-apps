// Relay for live sync between devices on the same network.
// Run: npm run relay   (and run the app with: npm run dev -- --host)
// Every device sends its events; the relay keeps the full log and passes new events to all.

import { WebSocketServer } from 'ws';

const PORT = 5175;
const log = new Map();
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify([...log.values()]));
  ws.on('message', (raw) => {
    let events;
    try { events = JSON.parse(raw); } catch { return; }
    const fresh = events.filter((e) => e && e.id && !log.has(e.id));
    fresh.forEach((e) => log.set(e.id, e));
    if (!fresh.length) return;
    const data = JSON.stringify(fresh);
    for (const client of wss.clients) if (client !== ws && client.readyState === 1) client.send(data);
  });
});

console.log(`CHIRON relay on port ${PORT}. Devices on this network connect automatically.`);
