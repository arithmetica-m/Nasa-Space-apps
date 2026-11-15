import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { MissionId } from '../types';
import { missionOrder } from '../data/missions';
import { routePoint, routeSamples } from './space';
import { glowTexture } from './textures';
import { palette } from '../lib/theme';

// A small light that travels along a route.
function Pulse({ id, speed }: { id: MissionId; speed: number }) {
  const ref = useRef<THREE.Sprite>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = (t.current + dt * speed) % 1;
    ref.current?.position.copy(routePoint(id, t.current));
  });
  const size = id === 'mars-transit' ? 0.9 : 0.35;
  return (
    <sprite ref={ref} scale={[size, size, size]}>
      <spriteMaterial map={glowTexture()} color={palette.gold} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

interface Props {
  active: boolean;
  hovered?: MissionId;
  chosen?: MissionId;
}

// The mission choice: every possible route drawn in the same space as the planets.
export function Routes({ active, hovered, chosen }: Props) {
  const samples = useMemo(() => Object.fromEntries(missionOrder.map((id) => [id, routeSamples(id, 200)])), []);

  return (
    <group>
      {missionOrder.map((id) => {
        const lit = hovered === id || chosen === id;
        const hidden = !!chosen && chosen !== id;
        if (!active && !chosen) return null;
        return (
          <group key={id}>
            <Line points={samples[id]} color={lit ? palette.gold : palette.marble} lineWidth={lit ? 2.2 : 1}
              transparent opacity={hidden ? 0 : lit ? 0.95 : 0.28} dashed={!lit} dashSize={0.18} gapSize={0.14} />
            {lit && !hidden && <Pulse id={id} speed={chosen ? 0.6 : 0.18} />}
          </group>
        );
      })}
    </group>
  );
}
