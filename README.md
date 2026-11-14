# CHIRON

Health software for astronauts, built for the NASA Space Apps Challenge 2026 ("Create Health Monitoring Software for Astronauts on Space Missions").

CHIRON is a health-support prototype for astronauts. WATCH presents personal health trends, TEACH explains spaceflight health research, and ACT coordinates role-specific crew actions in a simulated emergency.

**This is a demonstration, not a medical device or clinical guidance. Emergency scenarios are hypothetical training examples. They are not NASA-approved procedures.**

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

## Emergencies on several devices

Each device is signed in as one crew member ("Signed in as" on the Watch screen). In an emergency each person sees only their own tasks; everyone else appears as live status. Everything (steps, answers, missing equipment, vitals, crew availability, Earth messages) is an event in a shared log, so all devices show the same picture and the plan adapts as things change.

- **Same computer:** open two browser tabs, sign each in as a different crew member. They sync automatically.
- **Several devices on one network** (phones, tablets):

```bash
npm run relay
npm run dev -- --host
```

Then open the address Vite prints (Network) on each device. The log is also stored on each device, so CHIRON keeps working offline and catches up when reconnected.

The crew, inventory, health readings, and emergency scenarios are simulated. The emergency library demonstrates a draft/approval workflow only; it does not certify procedures for medical use.

## Health research

Selected spaceflight biology studies from NASA's Open Science Data Repository (OSDR) are stored in `src/data/snapshots/osdr.json` for offline health education. They provide research context, not patient-specific guidance or emergency procedures. Refresh the metadata with:

```bash
npm run fetch-research
```

| Source | Used for | Notes |
| --- | --- | --- |
| NASA OSDR | "The science behind this" in astronaut health explanations | Studies are labelled by participant/model type and curated by health system. The app's readings and baselines remain simulated. |

## Where things are

| Path | What it holds |
| --- | --- |
| `src/data/indicators.ts` | Every health indicator: unit, personal normal range, how it is measured on board, why it matters |
| `src/data/missions.ts` | Demonstration mission profiles and communication delay |
| `src/data/simulate.ts` | Simulated health history and the drift score for each day |
| `src/data/research.ts` | Curated NASA OSDR health research metadata |
| `src/emergency/` | Simulated emergency scenarios, role assignment, and shared event log |
