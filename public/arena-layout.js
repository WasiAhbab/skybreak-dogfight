// Shared by the scenery, collision checks and radar. All distances are metres.
export function terrainHeight(x, z) {
  const coast = Math.hypot(x / 6600, (z + 1400) / 8100);
  if (coast > 1.025) return -28;
  const shore = Math.max(0, Math.min(1, (1.025 - coast) / .06));
  const hills = Math.max(0, Math.min(1, (-x - 1700) / 2600));
  const ridge = (Math.sin(x * .0017) * Math.cos(z * .0012) + 1.4) * 270;
  return -28 + shore * (70 + hills * ridge);
}

export const runways = [
  {x: -650, z: -350, w: 95, d: 4700},
  {x: 400, z: -350, w: 80, d: 4000},
];
export const roads = [];
for (let x = 1550; x <= 4500; x += 520) roads.push({x, z: -700, w: 27, d: 5400});
for (let z = -3300; z <= 2000; z += 520) roads.push({x: 3110, z, w: 3140, d: 27});
roads.push({x: 1050, z: -300, w: 40, d: 6100}, {x: 150, z: 2850, w: 2400, d: 38});

// Seeded scenery: identical silhouettes and collision bounds on every restart.
let seed = 91429;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
export const buildings = [];
for (let x = 1770; x < 4300; x += 520) {
  for (let z = -3080; z < 2000; z += 520) {
    for (const dx of [-100, 100]) for (const dz of [-100, 100]) {
      const tower = x > 2500 && z < 0 && z > -1800;
      buildings.push({x: x + dx, z: z + dz, w: 85 + random() * 70,
        d: 80 + random() * 75, h: 30 + random() * (tower ? 230 : 80),
        kind: 'city', shade: random()});
    }
  }
}
for (let z = -1800; z <= 1700; z += 550) {
  buildings.push({x: -1450, z, w: 240, d: 190, h: 75, kind: 'hangar', shade: random()});
}
buildings.push({x: 120, z: 1350, w: 110, d: 75, h: 95, kind: 'tower', shade: .2});
buildings.push({x: 125, z: 1050, w: 280, d: 150, h: 44, kind: 'terminal', shade: .8});

// Spatial buckets keep flight and missile collision work independent of city size.
const buckets = new Map(), cellSize = 400;
for (const b of buildings) {
  b.y = terrainHeight(b.x, b.z);
  for (let ix = Math.floor((b.x - b.w / 2) / cellSize); ix <= Math.floor((b.x + b.w / 2) / cellSize); ix++) {
    for (let iz = Math.floor((b.z - b.d / 2) / cellSize); iz <= Math.floor((b.z + b.d / 2) / cellSize); iz++) {
      const key = ix + ':' + iz;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(b);
    }
  }
}
export function collisionHeight(x, z) {
  let top = Math.max(0, terrainHeight(x, z));
  for (const b of buckets.get(Math.floor(x / cellSize) + ':' + Math.floor(z / cellSize)) || []) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) top = Math.max(top, b.y + b.h);
  }
  return top;
}
export function worldSegmentHit(a, b, clearance = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (a.y + (b.y - a.y) * t <= collisionHeight(x, z) + clearance) return true;
  }
  return false;
}
