import * as THREE from 'three';
import { LIGHT_2000, PALETTE, RESIDENTS, Resident } from './palette';
import { inkMaterial, sectionBox, toonMaterial } from './materials';
import {
  bookSpinesTexture,
  canvas,
  clockTexture,
  harbourTexture,
  labelTexture,
  rugTexture,
  texture,
  wallpaperTexture,
  woodFloorTexture,
} from './textures';
import { Pose, figureCanvas, paperCutout } from './figures';
import { knightPiece } from './knight';
import { mulberry32 } from '../utils/rng';

export const ROOM = { W: 6, H: 3, D: 4, wall: 0.16, slab: 0.32 };
export const WINDOW = { x0: -0.55, x1: 0.85, y0: 0.95, y1: 2.55 };

export type RoomKind = 'atelier' | 'workshop' | 'studio' | 'servant' | 'parlor' | 'kitchen' | 'stair' | 'empty';

export interface RoomSpec {
  kind: RoomKind;
  label: string;
  resident?: Resident;
  pose?: Pose;
  seed: number;
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string | THREE.Material, x: number, y: number, z: number) {
  const mat = typeof color === 'string' ? toonMaterial(color) : color;
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, color: string, x: number, y: number, z: number, seg = 20) {
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), toonMaterial(color)));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function texturedPlane(parent: THREE.Object3D, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toonMaterial('#ffffff', { map: tex }));
  m.receiveShadow = true;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function backWall(g: THREE.Group, spec: RoomSpec, wallColor: string) {
  const { W, H, D, wall } = ROOM;
  const { x0, x1, y0, y1 } = WINDOW;
  const r = spec.resident;
  const tex = wallpaperTexture({
    base: wallColor,
    motif: spec.kind === 'atelier' ? PALETTE.wallMotif : shadeHex(wallColor, -0.14),
    width: W,
    height: H,
    gap: spec.kind === 'atelier' ? [W / 2 + 1.95, 1.3] : undefined,
  });
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, H), new THREE.Vector2(-W / 2, H)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
  const paper = new THREE.Mesh(geo, toonMaterial('#ffffff', { map: tex }));
  paper.position.z = -D / 2;
  paper.receiveShadow = true;
  g.add(paper);

  // masonry behind the paper: casts the window-shaped light patch
  const z = -D / 2 - wall / 2 - 0.002;
  const masonry = toonMaterial(shadeHex(wallColor, -0.08));
  box(g, x0 + W / 2, H, wall, masonry, (-W / 2 + x0) / 2, H / 2, z);
  box(g, W / 2 - x1, H, wall, masonry, (x1 + W / 2) / 2, H / 2, z);
  box(g, x1 - x0, y0, wall, masonry, (x0 + x1) / 2, y0 / 2, z);
  box(g, x1 - x0, H - y1, wall, masonry, (x0 + x1) / 2, (y1 + H) / 2, z);

  // casement: frame, mullion, transom, sill
  const fz = -D / 2 - 0.05;
  const paint = PALETTE.linen;
  box(g, x1 - x0, 0.06, 0.08, paint, (x0 + x1) / 2, y1 - 0.03, fz);
  box(g, 0.06, y1 - y0, 0.08, paint, x0 + 0.03, (y0 + y1) / 2, fz);
  box(g, 0.06, y1 - y0, 0.08, paint, x1 - 0.03, (y0 + y1) / 2, fz);
  box(g, 0.045, y1 - y0, 0.06, paint, (x0 + x1) / 2, (y0 + y1) / 2, fz);
  box(g, x1 - x0, 0.045, 0.06, paint, (x0 + x1) / 2, y0 + (y1 - y0) * 0.66, fz);
  box(g, x1 - x0 + 0.24, 0.05, 0.22, paint, (x0 + x1) / 2, y0 - 0.02, -D / 2 + 0.06);
  // balcony rail outside (reads against the sky)
  for (let i = 0; i <= 8; i++) box(g, 0.02, 0.55, 0.02, PALETTE.ink, x0 + ((x1 - x0) * i) / 8, y0 + 0.28 - 0.3, -D / 2 - 0.35);
  box(g, x1 - x0 + 0.1, 0.035, 0.035, PALETTE.ink, (x0 + x1) / 2, y0 + 0.25, -D / 2 - 0.35);

  // skirting + cornice give the room its drawn edges
  box(g, W, 0.14, 0.03, shadeHex(wallColor, -0.25), 0, 0.07, -D / 2 + 0.015);
  box(g, W, 0.09, 0.07, PALETTE.linen, 0, H - 0.045, -D / 2 + 0.035);
  box(g, 0.03, 0.14, D, shadeHex(wallColor, -0.25), -W / 2 + 0.015, 0.07, 0);
  box(g, 0.03, 0.14, D, shadeHex(wallColor, -0.25), W / 2 - 0.015, 0.07, 0);

  if (r && spec.kind !== 'stair') {
    // curtains in the resident's colour
    const cc = spec.kind === 'atelier' ? '#9b2f2a' : shadeHex(r.coat, 0.08);
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x0 - 0.18 : x1 + 0.18;
      for (let f = 0; f < 3; f++) box(g, 0.13, y1 - y0 + 0.5, 0.05, shadeHex(cc, f % 2 ? -0.05 : 0), cx + (f - 1) * 0.11, (y0 + y1) / 2 + 0.1, -D / 2 + 0.08 + (f % 2) * 0.04);
    }
    box(g, x1 - x0 + 0.9, 0.04, 0.04, PALETTE.brass, (x0 + x1) / 2, y1 + 0.32, -D / 2 + 0.1);
  }
}

function shell(g: THREE.Group, spec: RoomSpec) {
  const { W, H, D, wall, slab } = ROOM;
  const r = spec.resident;
  const wallColor = r?.wall ?? PALETTE.plaster;
  const floorColor = r?.floor ?? PALETTE.floor;
  const side = toonMaterial(shadeHex(wallColor, -0.04));
  for (const s of [-1, 1]) {
    const m = sectionBox(wall, H, D + 0.001, side);
    m.position.set(s * (W / 2 + wall / 2), H / 2, 0);
    g.add(m);
  }
  const slabM = sectionBox(W + wall * 2 + 0.001, slab, D + 0.4, toonMaterial('#6b5a4a'));
  slabM.position.set(0, -slab / 2, -0.2);
  g.add(slabM);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    toonMaterial('#ffffff', { map: woodFloorTexture(floorColor, shadeHex(floorColor, -0.2), W, D) })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  g.add(floor);
  backWall(g, spec, wallColor);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.2),
    new THREE.MeshBasicMaterial({ map: labelTexture(spec.label, { w: 1040, h: 80, font: "500 44px 'Noto Serif CJK SC', serif" }) })
  );
  plate.position.set(-W / 2 + 1.45, -slab / 2, D / 2 + 0.002);
  g.add(plate);
}

function table(g: THREE.Group, x: number, z: number, w: number, d: number, color: string, h = 0.78) {
  box(g, w, 0.07, d, color, x, h, z);
  box(g, w - 0.12, 0.1, d - 0.12, shadeHex(color, -0.12), x, h - 0.08, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.07, h - 0.04, 0.07, shadeHex(color, -0.15), x + sx * (w / 2 - 0.08), (h - 0.04) / 2, z + sz * (d / 2 - 0.08));
}

function chair(g: THREE.Group, x: number, z: number, rotY: number, color: string) {
  const c = new THREE.Group();
  box(c, 0.46, 0.05, 0.44, color, 0, 0.46, 0);
  box(c, 0.46, 0.5, 0.05, color, 0, 0.74, -0.2);
  box(c, 0.36, 0.08, 0.02, shadeHex(color, 0.15), 0, 0.86, -0.18);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c, 0.045, 0.46, 0.045, shadeHex(color, -0.15), sx * 0.2, 0.23, sz * 0.19);
  c.position.set(x, 0, z);
  c.rotation.y = rotY;
  g.add(c);
}

function bookshelf(g: THREE.Group, x: number, z: number, w: number, h: number, seed: number, rotY = Math.PI / 2) {
  const s = new THREE.Group();
  const wood = PALETTE.woodDark;
  box(s, w, h, 0.05, wood, 0, h / 2, -0.17);
  for (const sx of [-1, 1]) box(s, 0.05, h, 0.36, wood, sx * (w / 2 - 0.025), h / 2, 0);
  const shelves = 5;
  for (let i = 0; i <= shelves; i++) box(s, w, 0.04, 0.36, wood, 0, 0.06 + (i * (h - 0.1)) / shelves, 0);
  for (let i = 0; i < shelves; i++) {
    const sh = (h - 0.1) / shelves - 0.05;
    const p = texturedPlane(s, bookSpinesTexture(seed + i), w - 0.12, sh, 0, 0.1 + (i * (h - 0.1)) / shelves + sh / 2, 0.06);
    p.castShadow = false;
    box(s, w - 0.12, sh * 0.85, 0.22, '#3a2618', 0, 0.1 + (i * (h - 0.1)) / shelves + sh * 0.42, -0.06);
  }
  s.position.set(x, 0, z);
  s.rotation.y = rotY;
  g.add(s);
}

function framed(g: THREE.Group, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number) {
  box(g, w + 0.12, h + 0.12, 0.05, PALETTE.brass, x, y, z + 0.025);
  box(g, w + 0.02, h + 0.02, 0.02, PALETTE.ink, x, y, z + 0.05);
  texturedPlane(g, tex, w, h, x, y, z + 0.062);
}

function figure(g: THREE.Group, r: Resident, pose: Pose, x: number, z: number, mirror = false, height = 1.72) {
  const f = paperCutout(figureCanvas(r, pose), height, { mirror });
  f.position.set(x, 0, z);
  f.rotation.y = mirror ? 0.12 : -0.12;
  g.add(f);
}

function furnish(g: THREE.Group, spec: RoomSpec) {
  const { W, H, D } = ROOM;
  const r = spec.resident;
  const rng = mulberry32(spec.seed);
  switch (spec.kind) {
    case 'atelier': {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.1), toonMaterial('#ffffff', { map: rugTexture('#24356b', '#9b2f2a') }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(-0.4, 0.006, 0.35);
      rug.receiveShadow = true;
      g.add(rug);
      table(g, -0.45, 0.25, 2.0, 1.15, PALETTE.wood);
      const puzzle = texturedPlane(g, harbourTexture({ puzzle: true, hole: PALETTE.wood }), 1.35, 0.9, -0.5, 0.818, 0.25);
      puzzle.rotation.x = -Math.PI / 2;
      puzzle.rotation.z = 0.06;
      const pieceCols = ['#9cc6e0', PALETTE.sea, '#f5d9a8', '#3f86b5'];
      for (let i = 0; i < 7; i++) {
        const p = box(g, 0.1, 0.012, 0.1, pieceCols[i % 4], 0.35 + rng() * 0.25, 0.822, -0.05 + rng() * 0.6);
        p.rotation.y = rng() * Math.PI;
      }
      // the tea that no longer steams
      cyl(g, 0.11, 0.1, 0.012, PALETTE.linen, -1.25, 0.822, 0.6);
      cyl(g, 0.06, 0.045, 0.08, PALETTE.linen, -1.25, 0.87, 0.6);
      cyl(g, 0.052, 0.052, 0.005, '#8a4a22', -1.25, 0.905, 0.6);
      // magnifier
      cyl(g, 0.07, 0.07, 0.012, PALETTE.brass, 0.35, 0.83, 0.62);
      box(g, 0.18, 0.02, 0.03, PALETTE.woodDark, 0.5, 0.83, 0.68).rotation.y = -0.5;
      chair(g, -1.55, 1.05, Math.PI + 0.7, PALETTE.woodDark);
      chair(g, -1.75, -0.2, Math.PI / 2 - 0.2, PALETTE.woodDark);
      bookshelf(g, -W / 2 + 0.2, -0.7, 1.7, 2.3, 7);
      framed(g, harbourTexture({ puzzle: false, w: 600, h: 400 }), 0.95, 0.63, -1.75, 1.62, -D / 2);
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), toonMaterial('#ffffff', { map: clockTexture() }));
      clock.position.set(1.9, 2.0, -D / 2 + 0.04);
      g.add(clock);
      cyl(g, 0.22, 0.22, 0.03, PALETTE.ink, 1.9, 2.0, -D / 2 + 0.02).rotation.x = Math.PI / 2;
      // radiator under the window
      for (let i = 0; i < 9; i++) box(g, 0.06, 0.55, 0.12, PALETTE.linen, WINDOW.x0 + 0.25 + i * 0.11, 0.42, -D / 2 + 0.12);
      // pendant lamp, unlit
      cyl(g, 0.008, 0.008, 0.8, PALETTE.ink, -0.45, H - 0.4, 0.25, 6);
      cyl(g, 0.05, 0.28, 0.22, '#3d6b4f', -0.45, H - 0.9, 0.25, 32);
      // trunk of finished watercolours by the right wall
      box(g, 1.1, 0.5, 0.6, '#6b4a2e', 2.2, 0.25, -1.2);
      box(g, 1.14, 0.06, 0.64, PALETTE.brass, 2.2, 0.52, -1.2);
      for (let i = 0; i < 4; i++) {
        const sheet = box(g, 0.5, 0.008, 0.36, i % 2 ? PALETTE.linen : '#f2e6c8', 2.0 + i * 0.08, 0.56 + i * 0.01, -1.2 + i * 0.03);
        sheet.rotation.y = (rng() - 0.5) * 0.4;
      }
      figure(g, r!, 'reach', 0.92, 0.35, true);
      const k = knightPiece(0.62);
      k.position.set(-2.25, 0.004, 1.45);
      k.rotation.y = 0.5;
      g.add(k);
      break;
    }
    case 'workshop': {
      box(g, 2.4, 0.08, 0.8, PALETTE.wood, -0.6, 0.9, -1.4);
      for (const sx of [-1, 1]) box(g, 0.1, 0.9, 0.7, PALETTE.woodDark, -0.6 + sx * 1.1, 0.45, -1.4);
      box(g, 0.25, 0.18, 0.2, '#5d6f86', -1.5, 1.03, -1.3);
      box(g, 2.2, 1.0, 0.03, '#d6b98a', -0.9, 1.9, -D / 2 + 0.02).castShadow = false;
      for (let i = 0; i < 7; i++) box(g, 0.04, 0.3 + rng() * 0.3, 0.03, PALETTE.ink, -1.8 + i * 0.3, 1.9, -D / 2 + 0.05);
      for (let i = 0; i < 12; i++) box(g, 0.09, 0.01, 0.09, ['#9cc6e0', '#2e6fa3', '#f5d9a8'][i % 3], -1.4 + rng() * 1.6, 0.945, -1.6 + rng() * 0.4);
      figure(g, r!, 'stand', 0.9, 0.2, true);
      break;
    }
    case 'studio': {
      const e = new THREE.Group();
      box(e, 0.06, 2.0, 0.06, PALETTE.wood, -0.35, 1.0, 0).rotation.z = 0.12;
      box(e, 0.06, 2.0, 0.06, PALETTE.wood, 0.35, 1.0, 0).rotation.z = -0.12;
      box(e, 0.06, 1.9, 0.06, PALETTE.wood, 0, 0.95, -0.4).rotation.x = -0.2;
      box(e, 0.9, 0.04, 0.12, PALETTE.wood, 0, 0.8, 0.04);
      const art = canvas(400, 480, (ctx, w, h) => {
        ctx.fillStyle = PALETTE.linen;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3;
        for (let i = 0; i <= 10; i++) {
          ctx.beginPath();
          ctx.moveTo((i * w) / 10, 0);
          ctx.lineTo((i * w) / 10, h);
          ctx.moveTo(0, (i * h) / 10);
          ctx.lineTo(w, (i * h) / 10);
          ctx.stroke();
        }
        for (let i = 0; i < 26; i++) {
          ctx.fillStyle = ['#24356b', '#c8372d', '#4e8f5a', '#e1b54a', '#7a4c7a'][i % 5];
          ctx.fillRect(Math.floor(rng() * 10) * (w / 10) + 2, Math.floor(rng() * 10) * (h / 10) + 2, w / 10 - 4, h / 10 - 4);
        }
      });
      box(e, 0.84, 1.0, 0.04, PALETTE.linen, 0, 1.34, 0.06);
      texturedPlane(e, texture(art), 0.8, 0.96, 0, 1.34, 0.085);
      e.position.set(-0.7, 0, -0.3);
      e.rotation.y = 0.35;
      g.add(e);
      for (let i = 0; i < 4; i++) {
        const c = box(g, 0.7, 0.9, 0.03, i % 2 ? PALETTE.linen : '#e6d7b5', -2.5 + i * 0.05, 0.45, -1.6 + i * 0.12);
        c.rotation.x = -0.12;
      }
      figure(g, r!, 'paint', 0.55, 0.25, true);
      break;
    }
    case 'servant': {
      box(g, 1.0, 0.45, 2.0, PALETTE.woodDark, -2.2, 0.225, -0.9);
      box(g, 0.94, 0.14, 1.94, PALETTE.linen, -2.2, 0.52, -0.9);
      box(g, 0.7, 0.12, 0.4, '#ffffff', -2.2, 0.64, -1.6);
      box(g, 1.0, 0.9, 0.06, PALETTE.woodDark, -2.2, 0.45, -1.9);
      table(g, 1.3, -1.0, 0.8, 0.6, PALETTE.wood, 0.72);
      cyl(g, 0.04, 0.05, 0.2, '#f0e2c4', 1.3, 0.86, -1.0);
      figure(g, r!, 'tray', -0.2, 0.3);
      break;
    }
    case 'parlor': {
      box(g, 2.0, 0.42, 0.8, r!.coat, 0.6, 0.21, -1.4);
      box(g, 2.0, 0.6, 0.2, shadeHex(r!.coat, -0.08), 0.6, 0.62, -1.75);
      for (const sx of [-1, 1]) box(g, 0.2, 0.62, 0.8, shadeHex(r!.coat, -0.08), 0.6 + sx * 1.0, 0.31, -1.4);
      cyl(g, 0.02, 0.02, 1.5, PALETTE.ink, 2.3, 0.75, -1.5, 6);
      cyl(g, 0.12, 0.28, 0.3, PALETTE.linen, 2.3, 1.6, -1.5, 24);
      table(g, 0.6, -0.4, 0.9, 0.5, PALETTE.wood, 0.45);
      figure(g, r!, 'stand', -1.2, -0.2);
      break;
    }
    case 'kitchen': {
      box(g, 1.2, 0.85, 0.6, '#2c2926', -2.2, 0.425, -1.6);
      box(g, 1.1, 0.03, 0.5, '#5d6f86', -2.2, 0.86, -1.6);
      cyl(g, 0.18, 0.16, 0.22, PALETTE.accent, -2.4, 0.98, -1.6);
      box(g, 1.6, 0.04, 0.3, PALETTE.wood, -1.6, 1.8, -D / 2 + 0.16);
      for (let i = 0; i < 5; i++) cyl(g, 0.07, 0.07, 0.18, ['#e9d3b0', '#c96a4a', '#5d6f86'][i % 3], -2.2 + i * 0.3, 1.91, -D / 2 + 0.16);
      table(g, 0.6, -0.3, 1.4, 0.8, '#b5762a', 0.76);
      chair(g, 0.6, 0.45, Math.PI, PALETTE.woodDark);
      figure(g, r!, 'stand', 1.9, 0.0, true);
      break;
    }
    case 'stair': {
      for (let i = 0; i < 12; i++) box(g, 1.3, 0.25, 0.3, i % 2 ? PALETTE.wood : shadeHex(PALETTE.wood, -0.06), -1.5 + i * 0.32, 0.125 + i * 0.25, -1.2);
      for (let i = 0; i < 12; i++) box(g, 0.02, 0.9, 0.02, PALETTE.ink, -1.5 + i * 0.32, 0.6 + i * 0.25, -0.58);
      const rail = box(g, 4.1, 0.05, 0.05, PALETTE.woodDark, 0.25, 2.0, -0.58);
      rail.rotation.z = Math.atan2(0.25, 0.32);
      break;
    }
    case 'empty': {
      for (let i = 0; i < 4; i++) {
        const w = 0.7 + rng() * 0.9;
        const h = 0.5 + rng() * 0.8;
        const s = box(g, w, h, 0.6 + rng() * 0.5, PALETTE.linen, -2.0 + i * 1.3, h / 2, -1.1 + rng() * 0.6);
        s.rotation.y = (rng() - 0.5) * 0.5;
      }
      break;
    }
  }
}

export function buildRoom(spec: RoomSpec): THREE.Group {
  const g = new THREE.Group();
  g.name = spec.label;
  shell(g, spec);
  furnish(g, spec);
  return g;
}

/** Shaft of 20:00 light from the window to the floor, plus the dust that stopped in it when time froze. */
export function lightBeam(): THREE.Group {
  const { D } = ROOM;
  const { x0, x1, y0, y1 } = WINDOW;
  const dir = new THREE.Vector3(...LIGHT_2000.sunDir).normalize();
  const top = [
    new THREE.Vector3(x0, y1, -D / 2),
    new THREE.Vector3(x1, y1, -D / 2),
    new THREE.Vector3(x1, y0, -D / 2),
    new THREE.Vector3(x0, y0, -D / 2),
  ];
  const project = (p: THREE.Vector3) => p.clone().addScaledVector(dir, -p.y / dir.y);
  const bottom = top.map(project);
  const positions: number[] = [];
  const ts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = top[i];
    const b = top[(i + 1) % 4];
    const c = bottom[(i + 1) % 4];
    const d = bottom[i];
    for (const [p, t] of [[a, 0], [b, 0], [c, 1], [a, 0], [c, 1], [d, 1]] as [THREE.Vector3, number][]) {
      positions.push(p.x, p.y, p.z);
      ts.push(t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('t', new THREE.Float32BufferAttribute(ts, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(PALETTE.light) }, opacity: { value: LIGHT_2000.beamOpacity } },
    vertexShader: 'attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vT; void main(){ gl_FragColor = vec4(color, opacity * (1.0 - vT) * (1.0 - vT)); }',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(geo, mat);
  shaft.userData.noInk = true;
  g.add(shaft);

  const rng = mulberry32(2000);
  const motes: number[] = [];
  for (let i = 0; i < 220; i++) {
    const u = rng();
    const v = rng();
    const p = new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, -D / 2);
    p.lerp(project(p), 0.08 + rng() * 0.85);
    motes.push(p.x, p.y, p.z);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(motes, 3));
  const dot = texture(
    canvas(32, 32, (ctx) => {
      const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,250,230,1)');
      gr.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 32, 32);
    })
  );
  const pts = new THREE.Points(
    mg,
    new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, map: dot, transparent: true, depthWrite: false, opacity: 0.85, blending: THREE.AdditiveBlending })
  );
  pts.userData.noInk = true;
  g.add(pts);
  return g;
}

export interface Building {
  group: THREE.Group;
  /** World-space centre of the 3F atelier at eye height. */
  focus: THREE.Vector3;
  bounds: THREE.Box3;
}

const LAYOUT: RoomSpec[][] = [
  // floor 4
  [
    { kind: 'studio', label: 'IV · 瓦莱纳 · 画室', resident: RESIDENTS.valene, seed: 41 },
    { kind: 'servant', label: 'IV · 斯莫特 · 仆人房', resident: RESIDENTS.smautf, seed: 42 },
    { kind: 'empty', label: 'IV · 空置', seed: 43 },
  ],
  // floor 3
  [
    { kind: 'workshop', label: 'III · 温克勒 · 拼图工坊', resident: RESIDENTS.winckler, seed: 31 },
    { kind: 'atelier', label: 'III · 巴特尔布思 · 工作室', resident: RESIDENTS.bartlebooth, seed: 32 },
    { kind: 'parlor', label: 'III · 马基索夫人 · 客厅', resident: RESIDENTS.marquiseau, seed: 33 },
  ],
  // floor 2
  [
    { kind: 'kitchen', label: 'II · 诺谢尔太太 · 厨房', resident: RESIDENTS.concierge, seed: 21 },
    { kind: 'stair', label: 'II · 楼梯间', seed: 22 },
    { kind: 'empty', label: 'II · 空置', seed: 23 },
  ],
];

export function buildBuilding(): Building {
  const { W, H, wall, slab, D } = ROOM;
  const group = new THREE.Group();
  const sx = W + wall;
  const sy = H + slab;
  LAYOUT.forEach((row, ri) => {
    row.forEach((spec, ci) => {
      const room = buildRoom(spec);
      room.position.set((ci - 1) * sx, (1 - ri) * sy, 0);
      group.add(room);
      const beam = lightBeam();
      beam.position.copy(room.position);
      group.add(beam);
    });
  });
  // roof: slab + zinc mansard + chimneys
  const roofY = sy + H;
  const roofSlab = sectionBox(3 * sx + wall, slab, D + 0.4, toonMaterial('#6b5a4a'));
  roofSlab.position.set(0, roofY + slab / 2, -0.2);
  group.add(roofSlab);
  const mansard = new THREE.Shape([
    new THREE.Vector2(-1.5 * sx - 0.3, 0),
    new THREE.Vector2(1.5 * sx + 0.3, 0),
    new THREE.Vector2(1.5 * sx - 0.5, 1.1),
    new THREE.Vector2(-1.5 * sx + 0.5, 1.1),
  ]);
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(mansard, { depth: D + 0.4, bevelEnabled: false }),
    [toonMaterial(PALETTE.roof), inkMaterial()]
  );
  roof.geometry.translate(0, 0, -(D + 0.4) / 2 - 0.2);
  roof.position.y = roofY + slab;
  shadowed(roof);
  group.add(roof);
  for (const x of [-5.5, -1.2, 4.6]) {
    box(group, 0.5, 0.9, 0.4, '#a2553c', x, roofY + slab + 1.3, -1.2);
  }
  // ground slab under floor 2
  const ground = sectionBox(3 * sx + wall, slab * 1.6, D + 0.4, toonMaterial('#6b5a4a'));
  ground.position.set(0, -sy - slab * 1.3, -0.2);
  group.add(ground);

  const focus = new THREE.Vector3(0, 1.38, 0);
  const bounds = new THREE.Box3().setFromObject(group);
  return { group, focus, bounds };
}

function shadeHex(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}
