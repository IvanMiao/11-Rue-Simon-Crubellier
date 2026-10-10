import * as THREE from 'three';
import { drawWindowSilhouette } from '../draw/people';
import { drawDamier, washFor } from '../draw/damier';
import { CAST } from '../cast';
import { CHARCOAL, HOUR_LIGHT, PALETTE, TYPE } from '../palette';
import { CELL_BY_ID, CELLS, chapterNumeral } from '../../world/damier';
import { cellScene } from './cellScenes';
import {
  cellOrigin3d,
  detailTier,
  SECTION_CELL_IDS,
  SECTION_PITCH,
} from './sectionLayout';
import type { DetailTier, SectionView } from './sectionLayout';

const ATLAS_SIZE = 4096;
const TILE_SIZE = ATLAS_SIZE / 10;
const TILE_DRAW_SIZE = 512;

export interface FlatsAtlasInput {
  focusCellId: string;
  visited: ReadonlySet<string>;
  lamps: ReadonlySet<string>;
  hour: 20 | 21 | 22 | 23;
  view: SectionView;
  builtRooms: ReadonlySet<string>;
  priorityCellIds?: ReadonlySet<string>;
}

export interface FlatsAtlas {
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  refresh(input: FlatsAtlasInput): boolean;
  fadeTile(cellId: string, started: number, duration: number): boolean;
  updateFades(now: number): boolean;
  hasFades(): boolean;
  stats(): { drawMs: number; pendingTiles: number };
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

type FurnitureItem =
  | 'bed'
  | 'wardrobe'
  | 'piano'
  | 'bookshelf'
  | 'armchair'
  | 'round-table'
  | 'rug'
  | 'pictures'
  | 'standing-lamp'
  | 'desk'
  | 'curtains';

const FURNITURE: FurnitureItem[] = [
  'bed', 'wardrobe', 'piano', 'bookshelf', 'armchair',
  'round-table', 'rug', 'pictures', 'standing-lamp', 'desk', 'curtains',
];

const KIND_FURNITURE: Partial<Record<ReturnType<typeof cellScene>['kind'], FurnitureItem[]>> = {
  stair: ['rug', 'pictures', 'standing-lamp'],
  hall: ['pictures', 'standing-lamp', 'wardrobe'],
  loge: ['round-table', 'wardrobe', 'armchair'],
  atelier: ['piano', 'rug', 'pictures'],
  sill: ['round-table', 'pictures', 'curtains'],
  workshop: ['desk', 'bookshelf', 'standing-lamp'],
  servant: ['bed', 'wardrobe', 'rug'],
  studio: ['desk', 'pictures', 'standing-lamp'],
  lab: ['desk', 'bookshelf', 'standing-lamp'],
  boiler: ['wardrobe', 'rug', 'standing-lamp'],
  shop: ['desk', 'bookshelf', 'pictures'],
  archive: ['bookshelf', 'desk', 'pictures'],
  clinamen: ['rug', 'pictures', 'standing-lamp'],
  empty: ['armchair', 'round-table', 'pictures'],
};

function furnitureLayouts(): Map<string, FurnitureItem[]> {
  const layouts = new Map<string, FurnitureItem[]>();
  const sorted = [...SECTION_CELL_IDS].sort((a, b) => {
    const first = CELL_BY_ID[a];
    const second = CELL_BY_ID[b];
    return second.floor - first.floor || first.col - second.col;
  });
  for (const cellId of sorted) {
    const cell = CELL_BY_ID[cellId];
    const scene = cellScene(cellId);
    const choose = random(`${cellId}:${scene.kind}:${scene.seed}`);
    const preferred = KIND_FURNITURE[scene.kind] ?? [];
    const shuffled = [...FURNITURE];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(choose() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const count = 2 + Math.floor(choose() * 3);
    const layout = [...preferred.slice(0, count)];
    for (const item of shuffled) {
      if (layout.length >= count) break;
      if (!layout.includes(item)) layout.push(item);
    }
    const neighbors = [
      layouts.get(`${cell.floor}:${cell.col - 1}`),
      layouts.get(`${cell.floor + 1}:${cell.col}`),
    ];
    let attempts = 0;
    while (
      neighbors.some((other) => other && other.join('|') === layout.join('|')) &&
      attempts < FURNITURE.length
    ) {
      const index = attempts % layout.length;
      const replacement = shuffled[(attempts + count) % shuffled.length];
      if (!layout.includes(replacement)) layout[index] = replacement;
      else layout.push(layout.shift()!);
      attempts += 1;
    }
    layouts.set(cellId, layout);
  }
  return layouts;
}

function drawFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  x: number,
  y: number,
  size: number,
  rand: () => number,
  sketch: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.strokeStyle = sketch ? CHARCOAL.line : PALETTE.ink;
  ctx.fillStyle = sketch ? rgba(CHARCOAL.line, 0.08) : rgba(PALETTE.wood, 0.46);
  ctx.lineWidth = sketch ? 0.025 : 0.03;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const point = (value: number) => value + (sketch ? (rand() - 0.5) * 0.035 : 0);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(point(x1), point(y1));
    ctx.lineTo(point(x2), point(y2));
    ctx.stroke();
  };
  const rect = (x0: number, y0: number, width: number, height: number) => {
    ctx.beginPath();
    if (sketch) {
      ctx.moveTo(point(x0), point(y0));
      ctx.lineTo(point(x0 + width), point(y0));
      ctx.lineTo(point(x0 + width), point(y0 + height));
      ctx.lineTo(point(x0), point(y0 + height));
      ctx.closePath();
    } else {
      ctx.rect(x0, y0, width, height);
    }
    ctx.fill();
    ctx.stroke();
  };
  switch (item) {
    case 'bed':
      rect(0.08, 0.36, 0.84, 0.42);
      rect(0.08, 0.23, 0.84, 0.17);
      rect(0.15, 0.28, 0.24, 0.09);
      line(0.14, 0.78, 0.12, 0.98);
      line(0.87, 0.78, 0.89, 0.98);
      break;
    case 'wardrobe':
      rect(0.2, 0.06, 0.62, 0.88);
      line(0.51, 0.08, 0.51, 0.92);
      line(0.46, 0.48, 0.46, 0.53);
      line(0.56, 0.48, 0.56, 0.53);
      break;
    case 'piano':
      rect(0.08, 0.29, 0.84, 0.3);
      line(0.12, 0.3, 0.12, 0.82);
      line(0.88, 0.3, 0.88, 0.82);
      line(0.08, 0.28, 0.25, 0.12);
      for (let key = 0; key < 7; key += 1) line(0.19 + key * 0.09, 0.3, 0.19 + key * 0.09, 0.48);
      break;
    case 'bookshelf':
      rect(0.11, 0.08, 0.78, 0.84);
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const top = 0.3 + shelf * 0.2;
        line(0.13, top, 0.87, top);
        for (let book = 0; book < 4; book += 1) {
          line(0.2 + book * 0.16, top - 0.02, 0.2 + book * 0.16, top - 0.16 - rand() * 0.05);
        }
      }
      break;
    case 'armchair':
      rect(0.2, 0.22, 0.6, 0.43);
      rect(0.12, 0.28, 0.16, 0.42);
      rect(0.72, 0.28, 0.16, 0.42);
      line(0.25, 0.65, 0.21, 0.93);
      line(0.75, 0.65, 0.79, 0.93);
      break;
    case 'round-table':
      ctx.beginPath();
      ctx.ellipse(0.5, 0.38, 0.4, 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      line(0.3, 0.45, 0.25, 0.91);
      line(0.7, 0.45, 0.75, 0.91);
      break;
    case 'rug':
      ctx.beginPath();
      ctx.ellipse(0.5, 0.56, 0.44, 0.27, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let stripe = 0; stripe < 4; stripe += 1) {
        line(0.2 + stripe * 0.2, 0.42, 0.2 + stripe * 0.2, 0.7);
      }
      break;
    case 'pictures':
      rect(0.06, 0.18, 0.38, 0.55);
      rect(0.54, 0.08, 0.38, 0.44);
      line(0.25, 0.18, 0.25, 0.73);
      line(0.54, 0.3, 0.92, 0.3);
      break;
    case 'standing-lamp':
      ctx.beginPath();
      ctx.moveTo(0.3, 0.45);
      ctx.lineTo(0.7, 0.45);
      ctx.lineTo(0.62, 0.17);
      ctx.lineTo(0.38, 0.17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      line(0.5, 0.45, 0.5, 0.91);
      line(0.35, 0.93, 0.65, 0.93);
      break;
    case 'desk':
      rect(0.08, 0.3, 0.84, 0.13);
      line(0.17, 0.43, 0.14, 0.94);
      line(0.83, 0.43, 0.86, 0.94);
      rect(0.62, 0.45, 0.22, 0.23);
      break;
    case 'curtains':
      line(0.12, 0.1, 0.88, 0.1);
      ctx.beginPath();
      ctx.moveTo(0.16, 0.14);
      ctx.quadraticCurveTo(0.38, 0.35, 0.24, 0.87);
      ctx.lineTo(0.16, 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.84, 0.14);
      ctx.quadraticCurveTo(0.62, 0.35, 0.76, 0.87);
      ctx.lineTo(0.84, 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

const WINDOWLESS_KINDS = new Set(['hall', 'workshop', 'boiler', 'archive', 'clinamen']);

function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  apartmentId: string,
  sketch: boolean,
  rand: () => number
) {
  const ink = sketch ? CHARCOAL.line : PALETTE.ink;
  ctx.save();
  ctx.lineWidth = sketch ? 5 : 7;
  ctx.strokeStyle = ink;
  ctx.fillStyle = sketch ? rgba(CHARCOAL.line, 0.035) : rgba(PALETTE.skyWarm, 0.34);
  const width = size * 0.78;
  const height = size * 0.73;
  const left = x + size * 0.11;
  const top = y + size * 0.12;
  ctx.fillRect(left, top, width, height);
  if (sketch) {
    const wobble = () => (rand() - 0.5) * 5;
    ctx.beginPath();
    ctx.moveTo(left + wobble(), top + wobble());
    ctx.lineTo(left + width + wobble(), top + wobble());
    ctx.lineTo(left + width + wobble(), top + height + wobble());
    ctx.lineTo(left + wobble(), top + height + wobble());
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(left, top, width, height);
  }
  ctx.beginPath();
  ctx.moveTo(left + width / 2 + (sketch ? (rand() - 0.5) * 5 : 0), top);
  ctx.lineTo(left + width / 2, top + height);
  ctx.moveTo(left, top + height * 0.55);
  ctx.lineTo(left + width, top + height * 0.55);
  ctx.stroke();
  ctx.restore();
  const curtainColor = [PALETTE.wallMotif, PALETTE.paperDeep, PALETTE.castWallRose][
    apartmentHash(apartmentId) % 3
  ];
  drawFurnitureItem(ctx, 'curtains', x, y + size * 0.03, size, rand, sketch);
  if (!sketch) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = curtainColor;
    ctx.fillRect(left - size * 0.04, top, size * 0.13, height * 1.05);
    ctx.fillRect(left + width - size * 0.09, top, size * 0.13, height * 1.05);
    ctx.restore();
  }
}

function apartmentHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function tileStyle(tier: DetailTier, visited: boolean, built: boolean): 'room' | 'painted' | 'sketch' | 'void' {
  if (tier === 'void') return 'void';
  if (tier === 'room' && built) return 'room';
  return visited ? 'painted' : 'sketch';
}

function drawWallpaper(
  ctx: CanvasRenderingContext2D,
  color: string,
  apartmentId: string,
  rand: () => number,
  sketch: boolean
) {
  const pattern = apartmentHash(apartmentId) % 3;
  ctx.save();
  ctx.strokeStyle = sketch ? rgba(CHARCOAL.faint, 0.2) : rgba(color, 0.32);
  ctx.fillStyle = sketch ? rgba(CHARCOAL.faint, 0.11) : rgba(color, 0.32);
  ctx.lineWidth = 2.5;
  if (pattern === 0) {
    for (let x = 18; x < TILE_DRAW_SIZE; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x + (sketch ? rand() * 4 : 0), 0);
      ctx.lineTo(x - (sketch ? rand() * 3 : 0), 428);
      ctx.stroke();
    }
  } else if (pattern === 1) {
    for (let y = 28; y < 430; y += 42) {
      for (let x = 27; x < TILE_DRAW_SIZE; x += 46) {
        const radius = 2.5 + rand() * 2;
        ctx.beginPath();
        ctx.arc(x + (y % 2 ? 20 : 0), y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    for (let x = 17; x < TILE_DRAW_SIZE - 12; x += 96) {
      ctx.strokeRect(x, 22, 78, 398);
      ctx.beginPath();
      ctx.moveTo(x + 8, 35);
      ctx.lineTo(x + 70, 35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSketchHatching(ctx: CanvasRenderingContext2D, rand: () => number) {
  ctx.save();
  ctx.strokeStyle = rgba(CHARCOAL.faint, 0.24);
  ctx.lineWidth = 1.6;
  for (let pass = 0; pass < 12; pass += 1) {
    const x = 15 + rand() * 480;
    const y = 320 + rand() * 165;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18 + rand() * 20, y - 16 - rand() * 13);
    ctx.stroke();
  }
  ctx.restore();
}

function applyHourLight(ctx: CanvasRenderingContext2D, hour: FlatsAtlasInput['hour']) {
  const light = HOUR_LIGHT[hour];
  const radians = ((light.angle - 90) * Math.PI) / 180;
  const dx = Math.cos(radians) * TILE_DRAW_SIZE;
  const dy = Math.sin(radians) * TILE_DRAW_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const shade = ctx.createLinearGradient(
    TILE_DRAW_SIZE / 2 - dx / 2,
    TILE_DRAW_SIZE / 2 - dy / 2,
    TILE_DRAW_SIZE / 2 + dx / 2,
    TILE_DRAW_SIZE / 2 + dy / 2
  );
  shade.addColorStop(0, rgba(light.shade, light.strength * 0.55));
  shade.addColorStop(0.55, rgba(light.shade, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
  const tint = ctx.createLinearGradient(
    TILE_DRAW_SIZE / 2 + dx / 2,
    TILE_DRAW_SIZE / 2 + dy / 2,
    TILE_DRAW_SIZE / 2 - dx / 2,
    TILE_DRAW_SIZE / 2 - dy / 2
  );
  tint.addColorStop(0, rgba(light.tint, light.strength));
  tint.addColorStop(0.7, rgba(light.tint, 0));
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
  ctx.fillStyle = rgba(light.shade, light.night);
  ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
  ctx.restore();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  cellId: string,
  style: ReturnType<typeof tileStyle>,
  lit: boolean,
  hour: FlatsAtlasInput['hour'],
  layouts: ReadonlyMap<string, FurnitureItem[]>
) {
  const cell = CELL_BY_ID[cellId];
  const scene = cellScene(cellId);
  const sketch = style === 'sketch';
  const rand = random(`${cellId}:${scene.seed}:drawing`);
  ctx.save();
  ctx.clearRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);

  if (style === 'room' || style === 'void') {
    ctx.restore();
    return;
  }

  if (sketch) {
    ctx.fillStyle = PALETTE.linen;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
    drawWallpaper(ctx, CHARCOAL.faint, cell.apartmentId, rand, true);
    ctx.strokeStyle = rgba(CHARCOAL.faint, 0.24);
    ctx.lineWidth = 1.2;
    for (let p = 18; p < TILE_DRAW_SIZE; p += 34) {
      ctx.beginPath();
      ctx.moveTo(p + rand() * 4, 0);
      ctx.lineTo(p - rand() * 4, TILE_DRAW_SIZE);
      ctx.moveTo(0, p + rand() * 4);
      ctx.lineTo(TILE_DRAW_SIZE, p - rand() * 4);
      ctx.stroke();
    }
    if (cell.floor !== -1 && !WINDOWLESS_KINDS.has(scene.kind)) {
      drawWindow(ctx, 166, 40, 194, cell.apartmentId, true, rand);
    }
    drawSketchHatching(ctx, rand);
    const items = layouts.get(cellId) ?? FURNITURE.slice(0, 2);
    const columns = items.length <= 2 ? items.length : 2;
    const itemSize = items.length > 2 ? 144 : 170;
    items.forEach((item, index) => {
      const col = index % columns;
      const rowIndex = Math.floor(index / columns);
      const left = columns === 1 ? 171 : 38 + col * 235;
      const top = items.length > 2 ? 224 + rowIndex * 116 : 272;
      drawFurnitureItem(ctx, item, left + rand() * 18, top + rand() * 12, itemSize, rand, true);
    });
    ctx.fillStyle = PALETTE.paperDeep;
    ctx.globalAlpha = 0.13;
    ctx.fillRect(0, 422, TILE_DRAW_SIZE, 90);
    ctx.globalAlpha = 1;
    if (cell.chapter) {
      ctx.fillStyle = CHARCOAL.number;
      ctx.font = `bold 104px ${TYPE.mono}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(chapterNumeral(cell.chapter), 28, 72);
    }
    ctx.strokeStyle = rgba(CHARCOAL.line, 0.55);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(6, 6, TILE_DRAW_SIZE - 12, TILE_DRAW_SIZE - 12);
  } else {
    ctx.fillStyle = scene.wall;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
    const wash = washFor(cell.apartmentId);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, 422);
    ctx.restore();
    drawWallpaper(ctx, wash, cell.apartmentId, rand, false);
    ctx.fillStyle = scene.floor;
    ctx.globalAlpha = 0.54;
    ctx.fillRect(0, 422, TILE_DRAW_SIZE, 90);
    ctx.globalAlpha = 1;
    const hasWindow = cell.floor !== -1 && !WINDOWLESS_KINDS.has(scene.kind);
    if (hasWindow) {
      drawWindow(ctx, 166, 40, 194, cell.apartmentId, false, rand);
      if (scene.resident) {
        const resident = CAST[scene.resident];
        const silhouetteCanvas = document.createElement('canvas');
        silhouetteCanvas.width = 94;
        silhouetteCanvas.height = 140;
        const silhouetteContext = silhouetteCanvas.getContext('2d');
        if (silhouetteContext) {
          drawWindowSilhouette(silhouetteContext, resident, 94, 140);
          ctx.drawImage(silhouetteCanvas, 270, 68);
        }
      }
    }
    const items = layouts.get(cellId) ?? FURNITURE.slice(0, 2);
    const columns = items.length <= 2 ? items.length : 2;
    const itemSize = items.length > 2 ? 144 : 170;
    items.forEach((item, index) => {
      const col = index % columns;
      const rowIndex = Math.floor(index / columns);
      const left = columns === 1 ? 171 : 38 + col * 235;
      const top = items.length > 2 ? 224 + rowIndex * 116 : 272;
      drawFurnitureItem(ctx, item, left + rand() * 18, top + rand() * 12, itemSize, rand, false);
    });
    if (cell.chapter) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 48px ${TYPE.mono}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(chapterNumeral(cell.chapter), 25, 72);
      ctx.restore();
    }
    ctx.strokeStyle = rgba(PALETTE.ink, 0.48);
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, TILE_DRAW_SIZE - 10, TILE_DRAW_SIZE - 10);
  }

  applyHourLight(ctx, hour);
  if (lit && hour >= 22) {
    const glow = ctx.createRadialGradient(263, 157, 4, 263, 157, 185);
    glow.addColorStop(0, rgba(PALETTE.light, 0.48));
    glow.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TILE_DRAW_SIZE, TILE_DRAW_SIZE);
    ctx.restore();
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
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
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
  const tileCache = new Map<string, HTMLCanvasElement>();
  const fades = new Map<string, {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    started: number;
    duration: number;
  }>();
  const layouts = furnitureLayouts();
  let latestInput = initial;
  let pendingTiles: string[] = [];
  let drawMs = 0;
  let generation = 0;
  let disposed = false;
  const idleScheduler = window as unknown as {
    requestIdleCallback?: (
      callback: (deadline: { timeRemaining(): number; didTimeout: boolean }) => void,
      options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
  let idleHandleIsTimeout = false;

  function tileKey(cellId: string, input: FlatsAtlasInput): string {
    const tier = detailTier(cellId, input.focusCellId, input.visited, input.view);
    const style = tileStyle(tier, input.visited.has(cellId), input.builtRooms.has(cellId));
    const lit = input.hour >= 22 && input.lamps.has(cellId);
    return `${cellId}:${tier}:${style}:${input.hour}:${lit ? 1 : 0}`;
  }

  function visibleCellIds(input: FlatsAtlasInput): Set<string> {
    const visible = new Set<string>();
    if (input.view === 'building') {
      for (const cellId of SECTION_CELL_IDS) visible.add(cellId);
    } else {
      const focus = CELL_BY_ID[input.focusCellId];
      if (focus) {
        const centerFloor = input.view === 'block' ? Math.max(1, Math.min(6, focus.floor)) : focus.floor;
        const centerCol = input.view === 'block' ? Math.max(3, Math.min(8, focus.col)) : focus.col;
        const extent = input.view === 'block' ? 2 : 1;
        for (const cellId of SECTION_CELL_IDS) {
          const cell = CELL_BY_ID[cellId];
          if (
            Math.abs(cell.floor - centerFloor) <= extent &&
            Math.abs(cell.col - centerCol) <= extent
          ) {
            visible.add(cellId);
          }
        }
      }
    }
    for (const cellId of input.priorityCellIds ?? []) visible.add(cellId);
    return visible;
  }

  function renderCell(cellId: string, input: FlatsAtlasInput): boolean {
    const cell = CELL_BY_ID[cellId];
    const tier = detailTier(cellId, input.focusCellId, input.visited, input.view);
    const style = tileStyle(tier, input.visited.has(cellId), input.builtRooms.has(cellId));
    const lit = input.hour >= 22 && input.lamps.has(cellId);
    const key = `${cellId}:${tier}:${style}:${input.hour}:${lit ? 1 : 0}`;
    if (rendered.get(cellId) === key) return false;

    let tileCanvas = tileCache.get(key);
    if (tileCanvas) {
      tileCache.delete(key);
      tileCache.set(key, tileCanvas);
    } else {
      tileCanvas = document.createElement('canvas');
      tileCanvas.width = TILE_DRAW_SIZE;
      tileCanvas.height = TILE_DRAW_SIZE;
      const tileContext = tileCanvas.getContext('2d');
      if (!tileContext) return false;
      const started = performance.now();
      drawTile(tileContext, cellId, style, lit, input.hour, layouts);
      drawMs += performance.now() - started;
      tileCache.set(key, tileCanvas);
      while (tileCache.size > 120) {
        const oldest = tileCache.keys().next().value;
        if (oldest === undefined) break;
        tileCache.delete(oldest);
      }
    }

    const row = 8 - cell.floor;
    const column = cell.col - 1;
    ctx.clearRect(column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.drawImage(tileCanvas, column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    rendered.set(cellId, key);
    return true;
  }

  function cancelScheduledWork() {
    if (idleHandle === null) return;
    if (idleHandleIsTimeout) clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
    else idleScheduler.cancelIdleCallback?.(idleHandle as number);
    idleHandle = null;
  }

  function fadeTile(cellId: string, started: number, duration: number): boolean {
    const cell = CELL_BY_ID[cellId];
    if (!cell) return false;
    let tileCanvas = [...tileCache.entries()]
      .reverse()
      .find(([key]) => key.startsWith(`${cellId}:`) && key.includes(':sketch:'))?.[1];
    if (!tileCanvas) {
      tileCanvas = document.createElement('canvas');
      tileCanvas.width = TILE_DRAW_SIZE;
      tileCanvas.height = TILE_DRAW_SIZE;
      const tileContext = tileCanvas.getContext('2d');
      if (!tileContext) return false;
      const lit = latestInput.hour >= 22 && latestInput.lamps.has(cellId);
      const sketchKey = `${cellId}:sketch:sketch:${latestInput.hour}:${lit ? 1 : 0}`;
      const drawStarted = performance.now();
      drawTile(tileContext, cellId, 'sketch', lit, latestInput.hour, layouts);
      drawMs += performance.now() - drawStarted;
      tileCache.set(sketchKey, tileCanvas);
      while (tileCache.size > 120) {
        const oldest = tileCache.keys().next().value;
        if (oldest === undefined) break;
        tileCache.delete(oldest);
      }
    }
    const previous = fades.get(cellId);
    if (previous) {
      mesh.remove(previous.mesh);
      previous.mesh.geometry.dispose();
      previous.mesh.material.map?.dispose();
      previous.mesh.material.dispose();
    }
    const [x, y, z] = cellOrigin3d(cellId);
    const zPlane = z - 1.625;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          x - 1.7, y, zPlane,
          x + 1.7, y, zPlane,
          x - 1.7, y + 3, zPlane,
          x + 1.7, y + 3, zPlane,
        ],
        3
      )
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)
    );
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const tileTexture = new THREE.CanvasTexture(tileCanvas);
    tileTexture.colorSpace = THREE.SRGBColorSpace;
    const fadeMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: tileTexture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    fadeMesh.name = `flat-tile-fade-${cellId}`;
    fadeMesh.renderOrder = -1;
    mesh.add(fadeMesh);
    fades.set(cellId, { mesh: fadeMesh, started, duration });
    return true;
  }

  function updateFades(now: number): boolean {
    for (const [cellId, fade] of fades) {
      const progress = Math.min(1, Math.max(0, (now - fade.started) / fade.duration));
      fade.mesh.material.opacity = 1 - progress;
      if (progress < 1) continue;
      mesh.remove(fade.mesh);
      fade.mesh.geometry.dispose();
      fade.mesh.material.map?.dispose();
      fade.mesh.material.dispose();
      fades.delete(cellId);
    }
    return fades.size > 0;
  }

  function scheduleIdleWork(expectedGeneration: number) {
    if (disposed || idleHandle !== null || pendingTiles.length === 0) return;
    const run = (deadline?: { timeRemaining(): number; didTimeout: boolean }) => {
      idleHandle = null;
      if (disposed || expectedGeneration !== generation) return;
      let changed = false;
      const started = performance.now();
      let count = 0;
      while (
        pendingTiles.length > 0 &&
        count < 10 &&
        (count === 0 || deadline?.didTimeout || (deadline?.timeRemaining() ?? 0) > 1) &&
        performance.now() - started < 8
      ) {
        changed = renderCell(pendingTiles.shift()!, latestInput) || changed;
        count += 1;
      }
      if (changed) texture.needsUpdate = true;
      if (pendingTiles.length > 0) scheduleIdleWork(expectedGeneration);
    };
    if (idleScheduler.requestIdleCallback) {
      idleHandleIsTimeout = false;
      idleHandle = idleScheduler.requestIdleCallback(run, { timeout: 80 });
    } else {
      idleHandleIsTimeout = true;
      idleHandle = setTimeout(() => run(), 0);
    }
  }

  function refresh(input: FlatsAtlasInput): boolean {
    latestInput = input;
    generation += 1;
    cancelScheduledWork();
    let changed = false;
    const visible = visibleCellIds(input);
    for (const cellId of SECTION_CELL_IDS) {
      if (visible.has(cellId)) changed = renderCell(cellId, input) || changed;
    }
    pendingTiles = SECTION_CELL_IDS.filter(
      (cellId) => !visible.has(cellId) && rendered.get(cellId) !== tileKey(cellId, input)
    );
    if (changed) texture.needsUpdate = true;
    scheduleIdleWork(generation);
    return changed;
  }

  refresh(initial);
  return {
    texture,
    mesh,
    refresh,
    fadeTile,
    updateFades,
    hasFades: () => fades.size > 0,
    stats() {
      return { drawMs, pendingTiles: pendingTiles.length };
    },
    dispose() {
      disposed = true;
      generation += 1;
      cancelScheduledWork();
      for (const fade of fades.values()) {
        mesh.remove(fade.mesh);
        fade.mesh.geometry.dispose();
        fade.mesh.material.map?.dispose();
        fade.mesh.material.dispose();
      }
      fades.clear();
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
      rendered.clear();
      tileCache.clear();
      pendingTiles = [];
    },
  };
}
