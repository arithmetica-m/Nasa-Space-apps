import * as THREE from 'three';
import type { MissionId } from '../types';

// One shared 3D space. Distances are for readability, not to scale.
export const BODIES = {
  earth: { pos: new THREE.Vector3(0, 0, 0), r: 1 },
  moon: { pos: new THREE.Vector3(7, 0.6, -2.5), r: 0.27 },
  mars: { pos: new THREE.Vector3(24, 1.2, -9), r: 0.53 },
};

const UP = new THREE.Vector3(0, 1, 0);

type Route =
  | { kind: 'ring'; center: THREE.Vector3; radius: number; tilt: number }
  | { kind: 'arc'; curve: THREE.Curve<THREE.Vector3> };

// One parking orbit before departure, with the transfer tangent to the orbit.
// This is an illustrative trajectory in the scene's compressed distances.
class ParkingOrbit extends THREE.Curve<THREE.Vector3> {
  constructor() { super(); }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = Math.PI / 2 - t * Math.PI * 2;
    return target.set(Math.cos(angle) * 1.55, 0, Math.sin(angle) * 1.55)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.38)
      .add(BODIES.earth.pos);
  }
}

function departure(to: { pos: THREE.Vector3; r: number }, lift: number): Route {
  const orbit = new ParkingOrbit();
  const p0 = orbit.getPoint(1);
  const dir = to.pos.clone().sub(p0).normalize();
  const p3 = to.pos.clone().sub(dir.clone().multiplyScalar(to.r * 1.25));
  const c1 = p0.clone().add(new THREE.Vector3(p0.distanceTo(p3) * 0.4, 0, 0));
  const c2 = p0.clone().lerp(p3, 0.72).add(UP.clone().multiplyScalar(lift));
  const curve = new THREE.CurvePath<THREE.Vector3>();
  curve.add(orbit);
  curve.add(new THREE.CubicBezierCurve3(p0, c1, c2, p3));
  return { kind: 'arc', curve };
}

export const ROUTES: Record<MissionId, Route> = {
  iss: { kind: 'ring', center: BODIES.earth.pos, radius: 1.55, tilt: 0.38 },
  moon: departure(BODIES.moon, 2.2),
  'mars-transit': departure(BODIES.mars, 6.5),
  'mars-surface': { kind: 'ring', center: BODIES.mars.pos, radius: 0.95, tilt: 0.3 },
};

// How far a fully drifted day sits from the planned route, per mission (world units).
export const MAX_OFFSET: Record<MissionId, number> = { iss: 0.32, moon: 0.55, 'mars-transit': 1.5, 'mars-surface': 0.22 };

// Point on the planned route, t from 0 (start of mission) to 1 (end).
export function routePoint(id: MissionId, t: number): THREE.Vector3 {
  const r = ROUTES[id];
  if (r.kind === 'arc') return r.curve.getPoint(t);
  const a = t * Math.PI * 2 - Math.PI / 2;
  const p = new THREE.Vector3(Math.cos(a) * r.radius, 0, Math.sin(a) * r.radius);
  p.applyAxisAngle(new THREE.Vector3(1, 0, 0), r.tilt);
  return p.add(r.center);
}

// Direction the health line moves when it drifts: inward on rings, downward on arcs.
export function driftDirection(id: MissionId, t: number): THREE.Vector3 {
  const r = ROUTES[id];
  const p = routePoint(id, t);
  if (r.kind === 'ring') return r.center.clone().sub(p).normalize();
  const tangent = r.curve.getTangent(t).normalize();
  const down = UP.clone().negate();
  return down.sub(tangent.multiplyScalar(down.dot(tangent))).normalize();
}

export function healthPoint(id: MissionId, t: number, drift: number) {
  return routePoint(id, t).add(driftDirection(id, t).multiplyScalar(drift * MAX_OFFSET[id]));
}

export function routeSamples(id: MissionId, n = 240) {
  return Array.from({ length: n + 1 }, (_, i) => routePoint(id, i / n));
}

// Narrow screens need the camera further back to fit the same scene.
const widthFactor = (aspect: number) => Math.max(1, 1.75 / aspect);

// Camera framing that fits a mission's whole route.
export function framing(id: MissionId, aspect = 16 / 9) {
  const box = new THREE.Box3().setFromPoints(routeSamples(id, 60));
  const r = ROUTES[id];
  if (r.kind === 'ring') box.expandByPoint(r.center.clone().add(new THREE.Vector3(0, -r.radius, 0)));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length() * widthFactor(aspect);
  const pos = center.clone().add(new THREE.Vector3(size * 0.05, size * 0.42, size * 0.95));
  return { pos, look: center };
}

// Mission screen backdrop: the mission's main planet sits in the upper right,
// leaving room for the health record below. No route is drawn here.
export function backdropView(id: MissionId, aspect = 16 / 9) {
  const body = id === 'moon' ? BODIES.moon : id === 'iss' ? BODIES.earth : BODIES.mars;
  const r = body.r * widthFactor(aspect);
  return {
    pos: body.pos.clone().add(new THREE.Vector3(-r * 1.6, r * 0.3, r * 5.2)),
    look: body.pos.clone().add(new THREE.Vector3(-r * 1.7, -r * 0.85, 0)),
  };
}

// Fixed camera views for the intro and the mission choice.
export const INTRO_VIEW = { pos: new THREE.Vector3(-0.9, 0.35, 3.1), look: new THREE.Vector3(0.6, 0, 0) };

export function selectView(aspect = 16 / 9) {
  const look = new THREE.Vector3(11.5, 2.4, -4);
  // Tall, narrow screens (phones) step back further so Earth and Mars both stay in view.
  const factor = widthFactor(aspect) * (aspect < 1 ? 1.35 : 1);
  return { pos: look.clone().add(new THREE.Vector3(-0.5, 9, 27).multiplyScalar(factor)), look };
}

// Where each mission's label sits in the mission choice: below its planet or route.
export function labelAnchor(id: MissionId): THREE.Vector3 {
  if (id === 'iss') return BODIES.earth.pos.clone().add(new THREE.Vector3(0, -2.4, 0));
  if (id === 'mars-surface') return BODIES.mars.pos.clone().add(new THREE.Vector3(0, -1.9, 0));
  if (id === 'moon') return BODIES.moon.pos.clone().add(new THREE.Vector3(0, -1.5, 0));
  return routePoint('mars-transit', 0.5).add(new THREE.Vector3(0, -1.2, 0));
}
