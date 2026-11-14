import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { BODIES } from './space';
import { makeMarsTextures } from './textures';

export const SUN_DIR = new THREE.Vector3(-14, 6, 10).normalize();

const EARTH_TEXTURES = [
  '/textures/earth-blue-marble.jpg',
  '/textures/earth-night.jpg',
  '/textures/earth-topology.png',
  '/textures/earth-water.png',
  '/textures/clouds.png',
];
const MOON_TEXTURES = ['/textures/lunar_surface.jpg', '/textures/lunar_bumpmap.jpg'];
// Start loading straight away so Earth is ready while the intro plays.
useTexture.preload(EARTH_TEXTURES);
useTexture.preload(MOON_TEXTURES);

// Soft glow around a planet's edge, brighter where you look across the atmosphere.
function Atmosphere({ radius, color, power = 3, strength = 1 }: { radius: number; color: string; power?: number; strength?: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength } },
        vertexShader: `
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 glowColor; uniform float power; uniform float strength;
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), power);
            gl_FragColor = vec4(glowColor, rim * strength);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color, power, strength],
  );
  return (
    <mesh scale={radius * 1.035}>
      <sphereGeometry args={[1, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// City lights that only show on Earth's night side.
function NightLights({ map }: { map: THREE.Texture }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: map }, sunDir: { value: SUN_DIR } },
        vertexShader: `
          varying vec2 vUv; varying vec3 vWorldNormal;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D map; uniform vec3 sunDir;
          varying vec2 vUv; varying vec3 vWorldNormal;
          void main() {
            float night = smoothstep(0.05, -0.3, dot(vWorldNormal, sunDir));
            vec3 c = texture2D(map, vUv).rgb * vec3(1.0, 0.85, 0.6);
            gl_FragColor = vec4(c * night * 1.4, 1.0);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [map],
  );
  return (
    <mesh scale={1.001}>
      <sphereGeometry args={[1, 96, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export function Earth() {
  const [day, night, topo, water, clouds] = useTexture(EARTH_TEXTURES);
  day.colorSpace = THREE.SRGBColorSpace;
  night.colorSpace = THREE.SRGBColorSpace;
  const spin = useRef<THREE.Group>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.035;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.012;
  });
  return (
    <group position={BODIES.earth.pos} rotation={[0.41, 0, 0]}>
      <group ref={spin} scale={BODIES.earth.r}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshPhongMaterial map={day} bumpMap={topo} bumpScale={0.04} specularMap={water} specular={new THREE.Color('#33475c')} shininess={18} />
        </mesh>
        <NightLights map={night} />
        <mesh ref={cloudRef} scale={1.012}>
          <sphereGeometry args={[1, 96, 96]} />
          <meshPhongMaterial map={clouds} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
      <Atmosphere radius={BODIES.earth.r} color="#6fb3ff" power={2.6} strength={1.25} />
    </group>
  );
}

export function Moon() {
  const [map, bump] = useTexture(MOON_TEXTURES);
  map.colorSpace = THREE.SRGBColorSpace;
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.02; });
  return (
    <mesh ref={ref} position={BODIES.moon.pos} scale={BODIES.moon.r}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={map} bumpMap={bump} bumpScale={0.03} roughness={1} metalness={0} />
    </mesh>
  );
}

export function Mars() {
  const tex = useMemo(() => makeMarsTextures(), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <group position={BODIES.mars.pos} rotation={[0.44, 0, 0]}>
      <mesh ref={ref} scale={BODIES.mars.r}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={tex.map} bumpMap={tex.bumpMap} bumpScale={0.05} roughness={0.95} metalness={0} />
      </mesh>
      <Atmosphere radius={BODIES.mars.r} color="#e8a07a" power={3.2} strength={0.7} />
    </group>
  );
}
