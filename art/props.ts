// A2 prop library: parameterised furniture built from turned, moulded and upholstered parts
// instead of bare boxes. Every prop is a THREE.Group standing on y = 0, centred on x/z = 0, facing +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, TONES } from './palette';
import { toonMaterial } from './materials';
import { mulberry32 } from '../utils/rng';

type Mat = string | THREE.Material;

function mat(m: Mat) {
  return typeof m === 'string' ? toonMaterial(m) : m;
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: Mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat(m));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(p: THREE.Object3D, w: number, h: number, d: number, m: Mat, x = 0, y = 0, z = 0) {
  return add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z);
}

function rounded(p: THREE.Object3D, w: number, h: number, d: number, r: number, m: Mat, x = 0, y = 0, z = 0) {
  return add(p, new RoundedBoxGeometry(w, h, d, 3, r), m, x, y, z);
}

function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, m: Mat, x = 0, y = 0, z = 0, seg = 18) {
  return add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
}

/** Lathe from a [radius, height] profile, bottom to top. */
function turned(p: THREE.Object3D, profile: [number, number][], m: Mat, x = 0, y = 0, z = 0) {
  const pts = profile.map(([r, h]) => new THREE.Vector2(r, h));
  return add(p, new THREE.LatheGeometry(pts, 14), m, x, y, z);
}

export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

/** Turned table leg profile of total height h: ball foot, taper, bead, block under the apron. */
function legProfile(h: number, r: number): [number, number][] {
  return [
    [0.001, 0],
    [r * 0.8, 0.005],
    [r * 1.15, h * 0.04],
    [r * 0.7, h * 0.09],
    [r * 0.55, h * 0.45],
    [r * 0.95, h * 0.55],
    [r * 0.6, h * 0.62],
    [r * 0.75, h * 0.8],
    [r * 1.05, h * 0.82],
    [r * 1.05, h],
    [0.001, h],
  ];
}

export function turnedTable(o: { w: number; d: number; h?: number; color?: string; cloth?: string }) {
  const { w, d, h = 0.78, color = PALETTE.wood } = o;
  const g = new THREE.Group();
  const top = 0.05;
  box(g, w, top, d, color, 0, h - top / 2);
  // moulded edge one step darker, and the apron rails
  box(g, w - 0.04, 0.025, d - 0.04, shade(color, -0.1), 0, h - top - 0.012);
  const ah = 0.11;
  for (const s of [-1, 1]) {
    box(g, w - 0.18, ah, 0.03, shade(color, -0.06), 0, h - top - 0.025 - ah / 2, s * (d / 2 - 0.09));
    box(g, 0.03, ah, d - 0.18, shade(color, -0.06), s * (w / 2 - 0.09), h - top - 0.025 - ah / 2, 0);
  }
  const lh = h - top - 0.025;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(g, legProfile(lh, 0.04), shade(color, -0.14), sx * (w / 2 - 0.09), 0, sz * (d / 2 - 0.09));
  if (o.cloth) {
    // cloth falls a hand's width over the edge
    box(g, w + 0.06, 0.012, d + 0.06, o.cloth, 0, h + 0.006);
    for (const s of [-1, 1]) box(g, w + 0.06, 0.14, 0.012, o.cloth, 0, h - 0.06, s * (d / 2 + 0.03));
  }
  return g;
}

export function bentwoodChair(o: { color?: string } = {}) {
  const c = o.color ?? PALETTE.woodDark;
  const g = new THREE.Group();
  const seatY = 0.46;
  cyl(g, 0.22, 0.22, 0.04, c, 0, seatY, 0, 24);
  cyl(g, 0.2, 0.2, 0.01, PALETTE.linen, 0, seatY + 0.025, 0, 24);
  // splayed legs and the ring between them
  const legs: [number, number][] = [[0.15, 0.15], [-0.15, 0.15], [0.14, -0.14], [-0.14, -0.14]];
  for (const [x, z] of legs) {
    const leg = cyl(g, 0.018, 0.014, seatY, c, x * 1.1, seatY / 2, z * 1.1, 8);
    leg.rotation.set(z * 0.35, 0, -x * 0.35);
  }
  const ring = add(g, new THREE.TorusGeometry(0.17, 0.012, 6, 24), c, 0, 0.2, 0);
  ring.rotation.x = Math.PI / 2;
  // bent back hoop rising from the rear of the seat
  const hoop = add(g, new THREE.TorusGeometry(0.17, 0.016, 8, 24, Math.PI), c, 0, seatY + 0.36, -0.18);
  hoop.scale.y = 1.6;
  for (const s of [-1, 1]) cyl(g, 0.016, 0.016, 0.36, c, s * 0.17, seatY + 0.18, -0.18, 8);
  const inner = add(g, new THREE.TorusGeometry(0.1, 0.012, 6, 20, Math.PI), c, 0, seatY + 0.2, -0.18);
  inner.scale.y = 1.4;
  return g;
}

export function armchair(o: { color: string; wood?: string }) {
  const c = o.color;
  const wood = o.wood ?? PALETTE.woodDark;
  const g = new THREE.Group();
  const W = 0.86;
  const D = 0.8;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(g, legProfile(0.14, 0.03), wood, sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08));
  rounded(g, W, 0.24, D, 0.05, shade(c, -0.08), 0, 0.26, 0);
  rounded(g, W - 0.24, 0.12, D - 0.2, 0.05, c, 0, 0.44, 0.06);
  // back, tilted, with a row of buttons
  const back = rounded(g, W - 0.12, 0.62, 0.18, 0.07, c, 0, 0.72, -D / 2 + 0.1);
  back.rotation.x = -0.12;
  for (let i = 0; i < 3; i++) {
    const b = add(g, new THREE.SphereGeometry(0.018, 8, 6), shade(c, -0.25), -0.2 + i * 0.2, 0.78, -D / 2 + 0.205);
    b.castShadow = false;
  }
  // rolled arms
  for (const s of [-1, 1]) {
    rounded(g, 0.14, 0.26, D - 0.04, 0.05, c, s * (W / 2 - 0.07), 0.5, 0.0);
    const roll = cyl(g, 0.085, 0.085, 0.16, shade(c, 0.06), s * (W / 2 - 0.07), 0.62, D / 2 - 0.06, 16);
    roll.rotation.x = Math.PI / 2;
  }
  // a skirt of brass nails along the front rail
  for (let i = 0; i < 9; i++) {
    const n = add(g, new THREE.SphereGeometry(0.012, 6, 4), PALETTE.brass, -W / 2 + 0.1 + (i * (W - 0.2)) / 8, 0.2, D / 2 + 0.002);
    n.castShadow = false;
  }
  return g;
}

export function wardrobe(o: { w?: number; h?: number; color?: string; mirror?: boolean } = {}) {
  const { w = 1.1, h = 2.05, color = PALETTE.wood } = o;
  const d = 0.55;
  const g = new THREE.Group();
  const dark = shade(color, -0.12);
  box(g, w + 0.04, 0.12, d + 0.04, dark, 0, 0.06);
  box(g, w, h - 0.26, d, color, 0, 0.12 + (h - 0.26) / 2);
  // cornice: two stepped mouldings
  box(g, w + 0.08, 0.06, d + 0.08, dark, 0, h - 0.11);
  box(g, w + 0.16, 0.08, d + 0.12, color, 0, h - 0.04);
  const doorW = w / 2 - 0.05;
  for (const s of [-1, 1]) {
    const x = s * (w / 4);
    // raised panels on each door
    box(g, doorW - 0.08, 0.5, 0.02, shade(color, 0.06), x, 0.5, d / 2 + 0.01);
    if (o.mirror && s > 0) box(g, doorW - 0.12, 0.95, 0.012, TONES.glass, x, 1.32, d / 2 + 0.008);
    else box(g, doorW - 0.08, 0.95, 0.02, shade(color, 0.06), x, 1.32, d / 2 + 0.01);
    for (const y of [0.5, 1.32]) box(g, doorW - 0.16, y === 0.5 ? 0.38 : 0.82, 0.012, shade(color, -0.04), x, y, d / 2 + 0.024).castShadow = false;
    const handle = cyl(g, 0.016, 0.016, 0.1, PALETTE.brass, s * 0.06, 1.0, d / 2 + 0.035, 8);
    handle.castShadow = false;
  }
  box(g, 0.012, h - 0.3, 0.02, PALETTE.ink, 0, 0.12 + (h - 0.26) / 2, d / 2 + 0.006);
  return g;
}

export function boiler() {
  const g = new THREE.Group();
  const body = TONES.coal;
  box(g, 1.05, 0.12, 1.05, PALETTE.floorDark, 0, 0.06);
  cyl(g, 0.46, 0.48, 1.3, body, 0, 0.12 + 0.65, 0, 28);
  const dome = add(g, new THREE.SphereGeometry(0.46, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 1.42, 0);
  dome.scale.y = 0.45;
  // riveted bands
  for (const y of [0.3, 0.9, 1.38]) {
    const band = add(g, new THREE.TorusGeometry(0.475, 0.02, 6, 32), TONES.steel, 0, y, 0);
    band.rotation.x = Math.PI / 2;
  }
  // firebox door with a glowing slit
  box(g, 0.42, 0.34, 0.06, TONES.steel, 0, 0.55, 0.45);
  box(g, 0.32, 0.04, 0.02, PALETTE.accent, 0, 0.5, 0.485).castShadow = false;
  box(g, 0.22, 0.02, 0.02, PALETTE.light, 0, 0.5, 0.49).castShadow = false;
  cyl(g, 0.02, 0.02, 0.1, PALETTE.brass, 0.16, 0.62, 0.5, 8).rotation.z = Math.PI / 2;
  // pressure gauge
  const gauge = cyl(g, 0.1, 0.1, 0.04, PALETTE.brass, 0.18, 1.12, 0.43, 20);
  gauge.rotation.x = Math.PI / 2;
  const face = cyl(g, 0.078, 0.078, 0.01, PALETTE.linen, 0.18, 1.12, 0.455, 20);
  face.rotation.x = Math.PI / 2;
  box(g, 0.012, 0.06, 0.006, PALETTE.accent, 0.2, 1.13, 0.462).rotation.z = -0.8;
  // flue up and back to the wall, and a pipe with a valve wheel
  cyl(g, 0.11, 0.11, 0.7, PALETTE.ink, 0, 1.75, -0.1, 14);
  const elbow = cyl(g, 0.11, 0.11, 0.6, PALETTE.ink, 0, 2.08, -0.38, 14);
  elbow.rotation.x = Math.PI / 2;
  const pipe = cyl(g, 0.045, 0.045, 1.0, TONES.steel, 0.62, 0.85, -0.1, 10);
  pipe.rotation.z = 0;
  cyl(g, 0.045, 0.045, 0.2, TONES.steel, 0.52, 0.35, -0.1, 10).rotation.z = Math.PI / 2;
  const wheel = add(g, new THREE.TorusGeometry(0.08, 0.014, 6, 16), PALETTE.accent, 0.62, 1.0, -0.02);
  wheel.castShadow = false;
  return g;
}

export function coalPile(seed = 13, n = 70) {
  const g = new THREE.Group();
  const rng = mulberry32(seed);
  const coal = toonMaterial(TONES.coal);
  const shine = toonMaterial(shade(TONES.coal, 0.18));
  for (let i = 0; i < n; i++) {
    // heap: lumps fall off a cone
    const a = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 0.6;
    const y = Math.max(0, (0.55 - rad) * 0.9) * (0.6 + rng() * 0.4);
    const s = 0.05 + rng() * 0.06;
    const m = add(g, new THREE.DodecahedronGeometry(s, 0), i % 7 ? coal : shine, Math.cos(a) * rad, y + s * 0.6, Math.sin(a) * rad * 0.8);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  }
  // the shovel left standing in the heap
  const shovel = new THREE.Group();
  box(shovel, 0.2, 0.26, 0.02, TONES.steel, 0, 0.13, 0);
  cyl(shovel, 0.018, 0.018, 0.85, PALETTE.wood, 0, 0.68, 0, 8);
  box(shovel, 0.14, 0.03, 0.03, PALETTE.wood, 0, 1.1, 0);
  shovel.position.set(0.3, 0.12, 0.15);
  shovel.rotation.set(-0.25, 0.4, -0.35);
  g.add(shovel);
  return g;
}

export function shopCounter(o: { w?: number; seed?: number } = {}) {
  const { w = 2.2, seed = 3 } = o;
  const rng = mulberry32(seed);
  const g = new THREE.Group();
  const h = 0.92;
  const d = 0.6;
  const wood = PALETTE.woodDark;
  box(g, w + 0.04, 0.1, d + 0.04, shade(wood, -0.1), 0, 0.05);
  box(g, w, h - 0.16, d, wood, 0, 0.1 + (h - 0.16) / 2);
  // panelled front
  const panels = Math.max(2, Math.round(w / 0.55));
  const pw = w / panels;
  for (let i = 0; i < panels; i++) {
    box(g, pw - 0.1, h - 0.36, 0.02, shade(wood, 0.08), -w / 2 + pw * (i + 0.5), 0.1 + (h - 0.16) / 2, d / 2 + 0.01);
    box(g, pw - 0.18, h - 0.48, 0.012, shade(wood, -0.04), -w / 2 + pw * (i + 0.5), 0.1 + (h - 0.16) / 2, d / 2 + 0.024).castShadow = false;
  }
  box(g, w + 0.1, 0.06, d + 0.1, PALETTE.wood, 0, h - 0.03);
  box(g, w + 0.1, 0.012, 0.012, PALETTE.brass, 0, h - 0.06, d / 2 + 0.056).castShadow = false;
  // glazed vitrine on one end of the top
  const vw = w * 0.5;
  const vx = -w / 2 + vw / 2 + 0.08;
  const glass = toonMaterial(TONES.glass, { transparent: true, opacity: 0.35, depthWrite: false });
  const vit = box(g, vw, 0.32, d - 0.1, glass, vx, h + 0.16, 0);
  vit.castShadow = false;
  vit.userData.noInk = true;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.025, 0.32, 0.025, PALETTE.brass, vx + sx * (vw / 2), h + 0.16, sz * ((d - 0.1) / 2));
  for (const sz of [-1, 1]) for (const y of [h + 0.005, h + 0.32]) box(g, vw, 0.02, 0.025, PALETTE.brass, vx, y, sz * ((d - 0.1) / 2));
  for (const sx of [-1, 1]) for (const y of [h + 0.005, h + 0.32]) box(g, 0.025, 0.02, d - 0.1, PALETTE.brass, vx + sx * (vw / 2), y, 0);
  // curios inside: a vase, a snuffbox, a pocket watch
  turned(g, [[0.001, 0], [0.04, 0.005], [0.06, 0.06], [0.03, 0.14], [0.045, 0.2], [0.001, 0.2]], PALETTE.sea, vx - vw * 0.3, h + 0.01, 0.02);
  box(g, 0.1, 0.04, 0.07, PALETTE.accent, vx, h + 0.03, 0.05).rotation.y = rng();
  const watch = cyl(g, 0.045, 0.045, 0.012, PALETTE.brass, vx + vw * 0.28, h + 0.02, 0.02, 16);
  watch.rotation.x = 0.2;
  // brass bell and a ledger on the open end
  turned(g, [[0.001, 0], [0.06, 0.005], [0.05, 0.03], [0.02, 0.07], [0.008, 0.09], [0.001, 0.09]], PALETTE.brass, w / 2 - 0.25, h, 0.1);
  const ledger = box(g, 0.34, 0.03, 0.24, TONES.leather, w / 2 - 0.6, h + 0.015, 0.02);
  ledger.rotation.y = 0.2;
  box(g, 0.3, 0.008, 0.2, PALETTE.linen, w / 2 - 0.6, h + 0.034, 0.02).rotation.y = 0.2;
  return g;
}

/** Leaning stack of empty frames: tells the room has been cleared out. */
export function stackedFrames(seed = 5) {
  const rng = mulberry32(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const w = 0.5 + rng() * 0.4;
    const h = 0.4 + rng() * 0.4;
    const f = new THREE.Group();
    const col = i % 2 ? PALETTE.brass : PALETTE.woodDark;
    box(f, w, 0.05, 0.03, col, 0, h - 0.025, 0);
    box(f, w, 0.05, 0.03, col, 0, 0.025, 0);
    box(f, 0.05, h, 0.03, col, -w / 2 + 0.025, h / 2, 0);
    box(f, 0.05, h, 0.03, col, w / 2 - 0.025, h / 2, 0);
    f.position.set(i * 0.05, 0, i * 0.07);
    f.rotation.x = -0.14;
    g.add(f);
  }
  return g;
}

/**
 * A dust sheet thrown over a prop: the prop itself recoloured in linen (so its silhouette survives)
 * plus a skirt that hangs from `hangFrom` to the floor with folds.
 */
export function dustSheet(prop: THREE.Object3D, o: { hangFrom: number; seed?: number; flare?: number }) {
  const g = new THREE.Group();
  const sheet = toonMaterial(PALETTE.linen, { side: THREE.DoubleSide });
  const covered = prop.clone(true);
  covered.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.material = sheet;
  });
  covered.scale.multiplyScalar(1.015);
  g.add(covered);

  const bb = new THREE.Box3().setFromObject(prop);
  const rng = mulberry32(o.seed ?? 1);
  const flare = o.flare ?? 0.09;
  const hx = (bb.max.x - bb.min.x) / 2 + 0.015;
  const hz = (bb.max.z - bb.min.z) / 2 + 0.015;
  const cx = (bb.max.x + bb.min.x) / 2;
  const cz = (bb.max.z + bb.min.z) / 2;
  const N = 96;
  const rows = 4;
  const phase = rng() * 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const y = o.hangFrom * (1 - t) + 0.01 * t;
    for (let i = 0; i <= N; i++) {
      // walk the rectangle perimeter with rounded corners
      const a = (i / N) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const k = 1 / Math.max(Math.abs(ca), Math.abs(sa)) ** 0.85;
      const fold = Math.sin(a * 11 + phase) * 0.5 + Math.sin(a * 5 - phase) * 0.5;
      const out = t * t * (flare + fold * 0.035) + Math.abs(fold) * 0.01 * t;
      pos.push(cx + ca * k * hx + ca * out, y, cz + sa * k * hz + sa * out);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < N; i++) {
      const a = r * (N + 1) + i;
      const b = a + N + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const skirt = new THREE.Mesh(geo, sheet);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  g.add(skirt);
  return g;
}

export interface PropEntry {
  id: string;
  label: string;
  build: () => THREE.Object3D;
}

/** Everything in the library, in sheet order. */
export const PROP_LIBRARY: PropEntry[] = [
  { id: 'turned-table', label: '车削腿桌', build: () => turnedTable({ w: 1.3, d: 0.8 }) },
  { id: 'bentwood-chair', label: '曲木椅', build: () => bentwoodChair() },
  { id: 'armchair', label: '软包扶手椅', build: () => armchair({ color: TONES.rose }) },
  { id: 'wardrobe', label: '线脚衣柜', build: () => wardrobe({ mirror: true }) },
  { id: 'boiler', label: '锅炉', build: () => boiler() },
  { id: 'coal', label: '煤堆', build: () => coalPile() },
  { id: 'counter', label: '古董店柜台', build: () => shopCounter() },
  { id: 'sheet-armchair', label: '盖布 · 扶手椅', build: () => dustSheet(armchair({ color: TONES.rose }), { hangFrom: 0.5, seed: 2 }) },
  { id: 'sheet-table', label: '盖布 · 桌', build: () => dustSheet(turnedTable({ w: 1.2, d: 0.75 }), { hangFrom: 0.78, seed: 3, flare: 0.04 }) },
  { id: 'sheet-wardrobe', label: '盖布 · 衣柜', build: () => dustSheet(wardrobe(), { hangFrom: 2.1, seed: 4, flare: 0.06 }) },
];
