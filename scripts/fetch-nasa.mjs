// Fetches real NASA data into src/data/snapshots so the app works offline
// and never shows sample data as NASA data. Run: npm run fetch-nasa
//
// Sources:
//   DONKI (space weather events): https://api.nasa.gov/  (CCMC DONKI)
//   OSDR  (spaceflight biology studies): https://osdr.nasa.gov/
// NASA_API_KEY is optional; DEMO_KEY works but is limited to a few requests an hour.

import { mkdir, writeFile } from 'node:fs/promises';

const KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const OUT = new URL('../src/data/snapshots/', import.meta.url);
const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date();

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// The API accepts at most 60 days per request, so long ranges are fetched in pieces.
// With DEMO_KEY (10 requests an hour) only the most health-relevant ranges fit:
// solar particle events (radiation) over the last 240 days, storms over the last 60.
async function chunked(type, days, coverage) {
  const out = [];
  for (let back = days; back > 0; back -= 60) {
    const s = new Date(end.getTime() - back * 864e5);
    const e = new Date(Math.min(end.getTime(), s.getTime() + 59 * 864e5));
    try {
      const j = await get(`https://api.nasa.gov/DONKI/${type}?startDate=${iso(s)}&endDate=${iso(e)}&api_key=${KEY}`);
      out.push(...(Array.isArray(j) ? j : []));
      coverage.push({ type, from: iso(s), to: iso(e) });
    } catch (err) {
      console.warn(`DONKI ${type} ${iso(s)}..${iso(e)} skipped: ${err.message.slice(0, 80)}`);
    }
  }
  return out;
}

async function donki() {
  const coverage = [];
  const long = KEY === 'DEMO_KEY' ? 240 : 520;
  const sep = await chunked('SEP', long, coverage);
  const gst = await chunked('GST', KEY === 'DEMO_KEY' ? 60 : 520, coverage);
  const flr = KEY === 'DEMO_KEY' ? [] : await chunked('FLR', 520, coverage);
  const events = [
    ...sep.map((e) => ({ type: 'SEP', id: e.sepID, time: e.eventTime, detail: (e.instruments ?? []).map((i) => i.displayName).join('; '), link: e.link })),
    ...gst.map((e) => {
      const kp = Math.max(...(e.allKpIndex ?? []).map((k) => k.kpIndex), 0);
      return { type: 'GST', id: e.gstID, time: e.startTime, kp, detail: `Maximum Kp index ${kp}`, link: e.link };
    }),
    // Only the strongest flares (X class) are kept.
    ...flr.filter((e) => (e.classType ?? '').startsWith('X')).map((e) => ({ type: 'FLR', id: e.flrID, time: e.peakTime ?? e.beginTime, classType: e.classType, detail: `Class ${e.classType}`, link: e.link })),
  ].filter((e) => e.time).sort((a, b) => a.time.localeCompare(b.time));
  return { source: 'NASA CCMC DONKI via api.nasa.gov', fetchedAt: new Date().toISOString(), coverage, events };
}

const TOPICS = {
  cardiovascular: ['cardiovascular spaceflight', 'heart microgravity'],
  musculoskeletal: ['bone loss spaceflight', 'muscle atrophy spaceflight'],
  sensorimotor: ['retina spaceflight', 'vestibular'],
  mind: ['brain spaceflight', 'behavior spaceflight'],
  sleep: ['circadian'],
  metabolic: ['metabolism spaceflight', 'insulin'],
  immune: ['immune spaceflight'],
  radiation: ['radiation human', 'ionizing radiation'],
};

async function osdr() {
  const bySystem = {};
  for (const [system, terms] of Object.entries(TOPICS)) {
    const seen = new Map();
    for (const term of terms) {
      const j = await get(`https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(term)}&from=0&size=12&type=cgene`);
      for (const h of j.hits.hits) {
        const s = h._source;
        if (!s.Accession || seen.has(s.Accession)) continue;
        seen.set(s.Accession, {
          accession: s.Accession,
          title: String(s['Study Title'] ?? '').replace(/\s*\[.*?\]\s*$/, ''),
          organism: s.organism ?? 'Not stated',
          human: /homo sapiens/i.test(s.organism ?? ''),
          material: s['Material Type'] || undefined,
          projectType: s['Project Type'] || undefined,
          mission: s.Mission?.Name || undefined,
          program: s['Flight Program'] || undefined,
          summary: String(s['Study Description'] ?? '').slice(0, 320),
          url: `https://osdr.nasa.gov/bio/repo/data/studies/${s.Accession}`,
        });
      }
    }
    // Human studies first, then the rest; keep four per system.
    const all = [...seen.values()].sort((a, b) => Number(b.human) - Number(a.human));
    bySystem[system] = all.slice(0, 4);
  }
  return { source: 'NASA Open Science Data Repository (OSDR)', fetchedAt: new Date().toISOString(), bySystem };
}

await mkdir(OUT, { recursive: true });
const d = await donki();
await writeFile(new URL('donki.json', OUT), JSON.stringify(d, null, 1));
console.log(`DONKI: ${d.events.length} events from ${d.coverage.length} date ranges`);
const o = await osdr();
await writeFile(new URL('osdr.json', OUT), JSON.stringify(o, null, 1));
console.log('OSDR:', Object.entries(o.bySystem).map(([k, v]) => `${k} ${v.length} (${v.filter((s) => s.human).length} human)`).join(', '));
