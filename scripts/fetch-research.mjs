// Refreshes NASA OSDR health research metadata stored for offline use.
// Run: npm run fetch-research

import { mkdir, writeFile } from 'node:fs/promises';

const OUT = new URL('../src/data/snapshots/', import.meta.url);

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
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

async function fetchStudies() {
  const bySystem = {};
  for (const [system, terms] of Object.entries(TOPICS)) {
    const seen = new Map();
    for (const term of terms) {
      const result = await get(`https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(term)}&from=0&size=12&type=cgene`);
      for (const hit of result.hits.hits) {
        const study = hit._source;
        if (!study.Accession || seen.has(study.Accession)) continue;
        seen.set(study.Accession, {
          accession: study.Accession,
          title: String(study['Study Title'] ?? '').replace(/\s*\[.*?\]\s*$/, ''),
          organism: study.organism ?? 'Not stated',
          human: /homo sapiens/i.test(study.organism ?? ''),
          material: study['Material Type'] || undefined,
          projectType: study['Project Type'] || undefined,
          mission: study.Mission?.Name || undefined,
          program: study['Flight Program'] || undefined,
          summary: String(study['Study Description'] ?? '').slice(0, 320),
          url: `https://osdr.nasa.gov/bio/repo/data/studies/${study.Accession}`,
        });
      }
    }
    const studies = [...seen.values()].sort((a, b) => Number(b.human) - Number(a.human));
    bySystem[system] = studies.slice(0, 4);
  }
  return { source: 'NASA Open Science Data Repository (OSDR)', fetchedAt: new Date().toISOString(), bySystem };
}

await mkdir(OUT, { recursive: true });
const research = await fetchStudies();
await writeFile(new URL('osdr.json', OUT), JSON.stringify(research, null, 1));
console.log('OSDR:', Object.entries(research.bySystem)
  .map(([system, studies]) => `${system} ${studies.length} (${studies.filter((study) => study.human).length} human)`)
  .join(', '));
