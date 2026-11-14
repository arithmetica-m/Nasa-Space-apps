# CHIRON

Health software for astronauts, built for the NASA Space Apps Challenge 2026 ("Create Health Monitoring Software for Astronauts on Space Missions").

CHIRON is a health-support prototype for astronauts. The mission home focuses on crew profiles and general status. Measurement guidance appears when requested, and ACT presents one assigned emergency step at a time.

**This is a demonstration, not a medical device or clinical guidance. Emergency scenarios are hypothetical training examples. They are not NASA-approved procedures.**

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

## Emergencies on several devices

Mission choice and sign-in happen once, the first time CHIRON opens on a device, and are remembered. To switch crew member for a demo, use the settings button (top right). In an emergency each person sees only their own tasks; everyone else appears as live status. Everything (steps, answers, missing equipment, vitals, crew availability, Earth messages) is an event in a shared log, so all devices show the same picture and the plan adapts as things change.

- **Same computer:** open two browser tabs, switch one of them to a different crew member in settings. They sync automatically.
- **Several devices on one network** (phones, tablets):

```bash
npm run relay
npm run dev -- --host
```

Then open the address Vite prints (Network) on each device. The log is also stored on each device, so CHIRON keeps working offline and catches up when reconnected.

The crew, inventory, health readings, and emergency scenarios are simulated. The emergency library demonstrates a draft/approval workflow only; it does not certify procedures for medical use.

## WATCH health-support prototype

Selecting a crew profile opens local-first health tools: selectable health areas over the included body image, manual symptom reports for named or clicked body locations, manual reading entry with time/source/context and unverified-quality labels, short end-of-day reflections, descriptive recent trends, low-confidence projections from simulated records, and hypothetical mission scenarios. Measurement guides open from the related check-in prompt. A simulated Earth-team profile panel demonstrates draft/review metadata; it is not a real upload or approval service. Browser local storage is used for these profile entries; records are not encrypted, synced, or sent to Mission Control by these tools. The app does not cache its assets for offline reload. If storage, the app or a sensor is unavailable, use mission-authorized paper procedures.

Emergency response includes a role-gated, reason-recorded view of the demo crew medical summary. This is a prototype UI workflow, not enforceable authorization or production audit/security. No live sensors, approved medical limits, clinical protocols, individual astronaut baselines, automatic task clearance, or real medical-team upload/approval service is connected. Missing values are shown as unavailable, never as reassuring results.

## Health research

Selected spaceflight biology studies from NASA's Open Science Data Repository (OSDR) are stored in `src/data/snapshots/osdr.json` for offline health education. They provide research context, not patient-specific guidance or emergency procedures. Refresh the metadata with:

```bash
npm run fetch-research
```

| Source | Used for | Notes |
| --- | --- | --- |
| NASA OSDR | "The science behind this" in astronaut health explanations | Studies are labelled by participant/model type and curated by health system. The app's readings and baselines remain simulated. |

## How CHIRON is organised

- **CHIRON CORE** (home): who is on board, how each person is doing (with their CHIRON LINK wearable status), and three doors: **MY HEALTH** (your own dashboard), **PREPARE** (prevent and train: the readiness simulation finds gaps and turns them into practice and actions) and **RESPOND** (emergencies, protocols, medical stock). The mission timeline is clickable and zooms into each stage.
- **Astronaut dashboard**: Health overview (LINK readings, check-in, **Back to your normal** recovery plan built from the person's readings and day schedule, labelled body map), Health history (health line, medical record of the mission) and Mission information, on separate tabs. Personal data appears only on a person's own dashboard.
- **Emergency mode**: one step at a time, required measurements (from LINK or by hand), crew roles with reasons (the crew can change them), handover summary, automatic private reports to Earth.
- **How CHIRON got here**: an optional button under every recommendation, status and plan, showing the data, protocol, resources and logic used. Useful for checking and for training.
- **Levels**: Level 1 works now; Level 2 (LINK wearables, readiness simulation, task suggestions, handover, stock planning, training recommendations, mission medical record) runs on simulated inputs; Level 3 (wearable hardware, CHIRON VISION AR) is concept only. See "About CHIRON and roadmap" in the settings menu.

## Medical library

CHIRON's advice comes from the mission medical library (`src/library/entries.ts`), never from free text generation. Each entry has: what is going on, what to do now, warning signs that mean "start an emergency", extra advice for certain medical histories, onboard equipment, the reasoning, and the NASA sources it is based on. CHIRON matches a reading or symptom to an entry and fits it to the person's medical record (allergies, history, medications) and to who can help them.

- **On board** the library is read-only: open it with LIBRARY on the home screen.
- **Mission Control** changes it: open the app with `?earth` at the end of the address, edit an entry and release it. Every crew device gets the new version through the shared log, and the change history is kept. (Prototype: no real Mission Control sign-in.)

Library content is written for this prototype from public NASA material and contains no medicine doses. A real mission would load its approved medical checklist instead.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/data/indicators.ts` | Every health indicator: unit, personal normal range, how it is measured on board, why it matters |
| `src/data/missions.ts` | Demonstration mission profiles and communication delay |
| `src/data/simulate.ts` | Simulated health history and the drift score for each day |
| `src/data/research.ts` | Curated NASA OSDR health research metadata |
| `src/emergency/` | Simulated emergency scenarios, role assignment, and shared event log |
