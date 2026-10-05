import * as THREE from 'three';
import { drawWindowSilhouette } from '../draw/people';
import { drawDamier, washFor } from '../draw/damier';
import { CAST } from '../cast';
import { CHARCOAL, PALETTE, TYPE } from '../palette';
import { CELL_BY_ID, CELLS, chapterNumeral } from '../../world/damier';
import { cellScene } from './cellScenes';
import {
  cellOrigin3d,
  detailTier,
  SECTION_CELL_IDS,
  SECTION_PITCH,
} from './sectionLayout';
import type { DetailTier } from './sectionLayout';

const ATLAS_SIZE = 2048;
const TILE_SIZE = ATLAS_SIZE / 10;
const TILE_DRAW_SIZE = 320;

export interface FlatsAtlasInput {
  focusCellId: string;
  visited: ReadonlySet<string>;
  lamps: ReadonlySet<string>;
  hour: 20 | 21 | 22 | 23;
  builtRooms: ReadonlySet<string>;
}

export interface FlatsAtlas {
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  refresh(input: FlatsAtlasInput): boolean;
  dispose(): void;
}

function rgba(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function random(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function drawFurniture(ctx: CanvasRenderingContext2D, kind: ReturnType<typeof cellScene>['kind']) {
  ctx.save();
  ctx.strokeStyle = CHARCOAL.line;
  ctx.fillStyle = rgba(CHARCOAL.line, 0.12);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  };

  switch (kind) {
    case 'stair':
      for (let step = 0; step < 6; step += 1) {
        line(60 + step * 34, 245 - step * 24, 108 + step * 34, 245 - step * 24);
      }
      line(60, 245, 260, 105);
      break;
    case 'hall':
      for (let box = 0; box < 4; box += 1) rect(54 + box * 57, 135, 42, 74);
      break;
    case 'boiler':
      ctx.beginPath();
      ctx.arc(165, 170, 63, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      line(165, 107, 165, 48);
      line(165, 232, 218, 270);
      break;
    case 'atelier':
    case 'workshop':
    case 'studio':
    case 'loge':
      rect(78, 180, 168, 30);
      line(96, 210, 86, 275);
      line(226, 210, 238, 275);
      rect(192, 68, 61, 90);
      break;
    case 'servant':
      rect(58, 82, 76, 158);
      rect(164, 180, 105, 40);
      line(175, 220, 170, 278);
      line(258, 220, 265, 278);
      break;
    case 'lab':
      rect(72, 175, 194, 35);
      for (let glass = 0; glass < 3; glass += 1) {
        ctx.beginPath();
        ctx.arc(102 + glass * 60, 137, 17, 0, Math.PI * 2);
        ctx.stroke();
        line(102 + glass * 60, 120, 102 + glass * 60, 83);
      }
      break;
    case 'shop':
      rect(45, 182, 230, 50);
      rect(62, 88, 68, 75);
      rect(150, 110, 106, 51);
      break;
    case 'archive':
      for (let shelf = 0; shelf < 3; shelf += 1) {
        line(50, 83 + shelf * 70, 270, 83 + shelf * 70);
        for (let book = 0; book < 5; book += 1) {
          rect(59 + book * 42, 38 + shelf * 70, 26, 44);
        }
      }
      break;
    case 'sill':
      line(54, 205, 272, 205);
      for (let frame = 0; frame < 3; frame += 1) rect(69 + frame * 66, 80, 47, 97);
      break;
    case 'empty':
    case 'clinamen':
      rect(83, 196, 160, 31);
      line(99, 227, 93, 270);
      line(228, 227, 236, 270);
      break;
  }
  ctx.restore();
}

function tileStyle(tier: DetailTier, visited: boolean, built: boolean): 'room' | 'painted' | 'sketch' | 'void' {
  if (tier === 'void') return 'void';
  if (tier === 'room' && built) return 'room';
  return visited ? 'painted' : 'sketch';
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  cellId: string,
  style: ReturnType<typeof tileStyle>,
  lit: boolean
) {
  const cell = CELL_BY_ID[cellId];
  const scene = cellScene(cellId);
  const row = 8 - cell.floor;
  const column = cell.col - 1;
  const x = column * TILE_SIZE;
  const y = row * TILE_SIZE;
  const scale = TILE_SIZE / TILE_DRAW_SIZE;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);

  if (style === 'room' || style === 'void') {
    ctx.restore();
    return;
  }

  if (style === 'sketch') {
    ctx.fillStyle = PALETTE.linen;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
    ctx.strokeStyle = rgba(CHARCOAL.faint, 0.23);
    ctx.lineWidth = 1;
    for (let p = 22; p < TILE_DRAW_SIZE; p += 24) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, TILE_DRAW_SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(TILE_DRAW_SIZE, p);
      ctx.stroke();
    }
    drawFurniture(ctx, scene.kind);
    if (cell.chapter) {
      ctx.fillStyle = CHARCOAL.number;
      ctx.font = `bold 33px ${TYPE.mono}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(chapterNumeral(cell.chapter), 17, 13);
    }
    ctx.strokeStyle = rgba(CHARCOAL.line, 0.55);
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, TILE_DRAW_SIZE - 12, TILE_DRAW_SIZE - 12);
  } else {
    ctx.fillStyle = scene.wall;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
    const wash = washFor(cell.apartmentId);
    const randomize = random(cellId);
    ctx.save();
    ctx.fillStyle = wash;
    for (let pass = 0; pass < 6; pass += 1) {
      const inset = 8 + randomize() * 18;
      const offset = (randomize() - 0.5) * 32;
      ctx.globalAlpha = 0.12 + randomize() * 0.08;
      ctx.beginPath();
      ctx.moveTo(inset, 20 + offset);
      ctx.lineTo(TILE_DRAW_SIZE - inset, 9 + offset);
      ctx.lineTo(TILE_DRAW_SIZE - 10 + offset, 235 + offset);
      ctx.lineTo(TILE_DRAW_SIZE * 0.55, 222 + offset);
      ctx.lineTo(12, 257 + offset);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = scene.floor;
    ctx.globalAlpha = 0.54;
    ctx.fillRect(0, 264, TILE_DRAW_SIZE, 56);
    ctx.globalAlpha = 1;
    drawFurniture(ctx, scene.kind);
    if (scene.resident) {
      const resident = CAST[scene.resident];
      const silhouetteCanvas = document.createElement('canvas');
      silhouetteCanvas.width = 77;
      silhouetteCanvas.height = 110;
      const silhouetteContext = silhouetteCanvas.getContext('2d');
      if (silhouetteContext) {
        drawWindowSilhouette(silhouetteContext, resident, 77, 110);
        ctx.drawImage(silhouetteCanvas, 221, 25);
      }
    }
    if (cell.chapter) {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 29px ${TYPE.mono}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(chapterNumeral(cell.chapter), 15, 12);
    }
    ctx.strokeStyle = rgba(PALETTE.ink, 0.48);
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, TILE_DRAW_SIZE - 10, TILE_DRAW_SIZE - 10);
  }

  if (lit) {
    const glow = ctx.createRadialGradient(160, 120, 3, 160, 120, 140);
    glow.addColorStop(0, rgba(PALETTE.light, 0.58));
    glow.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
  }
  ctx.restore();
}

function buildWallGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const cellId of SECTION_CELL_IDS) {
    const cell = CELL_BY_ID[cellId];
    const [x, floorY, z] = cellOrigin3d(cellId);
    const x0 = x - 1.7;
    const x1 = x + 1.7;
    const y0 = floorY;
    const y1 = floorY + 3;
    const zPlane = z - 1.63;
    const first = positions.length / 3;
    positions.push(
      x0, y0, zPlane,
      x1, y0, zPlane,
      x0, y1, zPlane,
      x1, y1, zPlane
    );
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    const u0 = (cell.col - 1 + 1 / TILE_SIZE) / 10;
    const u1 = (cell.col - 1 + 1 - 1 / TILE_SIZE) / 10;
    const row = 8 - cell.floor;
    const v0 = (9 - row + 1 / TILE_SIZE) / 10;
    const v1 = (10 - row - 1 / TILE_SIZE) / 10;
    uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
    indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function createFlatsAtlas(initial: FlatsAtlasInput): FlatsAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(buildWallGeometry(), material);
  mesh.name = 'building-flats-atlas';
  mesh.renderOrder = -2;

  const rendered = new Map<string, string>();
  function refresh(input: FlatsAtlasInput): boolean {
    let changed = false;
    for (const cellId of SECTION_CELL_IDS) {
      const tier = detailTier(cellId, input.focusCellId, input.visited);
      const style = tileStyle(tier, input.visited.has(cellId), input.builtRooms.has(cellId));
      const lit = input.hour >= 22 && input.lamps.has(cellId);
      const key = `${style}:${lit}`;
      if (rendered.get(cellId) === key) continue;
      drawTile(ctx, cellId, style, lit);
      rendered.set(cellId, key);
      changed = true;
    }
    if (changed) texture.needsUpdate = true;
    return changed;
  }

  refresh(initial);
  return {
    texture,
    mesh,
    refresh,
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
      rendered.clear();
    },
  };
}
