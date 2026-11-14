# CHIRON

Health software for astronauts, built for the NASA Space Apps Challenge 2026 ("Create Health Monitoring Software for Astronauts on Space Missions").

CHIRON tracks each crew member's health every day, explains changes against their own pre-flight normal, and guides the crew in an emergency. It has three modes: Normal (green), Caution (amber) and Emergency (red).

**All data in this app is simulated for demonstration. It is not clinical guidance.**

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

The crew, inventory, cabin readings and procedures are simulated demo records, not clinical guidance. Procedures live in the Mission medical library, where uploads arrive as drafts and only approved versions are used.

## NASA data

Real NASA data is stored in `src/data/snapshots/` so the app works offline. Refresh it with:

```bash
npm run fetch-nasa
```

| Source | Used for | Notes |
| --- | --- | --- |
| NASA CCMC DONKI (via api.nasa.gov) | Solar particle events and geomagnetic storms on the health line, and the space-weather insight | The API allows 60 days per request; with `DEMO_KEY` only the most relevant ranges are fetched. Set `NASA_API_KEY` for full coverage. Events are space-weather reports, never personal dose. |
| NASA OSDR | "The science behind this" for each body system | Each study is labelled as astronauts, human ground study, human cells or tissue, or animal model. Studies are hand-picked per system in `src/data/nasa.ts`. |
| NASA RadLab | Not used yet | The documentation page was down when this was built. |

Health readings, baselines and the astronaut are simulated.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/data/indicators.ts` | Every health indicator: unit, personal normal range, how it is measured on board, why it matters |
| `src/data/missions.ts` | Station, Moon, Mars transit and Mars surface: delay to Earth, gravity, path shape |
| `src/data/simulate.ts` | Simulated health history and the drift score for each day |
| `src/lib/geometry.ts` | Maths for the mission path and the drifting health line |
| `src/components/MissionView.tsx` | The home screen's centre: planets, planned path, your health path, marks, forecast |
| `src/components/SidePanel.tsx` | Today's summary and the body systems list |
| `src/components/TopBar.tsx` | Name, mission picker, mission clock, Earth delay, current mode |
