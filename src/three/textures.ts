import * as THREE from 'three';

// Small seeded value noise, enough for a believable Mars surface without an image file.
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t: number) => t * t * (3 - 2 * t);
  const h = (x: number, y: number, z: number) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const c = (dx: number, dy: number, dz: number) => h(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
      zf,
    );
  };
}

// Mars colour and bump maps, sampled on the sphere so there is no seam.
export function makeMarsTextures() {
  const W = 1024, H = 512;
  const noise = makeNoise(7);
  const fbm = (x: number, y: number, z: number, oct: number) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f, z * f); amp *= 0.5; f *= 2.03; }
    return v;
  };
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = W;
  color.height = bump.height = H;
  const ci = color.getContext('2d')!.createImageData(W, H);
  const bi = bump.getContext('2d')!.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const lat = (y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const sx = Math.sin(lat) * Math.cos(lon) * 2.2 + 10, sy = Math.cos(lat) * 2.2 + 10, sz = Math.sin(lat) * Math.sin(lon) * 2.2 + 10;
      const base = fbm(sx, sy, sz, 6);
      const dark = fbm(sx * 0.6 + 4, sy * 0.6, sz * 0.6, 4);
      const crater = fbm(sx * 4, sy * 4, sz * 4, 3);
      let r = 176 + (base - 0.5) * 120, g = 92 + (base - 0.5) * 70, b = 58 + (base - 0.5) * 40;
      const shade = Math.max(0, (dark - 0.5) * 2.4);
      r -= shade * 70; g -= shade * 42; b -= shade * 22;
      const ice = Math.min(1, Math.max(0, (Math.abs(Math.cos(lat)) - 0.9) * 10 + (base - 0.5) * 2));
      r = r * (1 - ice) + 235 * ice; g = g * (1 - ice) + 228 * ice; b = b * (1 - ice) + 222 * ice;
      const i = (y * W + x) * 4;
      ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
      const hgt = (base * 0.6 + crater * 0.4) * 255;
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = hgt; bi.data[i + 3] = 255;
    }
  }
  color.getContext('2d')!.putImageData(ci, 0, 0);
  bump.getContext('2d')!.putImageData(bi, 0, 0);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap: new THREE.CanvasTexture(bump) };
}

// Soft round glow used for markers and light pulses.
let glow: THREE.CanvasTexture | undefined;
export function glowTexture() {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  return glow;
}
