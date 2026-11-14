import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Eases the camera toward a target view, with a little drift that follows the pointer.
export function CameraRig({ pos, look, speed = 1.4 }: { pos: THREE.Vector3; look: THREE.Vector3; speed?: number }) {
  const { camera, pointer } = useThree();
  const current = useRef(look.clone());
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * speed);
    const dist = pos.distanceTo(look);
    const sway = tmp.current.set(pointer.x * dist * 0.03, pointer.y * dist * 0.02, 0);
    camera.position.lerp(sway.add(pos), k);
    current.current.lerp(look, k);
    camera.lookAt(current.current);
  });
  return null;
}
