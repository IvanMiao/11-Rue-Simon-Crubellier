import * as THREE from 'three';
import { CAST } from '../cast';
import { PALETTE, TONES } from '../palette';
import { armchair, bentwoodChair, boiler, coalPile, dustSheet, shopCounter, stackedFrames, turnedTable, wardrobe } from '../props';
import { figureCanvas, paperCutout } from '../figures';
import { drawDamier } from '../draw/damier';
import { drawBust } from '../draw/people';
import { CELL_ROOM, type CellScene } from './cellScenes';
import { canvas, harbourTexture, texture } from '../textures';
import { knightPiece } from '../knight';
import { toonMaterial, sectionBox } from '../materials';
import { CELLS, CLINAMEN_CELL } from '../../world/damier';

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  color: string | THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const material = typeof color === 'string' ? toonMaterial(color) : color;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  color: string,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 18), toonMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function place(parent: THREE.Group, object: THREE.Object3D, x: number, z: number, angle = 0) {
  object.position.set(x, 0, z);
  object.rotation.y = angle;
  parent.add(object);
  return object;
}

function roomCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const result = document.createElement('canvas');
  result.width = w;
  result.height = h;
  draw(result.getContext('2d')!);
  return result;
}

function wallCanvas(scene: CellScene) {
  return texture(
    roomCanvas(512, 420, (ctx) => {
      ctx.fillStyle = scene.wall;
      ctx.fillRect(0, 0, 512, 420);
      ctx.strokeStyle = PALETTE.ink;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 3;
      for (let x = 20; x < 512; x += 62) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 420);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = scene.floor;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, 360, 512, 60);
      ctx.globalAlpha = 1;
    })
  );
}

function windowMaterial() {
  return new THREE.MeshBasicMaterial({ color: PALETTE.skyWarm });
}

function wallPanel(g: THREE.Group, scene: CellScene, wall: THREE.Texture) {
  const { W, H, D } = CELL_ROOM;
  const wallZ = -D / 2;
  const [x0, x1, y0, y1] = [-0.82, 0.46, 1.18, 2.52];
  const material = toonMaterial(PALETTE.paper, { map: wall });
  box(g, x0 + W / 2, H, 0.12, material, (-W / 2 + x0) / 2, H / 2, wallZ);
  box(g, W / 2 - x1, H, 0.12, material, (x1 + W / 2) / 2, H / 2, wallZ);
  box(g, x1 - x0, y0, 0.12, material, (x0 + x1) / 2, y0 / 2, wallZ);
  box(g, x1 - x0, H - y1, 0.12, material, (x0 + x1) / 2, (y1 + H) / 2, wallZ);

  const sky = windowMaterial();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.06, y1 - y0 - 0.06), sky);
  pane.position.set((x0 + x1) / 2, (y0 + y1) / 2, wallZ + 0.04);
  pane.userData.noInk = true;
  g.add(pane);

  const frame = PALETTE.linen;
  const frameZ = wallZ + 0.1;
  box(g, x1 - x0 + 0.12, 0.08, 0.12, frame, (x0 + x1) / 2, y1, frameZ);
  box(g, x1 - x0 + 0.12, 0.08, 0.12, frame, (x0 + x1) / 2, y0, frameZ);
  box(g, 0.08, y1 - y0, 0.12, frame, x0, (y0 + y1) / 2, frameZ);
  box(g, 0.08, y1 - y0, 0.12, frame, x1, (y0 + y1) / 2, frameZ);
  box(g, 0.05, y1 - y0, 0.1, frame, (x0 + x1) / 2, (y0 + y1) / 2, frameZ);
  box(g, x1 - x0, 0.05, 0.1, frame, (x0 + x1) / 2, y0 + (y1 - y0) * 0.64, frameZ);
  box(g, x1 - x0 + 0.24, 0.06, 0.2, PALETTE.wood, (x0 + x1) / 2, y0 - 0.05, wallZ + 0.14);
  return sky;
}

function pendant(g: THREE.Group) {
  cylinder(g, 0.018, 0.018, 0.42, PALETTE.ink, 0, 2.78, 0);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 12, 1, true), toonMaterial(PALETTE.brass));
  shade.position.set(0, 2.56, 0);
  shade.castShadow = true;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: PALETTE.light }));
  bulb.position.set(0, 2.48, 0);
  bulb.userData.noInk = true;
  g.add(bulb);
}

function floorRug(g: THREE.Group, color: string, x = 0, z = 0.4) {
  const rug = box(g, 1.5, 0.025, 1.05, color, x, 0.02, z);
  rug.castShadow = false;
  for (const s of [-1, 1]) box(g, 1.5, 0.008, 0.035, PALETTE.brass, x, 0.04, z + s * 0.48).castShadow = false;
}

function smallBook(g: THREE.Group, x: number, y: number, z: number, color: string = TONES.leather) {
  box(g, 0.34, 0.08, 0.26, color, x, y, z);
  box(g, 0.31, 0.012, 0.23, PALETTE.linen, x + 0.01, y + 0.047, z + 0.005);
  box(g, 0.025, 0.084, 0.27, PALETTE.brass, x - 0.15, y, z);
}

function openBook(g: THREE.Group, x: number, y: number, z: number) {
  const book = new THREE.Group();
  box(book, 0.48, 0.035, 0.34, TONES.leather, 0, 0, 0);
  box(book, 0.21, 0.012, 0.29, PALETTE.linen, -0.115, 0.025, 0);
  box(book, 0.21, 0.012, 0.29, PALETTE.paper, 0.115, 0.025, 0);
  box(book, 0.018, 0.016, 0.31, PALETTE.woodDark, 0, 0.028, 0);
  book.position.set(x, y, z);
  book.rotation.z = -0.15;
  g.add(book);
}

function framedCanvas(g: THREE.Group, x: number, y: number, z: number, w: number, h: number, map: THREE.Texture) {
  box(g, w + 0.1, h + 0.1, 0.05, PALETTE.woodDark, x, y, z);
  box(g, w + 0.035, h + 0.035, 0.025, PALETTE.linen, x, y, z + 0.03);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  face.position.set(x, y, z + 0.05);
  face.userData.noInk = true;
  g.add(face);
}

function damierTexture() {
  const cells = roomCanvas(440, 500, (ctx) => {
    ctx.fillStyle = PALETTE.linen;
    ctx.fillRect(0, 0, 440, 500);
    drawDamier(ctx, { cells: CELLS, visited: new Set(), clinamenId: CLINAMEN_CELL }, 36);
  });
  return texture(cells);
}

function portrait(memberId: NonNullable<CellScene['resident']>) {
  const member = CAST[memberId];
  const ctxCanvas = document.createElement('canvas');
  ctxCanvas.width = ctxCanvas.height = 240;
  const ctx = ctxCanvas.getContext('2d')!;
  ctx.filter = 'sepia(1)';
  drawBust(ctx, member, 240);
  ctx.filter = 'none';
  return texture(ctxCanvas);
}

function residentFigure(g: THREE.Group, scene: CellScene, x: number, z: number, height = 1.95) {
  if (!scene.resident) return;
  const member = CAST[scene.resident];
  const f = paperCutout(figureCanvas(member), height, { mirror: scene.kind === 'atelier' });
  f.position.set(x, 0, z);
  f.rotation.y = scene.kind === 'atelier' ? 0.12 : -0.08;
  g.add(f);
}

function dictionaryBoxes(g: THREE.Group) {
  for (let column = 0; column < 3; column += 1) {
    const x = -1.05 + column * 1.05;
    box(g, 0.82, 1.72, 0.12, PALETTE.woodDark, x, 0.88, -1.36);
    for (const y of [0.36, 0.82, 1.28, 1.74]) {
      box(g, 0.88, 0.035, 0.34, PALETTE.wood, x, y, -1.16);
      box(g, 0.72, 0.28, 0.26, TONES.leather, x, y + 0.16, -1.13);
      box(g, 0.64, 0.22, 0.012, PALETTE.linen, x, y + 0.16, -0.99);
      for (let slip = 0; slip < 4; slip += 1) {
        box(g, 0.55, 0.008, 0.012, PALETTE.paper, x, y + 0.09 + slip * 0.045, -0.978);
      }
      box(g, 0.12, 0.09, 0.016, PALETTE.brass, x - 0.27, y + 0.16, -0.965);
    }
  }
}

function mailboxWall(g: THREE.Group) {
  for (let i = 0; i < 7; i += 1) {
    const x = -1.27 + i * 0.42;
    box(g, 0.36, 0.42, 0.14, PALETTE.woodDark, x, 1.55, -1.43);
    box(g, 0.29, 0.16, 0.018, PALETTE.linen, x, 1.64, -1.345);
    box(g, 0.21, 0.018, 0.018, PALETTE.ink, x, 1.62, -1.33);
    box(g, 0.24, 0.045, 0.02, PALETTE.brass, x, 1.44, -1.33);
  }
  box(g, 3.05, 0.12, 0.2, PALETTE.wood, 0, 1.84, -1.43);
  box(g, 3.05, 0.12, 0.2, PALETTE.wood, 0, 1.26, -1.43);
}

function liftCage(g: THREE.Group) {
  box(g, 1.16, 2.42, 0.09, PALETTE.woodDark, 0, 1.22, -1.44);
  box(g, 1.02, 2.24, 0.035, PALETTE.paperDeep, 0, 1.2, -1.38);
  for (const x of [-0.54, -0.28, 0, 0.28, 0.54]) {
    box(g, 0.035, 2.35, 0.06, PALETTE.brass, x, 1.22, -1.31);
  }
  box(g, 0.66, 0.06, 0.08, PALETTE.brass, 0, 2.38, -1.31);
  box(g, 0.66, 0.06, 0.08, PALETTE.brass, 0, 0.08, -1.31);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 24), toonMaterial(PALETTE.brass));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.86, 1.12, -1.25);
  g.add(dial);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 24), toonMaterial(PALETTE.linen));
  face.rotation.x = Math.PI / 2;
  face.position.set(0.86, 1.12, -1.22);
  g.add(face);
  const needle = box(g, 0.018, 0.085, 0.018, PALETTE.brass, 0.86, 1.15, -1.2);
  needle.rotation.z = -0.48;
}

function keyBoard(g: THREE.Group) {
  box(g, 0.66, 0.62, 0.05, PALETTE.woodDark, 1.04, 1.66, -1.42);
  box(g, 0.56, 0.52, 0.025, PALETTE.linen, 1.04, 1.66, -1.385);
  for (let i = 0; i < 5; i += 1) {
    const x = 0.86 + (i % 3) * 0.18;
    const y = 1.78 - Math.floor(i / 3) * 0.24;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 14), toonMaterial(PALETTE.brass));
    ring.position.set(x, y, -1.35);
    g.add(ring);
    cylinder(g, 0.009, 0.009, 0.11, PALETTE.brass, x, y - 0.08, -1.35);
  }
}

function broom(g: THREE.Group, x: number, z: number) {
  const handle = cylinder(g, 0.018, 0.018, 1.22, PALETTE.wood, x, 0.78, z);
  handle.rotation.z = -0.12;
  box(g, 0.34, 0.18, 0.13, TONES.leather, x + 0.07, 0.14, z);
  for (let i = 0; i < 5; i += 1) {
    box(g, 0.025, 0.16, 0.14, PALETTE.linen, x - 0.07 + i * 0.07, 0.13, z + 0.008);
  }
}

function teaCup(g: THREE.Group, x: number, y: number, z: number) {
  cylinder(g, 0.075, 0.06, 0.12, PALETTE.linen, x, y, z);
  cylinder(g, 0.054, 0.054, 0.008, TONES.leather, x, y + 0.065, z);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16), toonMaterial(PALETTE.linen));
  handle.position.set(x + 0.085, y + 0.01, z);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
}

function magnifier(g: THREE.Group, x: number, y: number, z: number) {
  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), toonMaterial(PALETTE.brass));
  lens.position.set(x, y, z);
  lens.rotation.x = Math.PI / 2;
  g.add(lens);
  const handle = cylinder(g, 0.018, 0.018, 0.28, PALETTE.woodDark, x + 0.13, y, z + 0.13);
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = -0.55;
}

function closedFolder(g: THREE.Group, x: number, y: number, z: number) {
  const folder = box(g, 0.36, 0.055, 0.28, TONES.leather, x, y, z);
  folder.rotation.y = -0.14;
  box(g, 0.025, 0.064, 0.29, PALETTE.brass, x - 0.15, y + 0.004, z + 0.005);
}

function colouredWatercolour(seed: number) {
  return texture(canvas(256, 180, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.linen;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = seed % 2 ? PALETTE.skyWarm : PALETTE.sea;
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.68, w * 0.42, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.paperDeep;
    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * (0.4 + (seed % 3) * 0.06), w * 0.24, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }));
}

function bittenEdge(g: THREE.Group) {
  const shape = new THREE.Shape();
  shape.moveTo(-1.3, 0);
  shape.lineTo(-1.3, 0.56);
  shape.lineTo(-0.78, 0.56);
  shape.quadraticCurveTo(-0.56, 0.2, -0.34, 0.56);
  shape.lineTo(0.08, 0.56);
  shape.quadraticCurveTo(0.28, 0.28, 0.48, 0.56);
  shape.lineTo(1.3, 0.56);
  shape.lineTo(1.3, 0);
  shape.closePath();
  const silhouette = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    toonMaterial(PALETTE.ink, { side: THREE.DoubleSide })
  );
  silhouette.position.set(0, 0.02, CELL_ROOM.D / 2 - 0.03);
  g.add(silhouette);
}

function furnish(g: THREE.Group, scene: CellScene, cellId: string) {
  const { kind, seed } = scene;
  switch (kind) {
    case 'stair':
      for (let i = 0; i < 5; i++) {
        box(g, 1.2, 0.12, 0.44, PALETTE.woodDark, -0.82 + i * 0.24, 0.06 + i * 0.17, 0.7 - i * 0.18);
      }
      for (let i = 0; i < 4; i += 1) {
        const x = -0.78 + i * 0.5;
        const y = 0.37 + i * 0.17;
        box(g, 0.055, 0.62, 0.055, PALETTE.wood, x, y, 0.45 - i * 0.14);
      }
      const rail = box(g, 2.05, 0.065, 0.07, PALETTE.wood, 0, 0.84, 0.23);
      rail.rotation.z = 0.34;
      box(g, 0.1, 0.42, 0.08, PALETTE.woodDark, 1.18, 0.24, -0.62);
      box(g, 0.12, 0.18, 0.06, PALETTE.brass, 1.18, 0.45, -0.57);
      box(g, 0.035, 0.12, 0.025, PALETTE.ink, 1.18, 0.45, -0.53);
      if (cellId === '3:6') openBook(g, -0.72, 0.14, 0.7);
      floorRug(g, PALETTE.paperDeep, -0.7, 0.2);
      break;
    case 'hall':
      if (cellId === '0:7') liftCage(g);
      else mailboxWall(g);
      break;
    case 'loge':
      place(g, turnedTable({ w: 1.1, d: 0.62, h: 0.76, color: PALETTE.woodDark }), -0.5, 0.15);
      smallBook(g, -0.45, 0.83, 0.12, PALETTE.accent);
      box(g, 0.78, 0.64, 0.06, PALETTE.paperDeep, -0.82, 1.52, -1.43);
      box(g, 0.7, 0.55, 0.025, PALETTE.linen, -0.82, 1.52, -1.39);
      box(g, 0.035, 0.25, 0.025, PALETTE.ink, -1.06, 1.52, -1.36);
      keyBoard(g);
      broom(g, -1.32, -0.48);
      residentFigure(g, scene, 0.58, -0.12, 1.85);
      break;
    case 'atelier': {
      floorRug(g, TONES.navy, 0.22, 0.26);
      const chair = bentwoodChair({ color: PALETTE.woodDark });
      chair.position.set(0.76, 0, 0.45);
      chair.rotation.y = -0.2;
      g.add(chair);
      const table = turnedTable({ w: 1.35, d: 0.74, h: 0.72, color: PALETTE.wood });
      table.name = 'bartlebooth-worktable';
      table.position.set(-0.2, 0, -0.1);
      g.add(table);
      const harbour = harbourTexture({ puzzle: true });
      box(g, 0.98, 0.026, 0.62, PALETTE.linen, -0.2, 0.756, -0.1);
      const puzzle = new THREE.Mesh(
        new THREE.PlaneGeometry(0.92, 0.56),
        new THREE.MeshBasicMaterial({ map: harbour })
      );
      puzzle.rotation.x = -Math.PI / 2;
      puzzle.position.set(-0.2, 0.772, -0.1);
      puzzle.userData.noInk = true;
      g.add(puzzle);
      const piece = knightPiece(0.22);
      piece.position.set(0.14, 0.8, -0.08);
      g.add(piece);
      teaCup(g, 0.28, 0.84, 0.16);
      magnifier(g, -0.59, 0.84, 0.12);
      residentFigure(g, scene, 0.75, 0.48, 1.7);
      break;
    }
    case 'sill':
      box(g, 1.2, 0.1, 0.46, PALETTE.wood, -0.2, 0.84, -1.28);
      for (let i = 0; i < 2; i += 1) {
        framedCanvas(g, 0.95 + i * 0.42, 1.82, -1.43, 0.34, 0.52, colouredWatercolour(i));
      }
      if (cellId === '3:5') {
        for (let i = 0; i < 5; i += 1) {
          const brush = cylinder(g, 0.018, 0.018, 0.4, [PALETTE.accent, PALETTE.brass, TONES.navy][i % 3], -0.58 + i * 0.18, 0.99, -1.25);
          brush.rotation.z = -0.08 + i * 0.03;
        }
      }
      box(g, 0.32, 0.04, 0.24, PALETTE.paperDeep, 0.75, 0.05, 0.76);
      floorRug(g, PALETTE.paperDeep, 0.48, 0.3);
      break;
    case 'workshop':
      box(g, 0.72, 1.22, 0.08, PALETTE.woodDark, -0.58, 1.74, -1.45);
      framedCanvas(g, -0.58, 1.74, -1.4, 0.52, 0.92, portrait('winckler'));
      if (cellId === '6:8') {
        place(g, turnedTable({ w: 1.58, d: 0.64, h: 0.82, color: PALETTE.woodDark }), -0.38, -0.98);
        for (let i = 0; i < 4; i += 1) {
          const offcut = box(g, 0.34 - i * 0.035, 0.035, 0.075, PALETTE.wood, -0.76 + i * 0.19, 0.86 + i * 0.018, -0.98 + (i % 2) * 0.19);
          offcut.rotation.y = -0.12 + i * 0.08;
        }
        for (const x of [-0.52, -0.19]) {
          cylinder(g, 0.018, 0.018, 0.28, TONES.steel, x, 0.99, -0.99);
        }
        box(g, 0.36, 0.018, 0.02, TONES.steel, -0.355, 1.13, -0.99);
        box(g, 0.32, 0.055, 0.045, PALETTE.wood, -0.355, 0.83, -0.99);
        box(g, 0.045, 0.025, 0.018, TONES.steel, -0.355, 1.07, -0.99);
      } else if (cellId === '6:10') {
        const chair = bentwoodChair({ color: PALETTE.wood });
        chair.position.set(-0.52, 0, 0.64);
        g.add(chair);
      }
      break;
    case 'servant':
      place(g, wardrobe({ w: 0.8, h: 1.9, color: PALETTE.woodDark }), -1.05, -1.08);
      box(g, 1.1, 0.18, 1.7, PALETTE.wood, 0.48, 0.22, -0.72);
      box(g, 1.02, 0.12, 1.58, PALETTE.linen, 0.48, 0.36, -0.72);
      box(g, 0.48, 0.18, 0.38, PALETTE.paperDeep, 0.72, 0.5, -0.9);
      const suitcase = box(g, 0.45, 0.3, 0.3, TONES.leather, -0.25, 0.17, 0.48);
      suitcase.rotation.y = -0.15;
      residentFigure(g, scene, 1.04, 0.18, 1.75);
      break;
    case 'studio': {
      floorRug(g, TONES.graphite, 0.15, 0.35);
      if (cellId === '7:10') {
        const canvasMap = damierTexture();
        framedCanvas(g, -0.82, 1.54, -1.39, 1.05, 1.42, canvasMap);
        const easel = new THREE.Group();
        box(easel, 0.76, 0.08, 0.1, PALETTE.wood, 0, 1.11, 0);
        box(easel, 0.06, 1.55, 0.06, PALETTE.woodDark, 0, 0.87, 0);
        for (const x of [-0.34, 0.34]) {
          const leg = cylinder(easel, 0.025, 0.025, 1.2, PALETTE.wood, x, 0.57, 0.05);
          leg.rotation.z = x * 0.28;
        }
        easel.position.set(-0.15, 0, -0.45);
        g.add(easel);
      }
      residentFigure(g, scene, 0.9, 0.45, 1.9);
      break;
    }
    case 'lab':
      cylinder(g, 0.42, 0.5, 0.92, TONES.steel, -0.25, 0.48, -0.04);
      cylinder(g, 0.32, 0.32, 0.12, PALETTE.brass, -0.25, 0.96, -0.04);
      for (let i = 0; i < 3; i++) {
        const flask = cylinder(g, 0.12, 0.16, 0.48, TONES.glass, 0.55 + i * 0.26, 0.28, -0.55);
        flask.rotation.z = (i - 1) * 0.15;
        cylinder(g, 0.045, 0.045, 0.16, PALETTE.linen, 0.55 + i * 0.26, 0.57, -0.55);
      }
      place(g, turnedTable({ w: 1.1, d: 0.62, h: 0.8, color: PALETTE.woodDark }), 0.45, -0.45);
      magnifier(g, 0.68, 0.84, -0.16);
      residentFigure(g, scene, 1.0, 0.4, 1.9);
      break;
    case 'boiler':
      place(g, boiler(), -0.52, -0.48);
      place(g, coalPile(seed + 21, 48), 0.62, 0.44);
      for (let i = 0; i < 3; i++) cylinder(g, 0.035, 0.035, 1.5, TONES.steel, -1.35 + i * 0.2, 1.0, -1.4);
      break;
    case 'shop':
      place(g, shopCounter({ w: 2.5, seed }), 0, -0.8);
      place(g, dustSheet(armchair({ color: TONES.rose }), { hangFrom: 1.1, seed: seed + 1, flare: 0.08 }), 0.98, 0.3);
      place(g, stackedFrames(seed), -1.03, 0.04);
      box(g, 0.34, 0.028, 0.24, PALETTE.paperDeep, -0.32, 0.97, -0.56);
      box(g, 0.29, 0.012, 0.19, PALETTE.linen, -0.32, 0.991, -0.56);
      box(g, 0.025, 0.034, 0.24, PALETTE.accent, -0.47, 0.97, -0.56);
      break;
    case 'archive':
      dictionaryBoxes(g);
      place(g, turnedTable({ w: 1.15, d: 0.7, h: 0.74, color: PALETTE.wood }), 0, 0.25);
      for (let i = 0; i < 4; i += 1) {
        box(g, 0.4, 0.04, 0.28, PALETTE.linen, -0.36 + i * 0.22, 0.78 + i * 0.045, 0.25);
      }
      break;
    case 'clinamen': {
      bittenEdge(g);
      place(g, turnedTable({ w: 0.98, d: 0.64, h: 0.78, color: PALETTE.woodDark }), 0, 0.08);
      closedFolder(g, 0, 0.82, 0.25);
      break;
    }
    case 'empty': {
      const count = 2 + (seed % 2);
      const options = [
        () => armchair({ color: PALETTE.paperDeep, wood: PALETTE.woodDark }),
        () => turnedTable({ w: 1.05, d: 0.7 }),
        () => wardrobe({ w: 0.88, h: 1.78, color: PALETTE.woodDark }),
        () => stackedFrames(seed),
      ];
      const positions: [number, number][] = [[-0.9, -0.72], [0.65, 0.28], [-0.18, 0.82]];
      for (let i = 0; i < count; i += 1) {
        const pieceIndex = (seed + i * 3) % options.length;
        const piece = options[pieceIndex]();
        const [x, z] = positions[i];
        const display = pieceIndex === 3
          ? piece
          : dustSheet(piece, { hangFrom: pieceIndex === 2 ? 1.85 : 1.1, seed: seed + i, flare: 0.12 });
        place(g, display, x, z);
      }
      break;
    }
  }

}

export function buildCellRoom(scene: CellScene, cellId: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `cell-room:${cellId}`;
  group.userData.cellId = cellId;
  group.userData.kind = scene.kind;
  group.userData.hasPendant = !['sill', 'boiler', 'clinamen'].includes(scene.kind);
  const { W, H, D } = CELL_ROOM;
  const wall = wallCanvas(scene);
  const hasWindow = !['hall', 'workshop', 'boiler', 'archive', 'clinamen'].includes(scene.kind);

  for (const side of [-1, 1]) {
    const wallMesh = sectionBox(0.12, H, D, toonMaterial(scene.wall));
    wallMesh.position.set(side * (W / 2), H / 2, 0);
    group.add(wallMesh);
  }
  const slab = sectionBox(W + 0.12, 0.24, D + 0.14, toonMaterial(PALETTE.floorDark));
  slab.position.set(0, -0.12, 0);
  group.add(slab);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), toonMaterial(scene.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  group.add(floor);
  const window = hasWindow
    ? wallPanel(group, scene, wall)
    : null;
  if (!hasWindow) {
    box(group, W, H, 0.12, toonMaterial(PALETTE.paper, { map: wall }), 0, H / 2, -D / 2);
  }

  box(group, W, 0.12, 0.05, PALETTE.woodDark, 0, 0.06, -D / 2 + 0.04);
  box(group, W, 0.08, 0.06, PALETTE.linen, 0, H - 0.04, -D / 2 + 0.04);
  box(group, 0.05, 0.12, D, PALETTE.woodDark, -W / 2 + 0.03, 0.06, 0);
  box(group, 0.05, 0.12, D, PALETTE.woodDark, W / 2 - 0.03, 0.06, 0);

  if (group.userData.hasPendant) pendant(group);
  furnish(group, scene, cellId);
  group.userData.windowMaterial = window;
  return group;
}
