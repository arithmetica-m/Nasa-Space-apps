import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { MissionId } from '../types';
import { missionOrder, missions } from '../data/missions';
import { labelAnchor, routePoint, routeSamples } from './space';
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
  onHover: (id?: MissionId) => void;
  onPick: (id: MissionId) => void;
}

// The mission choice: every possible route drawn in the same space as the planets.
export function Routes({ active, hovered, chosen, onHover, onPick }: Props) {
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
            {active && !chosen && (
              <Html position={labelAnchor(id)} center zIndexRange={[10, 0]}>
                <button
                  onMouseEnter={() => onHover(id)}
                  onMouseLeave={() => onHover(undefined)}
                  onFocus={() => onHover(id)}
                  onBlur={() => onHover(undefined)}
                  onClick={() => onPick(id)}
                  className={`group whitespace-nowrap border px-3 py-2 text-center backdrop-blur-sm transition duration-300 ${lit ? 'border-gold/80 bg-void/70' : 'border-marble/15 bg-void/40 hover:border-gold/60'}`}
                >
                  <div className={`font-serif text-sm tracking-[0.18em] transition ${lit ? 'text-gold' : 'text-marble'}`}>{missions[id].name.toUpperCase()}</div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.15em] text-mute">
                    {missions[id].totalDays} DAYS · EARTH {missions[id].delayLabel.toUpperCase()} · {missions[id].gravity.toUpperCase()}
                  </div>
                </button>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
