# CHIRON

**One connected medical support system for astronauts far from Earth.**
Built for the NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts on Space Missions*.

On a Mars mission a message to Earth takes up to 22 minutes each way, there is no evacuation, and the crew is four people. CHIRON helps that crew stay healthy, prepare, respond to an emergency and recover, using what is already on board. It is named after the healer and teacher of Greek myth.

> **This is a prototype, not a medical device.** All crew, health, wearable and stock data is simulated. Emergency protocols are training scenarios, not NASA-approved procedures. CHIRON guides decisions with approved information; people decide.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints. Choose a mission (try **Mars Transit**) and who uses the device. Then open **▶ DEMONSTRATION** at the bottom of the home screen. Profiles ask for a PIN (see Privacy below).

To see several crew devices working together, open a second browser tab and switch it to another crew member in settings (⚙). On separate devices on one network:

```bash
npm run relay
npm run dev -- --host
```

## Privacy: one shared dashboard, protected profiles

The crew dashboard shows only each person's general status, CHIRON LINK connection and alert count. Medical details live in each astronaut's own profile. A profile locks again every time it is closed, so it asks for that astronaut's PIN on every visit.

| Way in | Who | Logged? |
| --- | --- | --- |
| The astronaut's own PIN | The astronaut | No |
| Medical officer access | A medical officer, with their own PIN | Yes, with name and time |
| Emergency access | Anyone, after choosing a reason | Yes, with name, time and reason, where the owner can see it |

Demo PINs (prototype sign-in, checked in the browser, not real security): Ana `1111`, Lena `2222`, Kai `3333`, Ravi `4444`. They are defined in `src/access/access.ts`.

## Adding a crew member from a file

On the dashboard, **ADD A CREW MEMBER FROM A FILE** loads one JSON crew file. CHIRON checks every required field and lists exactly what is missing; when the file is complete it builds the person's profile, medical record, LINK band, responsibilities and training record. The dialog offers an empty template and shows the format (`src/access/crewFile.ts`):

```json
{
  "format": "chiron-crew-file", "version": 1,
  "id": "mei", "name": "Mei Tanaka", "position": "Payload specialist",
  "qualifications": ["life-support", "comms"], "pin": "5555",
  "medical": { "allergies": [], "medications": [], "history": [], "restrictions": [], "notes": "" },
  "duties": ["Payload operations"],
  "link": { "location": "Laboratory", "activity": "Science experiment" }
}
```

The new member's health history is simulated like the rest of the crew's, and they are stored on the device where the file was loaded.

## Emergency mode

Press **EMERGENCY MODE** on any screen, or turn on the microphone and say **"emergency"**. Two taps start it: who, then what. Every crew device then switches to the live emergency screen:

- **The patient, first:** name, emergency type, EMERGENCY ACTIVE, and URGENT ACTION REQUIRED (missing equipment, measurements still needed, steps waiting for confirmation).
- **Measurements:** each with its time and source; missing ones say NOT AVAILABLE and can be entered on the spot. Simulated LINK readings are labelled.
- **Procedure:** which step the crew is on, who is doing it, and what comes next. Your own step has big DONE / YES / NO buttons and is read aloud.
- **Live updates:** observations, completed steps, role changes and Earth's replies, newest first, each with a time.
- **VIEW CREW ASSIGNMENTS** (always visible): each assigned person's role, responsibility and status (NOT STARTED / IN PROGRESS / COMPLETED), plus who is AVAILABLE or UNAVAILABLE. Tapping a person opens their instructions.

Everyone is notified; only the people needed get a task. The CHIRON LINK page shows what each band displays: TASK ASSIGNED with the role, NO TASK ASSIGNED, or MEDICAL EMERGENCY ACTIVE for the patient. Voice works throughout: "done", "yes", "no", "can't", "repeat".

## The main idea: the Response Planner

Medical advice alone is not the hard part. The hard part is that the right response depends on seven things at once. In an emergency CHIRON connects them into one plan and shows each at the top of the screen:

| Factor | Where it comes from |
| --- | --- |
| The patient's readings | CHIRON LINK wearable or typed in, each with a time and source |
| Their medical record | Allergies, history, medications |
| Mission phase and conditions | Mission timeline, EVA status |
| Equipment on board | Medical stock list, checked against the approved procedure |
| Crew medical skills | Roles, qualifications, training record |
| Who is reachable | LINK connection, location, current activity |
| Communication with Earth | Delay for this mission: "act first" or "ask Earth" |

The plan gives each crew member their own task, says what is missing, never guesses a missing value, and never invents a treatment or an equipment substitute. An optional **How CHIRON got here** button under every recommendation shows the data, rule, protocol and limits used, which also trains the crew in medical reasoning.

## Demo script: one astronaut's mission

The in-app **DEMONSTRATION** page runs these steps; each button opens the real screen.

1. **The problem.** Ana Rocha is the medical officer on Mars Transit, day 214. Earth is 11 minutes away each way.
2. **The preparation.** PREPARE plays every emergency through with this mission's protocols, stock and crew. Each gap becomes an action ("Ana last practised this 130 days ago → practise it now").
3. **The monitoring.** Ana's LINK band sends blood oxygen 89%. CORE receives it, the warning rule breaks, and every device shows a LINK WARNING.
4. **The emergency.** RESPOND opens. The Response Planner picks the approved procedure; Ana is the patient, so the backup medical officer leads.
5. **The coordination.** Each person's band receives their own task. An offline band is shown as "tell them in person". Earth receives automatic private reports.
6. **The recovery.** Ana's daily checklist brings her readings back to her normal, and the medical log records everything.
7. **The future.** The About page shows what works, what is simulated and what is proposed.

## How CHIRON meets the judging criteria

**Impact.** Deep-space crews must handle medical events before Earth can answer. CHIRON turns the crew's own readings, training, stock and procedures into prepared, coordinated action, and reports to Earth automatically. *See: DEMONSTRATION, emergency mode.*

**Creativity.** The Response Planner does not give "AI medical advice". It integrates seven mission factors into one transparent operational plan and explains every step. *See: RESPONSE PLANNER panel in an emergency, "How CHIRON got here".*

**Validity and feasibility.** Runs in a browser and needs no AI service: advice is looked up in a versioned medical library, never generated. Simulated data is labelled, old data is never shown as live, missing data is never estimated, and warning limits are marked as prototype rules. *See: About CHIRON → levels and rules.*

**Relevance.** Every part maps to one of the six exploration medical objectives (table below).

**NASA data integration.** The NASA DATA IN CHIRON page shows, for each source, what kind of thing it is (dataset, standard, research gap, concept), which need it addresses, which CHIRON function uses it and what the crew sees as a result.

**Presentation.** The demonstration follows one astronaut through the mission; the system map and mission dial give the story a recognisable Greek, Antikythera-inspired identity.

### The six medical objectives

| Objective | CHIRON function |
| --- | --- |
| 1. Personalized medicine | Personal baselines for every reading; advice fitted to each medical record; body map; "Report something" symptom checker |
| 2. Independent medical training | PREPARE practice runs built from the approved protocol steps; measurement guides; reasoning shown on request |
| 3. Computer-based decision support | Medical library; emergency mode with step-by-step approved procedures, measurements, roles and handover |
| 4. Fewer medical resources | Stock planning against every approved procedure: missing, last use, expiring before mission end; approved alternatives only |
| 5. Medical risk prediction | Readiness simulation per emergency; health checks before the next mission event; LINK warning rules |
| 6. Rehabilitation | Daily "back to normal" checklist built from the person's readings and schedule; progress timelines |

## What works, what is simulated, what is future

| Works in the prototype | Working simulation (logic runs, inputs simulated) | Future concept (not built) |
| --- | --- | --- |
| CORE home: crew, status, alerts, mission timeline | CHIRON LINK wearables: readings travel to CORE, break a warning rule, alert every device | Physical LINK hardware, haptics, suit integration |
| Astronaut dashboards: overview, history, mission | Band location, battery, emergency button | CHIRON VISION helmet display |
| Daily check-in (type, sync, or say it) | Readiness simulation | Validated predictive models |
| Body map, symptom checker, plain-language advice | Crew task suggestions with reasons | Automated resource intelligence |
| Read-only medical library, changed only by Mission Control | Procedure handover | Adaptive, medically approved rehabilitation |
| Emergency mode on every device, Response Planner overview | Stock planning | More onboard autonomy |
| Automatic private reports to Earth | Training recommendations |  |
| Recovery checklist, medical log, voice commands | Medical log of the mission |  |

## NASA sources: source → CHIRON function → practical output

| Type | Source | CHIRON function | Practical output |
| --- | --- | --- | --- |
| **Dataset** | [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/bio/repo/) | Health insights; library science section | A flagged reading lists the real OSDR studies for that body system. Fetched with `npm run fetch-research`, stored in `src/data/snapshots/osdr.json` |
| Standard | [NASA-STD-3001 Vol. 1, §6 Medical Operations](https://www.nasa.gov/reference/6-0-medical-operations/) | Emergency roles; Earth reports | Medical officer or backup leads; reports are private medical communication, store-and-forward |
| Research gap | [Human Research Roadmap](https://humanresearchroadmap.nasa.gov/) · Medical-401 | Stock planning; readiness simulation | Every approved procedure is checked against mission stock; gaps listed per emergency |
| Research gap | [Human Research Roadmap](https://humanresearchroadmap.nasa.gov/) · Medical-701 | Response Planner | One plan from equipment, training and readings already on board |
| Concept of operations | [EIMO ConOps, NTRS 20250000009](https://ntrs.nasa.gov/citations/20250000009) | Library, LINK, practice, planner | Each EIMO element (reference database, wearables, training tools) has a CHIRON part |
| Research | [EIMO Technical Interchange Meetings, NTRS 20250000057](https://ntrs.nasa.gov/citations/20250000057) | "How CHIRON got here" | Every recommendation shows its data, rule, protocol and limits |
| Research | [Medical capability gaps beyond LEO, NTRS 20230007411](https://ntrs.nasa.gov/citations/20230007411) | Whole system | Mission settings change behaviour: "act first" at Mars, "ask Earth" near Earth |
| Research | [NASA HRP: human spaceflight risks](https://www.nasa.gov/hrp/risks/) | Readings, event checks, recovery checklist | Each tracked reading is tied to a spaceflight hazard |
| Model | [NASA Integrated Medical Model](https://www.nasa.gov/nasa-integrated-medical-model-imm-overview/) | Readiness simulation (proposed) | Future: weight emergencies by likelihood |

Only OSDR is live data. Standards, gaps and concepts are documents that shaped the design; none is presented as a dataset.

## Medical library

CHIRON's advice comes from the mission medical library (`src/library/entries.ts`), never from text generation. Each entry holds what is going on, what to do now, warning signs, extra advice for certain medical histories, the reasoning and its NASA sources. On board it is read-only (LIBRARY in the header). Mission Control changes it: open the app with `?earth` at the end of the address, edit an entry and release it; every crew device receives the new version. Library content is written for this prototype from public NASA material and contains no medicine doses.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/components/MissionDashboard.tsx` | CORE header and home |
| `src/components/pages/` | Dashboard, PREPARE, RESPOND, LINK, NASA data, About, Demonstration |
| `src/components/act/` | Emergency mode and the Response Planner |
| `src/emergency/` | Protocols, role assignment, shared event log, Earth reports |
| `src/library/` | Medical library and personal advice |
| `src/link/` | Simulated wearables and prototype warning rules |
| `src/access/` | Roles, demo PINs and profile access rules |
| `src/triage/` | "Report something" symptom checker |
| `src/prevent/`, `src/train/`, `src/recover/` | Readiness simulation, training, recovery checklist |
| `src/data/` | Indicators, missions, simulated health history, OSDR research snapshot |
