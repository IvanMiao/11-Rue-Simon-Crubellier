import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawDamier, damierSize } from '../draw/damier';
import { PALETTE } from '../palette';
import { CELL_BY_ID, CELLS, CLINAMEN_CELL } from '../../world/damier';
import { toonMaterial } from '../materials';
import { CELL_ROOM } from './cellScenes';
import { cellOrigin3d, SECTION_PITCH } from './sectionLayout';

const BUILDING_WIDTH = 10 * SECTION_PITCH.x;
const FRONT_Z = CELL_ROOM.D / 2 + 0.12;

interface BoxSpec {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  rotationZ?: number;
}

function mergedBoxes(parent: THREE.Group, boxes: BoxSpec[], color: string, basic = false): THREE.Mesh {
  const geometries = boxes.map(({ w, h, d, x, y, z, rotationZ }) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.clearGroups();
    if (rotationZ) geometry.rotateZ(rotationZ);
    geometry.translate(x, y, z);
    return geometry;
  });
  const geometry = mergeGeometries(geometries);
  geometries.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`Could not merge building geometry for ${color}`);
  const material = basic
    ? new THREE.MeshBasicMaterial({ color })
    : toonMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = !basic;
  mesh.receiveShadow = !basic;
  parent.add(mesh);
  return mesh;
}

function addBackdrop(parent: THREE.Group) {
  const cellSize = 192;
  const canvas = document.createElement('canvas');
  const dimensions = damierSize(cellSize);
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  drawDamier(
    canvas.getContext('2d')!,
    { cells: CELLS, visited: new Set(), clinamenId: CLINAMEN_CELL },
    cellSize
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const worldWidth = 10.5 * SECTION_PITCH.x;
  const worldHeight = 11.9 * SECTION_PITCH.y;
  const top = 8 * SECTION_PITCH.y + CELL_ROOM.H + 0.8 * SECTION_PITCH.y;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), material);
  plane.position.set(0, top - worldHeight / 2, -3.35);
  plane.renderOrder = -10;
  plane.userData.noInk = true;
  parent.add(plane);
}

function shaftColumnsAt(boundaryFloor: number): number[] {
  return [6, 7].filter((col) => {
    const upper = CELL_BY_ID[`${boundaryFloor}:${col}`];
    const lower = CELL_BY_ID[`${boundaryFloor - 1}:${col}`];
    const isShaft = (cell: (typeof CELLS)[number] | undefined) =>
      cell?.apartmentId === 'STAIRS' || cell?.id === '0:7' || cell?.id === '-1:7';
    return isShaft(upper) || isShaft(lower);
  });
}

function addFloorSpans(specs: BoxSpec[], floor: number, h: number, d: number, z: number, y: number) {
  const left = -BUILDING_WIDTH / 2 - 0.125;
  const right = BUILDING_WIDTH / 2 + 0.125;
  let cursor = left;
  for (const col of shaftColumnsAt(floor)) {
    const center = (col - 5.5) * SECTION_PITCH.x;
    const start = center - SECTION_PITCH.x / 2;
    const end = center + SECTION_PITCH.x / 2;
    if (start > cursor) specs.push({ w: start - cursor, h, d, x: (start + cursor) / 2, y, z });
    cursor = Math.max(cursor, end);
  }
  if (cursor < right) specs.push({ w: right - cursor, h, d, x: (right + cursor) / 2, y, z });
}

function addDormer(parent: THREE.Group, x: number, baseY: number) {
  const dormer = new THREE.Group();
  dormer.name = 'mansard-dormer';
  const front = FRONT_Z + 0.02;
  const cheek = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.06, 0.72),
    toonMaterial(PALETTE.plaster)
  );
  cheek.position.set(-0.67, baseY + 0.73, front - 0.04);
  const cheekRight = cheek.clone();
  cheekRight.position.x = 0.67;
  dormer.add(cheek, cheekRight);

  const window = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.72),
    new THREE.MeshBasicMaterial({ color: PALETTE.skyWarm })
  );
  window.position.set(0, baseY + 0.78, front + 0.08);
  window.userData.noInk = true;
  dormer.add(window);
  const frameBars: BoxSpec[] = [
    { w: 1.18, h: 0.09, d: 0.1, x: 0, y: baseY + 1.16, z: front + 0.12 },
    { w: 1.18, h: 0.09, d: 0.1, x: 0, y: baseY + 0.4, z: front + 0.12 },
    { w: 0.09, h: 0.84, d: 0.1, x: -0.55, y: baseY + 0.78, z: front + 0.12 },
    { w: 0.09, h: 0.84, d: 0.1, x: 0.55, y: baseY + 0.78, z: front + 0.12 },
    { w: 0.055, h: 0.72, d: 0.08, x: 0, y: baseY + 0.78, z: front + 0.16 },
    { w: 1.06, h: 0.055, d: 0.08, x: 0, y: baseY + 0.78, z: front + 0.16 },
  ];
  mergedBoxes(dormer, frameBars, PALETTE.linen);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.9, baseY + 1.2);
  roofShape.lineTo(-0.68, baseY + 1.72);
  roofShape.lineTo(0.68, baseY + 1.72);
  roofShape.lineTo(0.9, baseY + 1.2);
  roofShape.closePath();
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roofShape, { depth: 0.78, bevelEnabled: false }),
    toonMaterial(PALETTE.roof)
  );
  roof.position.z = front - 0.42;
  roof.castShadow = true;
  dormer.add(roof);
  const roofSeams: BoxSpec[] = [];
  for (const seamX of [-0.45, -0.15, 0.15, 0.45]) {
    roofSeams.push({
      w: 0.025,
      h: 0.54,
      d: 0.035,
      x: seamX,
      y: baseY + 1.46,
      z: front + 0.04,
      rotationZ: seamX < 0 ? -0.38 : 0.38,
    });
  }
  mergedBoxes(dormer, roofSeams, PALETTE.paperDeep, true);
  dormer.position.x = x;
  parent.add(dormer);
}

function addRoof(parent: THREE.Group) {
  const left = -BUILDING_WIDTH / 2;
  const right = BUILDING_WIDTH / 2;
  const baseY = 8 * SECTION_PITCH.y + CELL_ROOM.H;
  const shape = new THREE.Shape();
  shape.moveTo(left - 0.28, baseY);
  shape.lineTo(left + 0.45, baseY + 0.26);
  shape.lineTo(left + 1.25, baseY + 1.55);
  shape.lineTo(right - 1.25, baseY + 1.55);
  shape.lineTo(right - 0.45, baseY + 0.26);
  shape.lineTo(right + 0.28, baseY);
  shape.closePath();
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: CELL_ROOM.D + 0.2, bevelEnabled: false }),
    toonMaterial(PALETTE.roof)
  );
  roof.position.z = -CELL_ROOM.D / 2 - 0.1;
  roof.castShadow = true;
  roof.receiveShadow = true;
  parent.add(roof);

  for (const x of [-12.3, -6.15, 0, 6.15, 12.3]) addDormer(parent, x, baseY);

  const cornice: BoxSpec[] = [
    { w: BUILDING_WIDTH + 0.9, h: 0.2, d: 0.5, x: 0, y: baseY + 0.02, z: FRONT_Z + 0.02 },
    { w: BUILDING_WIDTH + 0.45, h: 0.12, d: 0.38, x: 0, y: baseY + 0.2, z: FRONT_Z + 0.03 },
  ];
  mergedBoxes(parent, cornice, PALETTE.castWallStone);

  const seams: BoxSpec[] = [];
  for (let x = left + 1.65; x <= right - 1.65; x += 0.76) {
    seams.push({
      w: 0.028,
      h: 1.22,
      d: 0.035,
      x,
      y: baseY + 0.97,
      z: FRONT_Z + 0.035,
    });
  }
  mergedBoxes(parent, seams, PALETTE.paperDeep, true);

  const chimneys: BoxSpec[] = [];
  const pots: THREE.BufferGeometry[] = [];
  for (const x of [-15.7, -8.1, 8.1, 15.7]) {
    chimneys.push(
      { w: 0.42, h: 1.5, d: 0.48, x, y: baseY + 1.9, z: -0.55 },
      { w: 0.62, h: 0.16, d: 0.58, x, y: baseY + 2.68, z: -0.55 }
    );
    for (const dx of [-0.14, 0.14]) {
      const pot = new THREE.CylinderGeometry(0.09, 0.12, 0.48, 8);
      pot.translate(x + dx, baseY + 2.98, -0.55);
      pots.push(pot);
    }
  }
  mergedBoxes(parent, chimneys, PALETTE.woodDark);
  const potGeometry = mergeGeometries(pots);
  pots.forEach((pot) => pot.dispose());
  if (potGeometry) {
    const potMesh = new THREE.Mesh(potGeometry, toonMaterial(PALETTE.castWallStone));
    potMesh.castShadow = true;
    parent.add(potMesh);
  }
}

function addStreet(parent: THREE.Group) {
  const hallCell = CELL_BY_ID['0:6'] ?? CELL_BY_ID['0:7'];
  const hallX = hallCell ? cellOrigin3d(hallCell.id)[0] : 0;
  const front = FRONT_Z;
  const porch: BoxSpec[] = [
    { w: 6.1, h: 0.2, d: 1.55, x: hallX + 1.76, y: 3.05, z: front + 0.8 },
    { w: 0.18, h: 2.9, d: 0.18, x: hallX - 0.7, y: 1.45, z: front + 0.85 },
    { w: 0.18, h: 2.9, d: 0.18, x: hallX + 4.22, y: 1.45, z: front + 0.85 },
    { w: 1.42, h: 2.42, d: 0.09, x: hallX + 1.76, y: 1.21, z: front + 0.1 },
    { w: 0.08, h: 2.3, d: 0.12, x: hallX + 1.76, y: 1.21, z: front + 0.17 },
    { w: 1.1, h: 0.08, d: 0.12, x: hallX + 1.76, y: 1.22, z: front + 0.17 },
  ];
  mergedBoxes(parent, porch.slice(0, 3), PALETTE.castWallStone);
  mergedBoxes(parent, porch.slice(3), PALETTE.woodDark);
  const doorPanels: BoxSpec[] = [
    { w: 0.44, h: 0.68, d: 0.035, x: hallX + 1.47, y: 0.56, z: front + 0.24 },
    { w: 0.44, h: 0.68, d: 0.035, x: hallX + 2.05, y: 0.56, z: front + 0.24 },
    { w: 0.44, h: 0.8, d: 0.035, x: hallX + 1.47, y: 1.57, z: front + 0.24 },
    { w: 0.44, h: 0.8, d: 0.035, x: hallX + 2.05, y: 1.57, z: front + 0.24 },
  ];
  mergedBoxes(parent, doorPanels, PALETTE.wood);

  const lamp = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.07, 3.1, 8),
    toonMaterial(PALETTE.woodDark)
  );
  post.position.set(hallX + 5.25, 1.55, front + 1.55);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.48, 0.34),
    toonMaterial(PALETTE.brass)
  );
  head.position.set(hallX + 5.25, 3.18, front + 1.55);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.light })
  );
  glow.position.set(hallX + 5.25, 3.12, front + 1.55);
  glow.userData.noInk = true;
  lamp.add(post, head, glow);
  parent.add(lamp);

  const sidewalks: BoxSpec[] = [];
  const kerbs: BoxSpec[] = [];
  for (const side of [-1, 1]) {
    const sidewalkX = side * (BUILDING_WIDTH / 2 + 1.65);
    sidewalks.push(
      { w: 3.3, h: 0.12, d: 2.1, x: sidewalkX, y: -0.2, z: front + 0.95 },
      { w: 3.3, h: 0.14, d: 0.18, x: sidewalkX, y: -0.08, z: front + 2.0 }
    );
    kerbs.push({
      w: 3.3,
      h: 0.08,
      d: 0.16,
      x: sidewalkX,
      y: -0.02,
      z: front + 0.05,
    });
  }
  mergedBoxes(parent, sidewalks, PALETTE.paperDeep);
  mergedBoxes(parent, kerbs, PALETTE.castWallStone);
}

function addClinamen(parent: THREE.Group) {
  const [x, y] = cellOrigin3d(CLINAMEN_CELL);
  const crumb = new THREE.Shape();
  crumb.moveTo(-1.7, 1.5);
  crumb.lineTo(1.7, 1.5);
  crumb.lineTo(1.7, -0.2);
  crumb.quadraticCurveTo(1.48, -0.42, 1.28, -0.88);
  crumb.quadraticCurveTo(1.12, -1.3, 0.86, -1.12);
  crumb.quadraticCurveTo(0.55, -0.92, 0.29, -1.42);
  crumb.quadraticCurveTo(0.02, -1.7, -0.28, -1.26);
  crumb.quadraticCurveTo(-0.56, -0.84, -0.88, -1.15);
  crumb.quadraticCurveTo(-1.3, -1.46, -1.7, -0.72);
  crumb.closePath();
  const edge = new THREE.Mesh(
    new THREE.ShapeGeometry(crumb),
    toonMaterial(PALETTE.wallMotif, { side: THREE.DoubleSide })
  );
  edge.position.set(x, y + CELL_ROOM.H / 2, FRONT_Z + 0.02);
  edge.userData.noInk = false;
  parent.add(edge);

  const hole = new THREE.Shape();
  hole.moveTo(-1.45, 1.25);
  hole.lineTo(1.45, 1.25);
  hole.lineTo(1.45, -0.28);
  hole.quadraticCurveTo(1.16, -0.58, 1.04, -0.92);
  hole.quadraticCurveTo(0.82, -1.14, 0.58, -0.88);
  hole.quadraticCurveTo(0.28, -0.64, 0.04, -1.2);
  hole.quadraticCurveTo(-0.18, -1.4, -0.49, -1.0);
  hole.quadraticCurveTo(-0.86, -0.7, -1.08, -1.02);
  hole.quadraticCurveTo(-1.31, -1.19, -1.45, -0.58);
  hole.closePath();
  const dark = new THREE.Mesh(
    new THREE.ShapeGeometry(hole),
    new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.DoubleSide })
  );
  dark.position.set(x, y + CELL_ROOM.H / 2, FRONT_Z + 0.045);
  parent.add(dark);

  const crumbs: THREE.Mesh[] = [];
  for (const [dx, dy] of [[-1.35, -1.05], [-0.72, -1.34], [-0.17, -1.5], [0.52, -1.28], [1.2, -1.06]]) {
    const crumbDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.brass })
    );
    crumbDot.position.set(x + dx, y + CELL_ROOM.H / 2 + dy, FRONT_Z + 0.06);
    crumbs.push(crumbDot);
  }
  crumbs.forEach((dot) => parent.add(dot));
}

export interface BuildingSection {
  group: THREE.Group;
  elevatorNeedle: THREE.Mesh;
  elevatorCage: THREE.Group;
}

export function buildBuildingSection(): BuildingSection {
  const group = new THREE.Group();
  group.name = 'building-section';
  addBackdrop(group);

  const slabs: BoxSpec[] = [];
  const floorCuts: BoxSpec[] = [];
  for (let floor = -1; floor <= 8; floor += 1) {
    const y = floor * SECTION_PITCH.y;
    addFloorSpans(slabs, floor, 0.24, 0.2, FRONT_Z + 0.08, y - 0.12);
    addFloorSpans(floorCuts, floor, 0.025, 0.035, FRONT_Z + 0.2, y - 0.12);
  }
  mergedBoxes(group, slabs, PALETTE.paperDeep);
  mergedBoxes(group, floorCuts, PALETTE.ink, true);

  const partyWalls: BoxSpec[] = [];
  const partyCuts: BoxSpec[] = [];
  const partitionTrim: BoxSpec[] = [];
  for (let floor = -1; floor <= 8; floor += 1) {
    const y = floor * SECTION_PITCH.y;
    for (let boundary = 0; boundary <= 10; boundary += 1) {
      const x = (boundary - 5) * SECTION_PITCH.x;
      const left = boundary > 0 ? CELL_BY_ID[`${floor}:${boundary}`] : undefined;
      const right = boundary < 10 ? CELL_BY_ID[`${floor}:${boundary + 1}`] : undefined;
      const sameApartment = Boolean(left && right && left.apartmentId === right.apartmentId);
      if (!sameApartment) {
        partyWalls.push({ w: 0.12, h: CELL_ROOM.H, d: CELL_ROOM.D, x, y: y + CELL_ROOM.H / 2, z: 0 });
        partyCuts.push({ w: 0.026, h: CELL_ROOM.H, d: 0.028, x, y: y + CELL_ROOM.H / 2, z: FRONT_Z + 0.05 });
        continue;
      }

      const doorZ = 1.12;
      const doorWidth = 0.96;
      const doorHeight = 2.12;
      const doorStart = doorZ - doorWidth / 2;
      const doorEnd = doorZ + doorWidth / 2;
      for (const [start, end] of [[-CELL_ROOM.D / 2, doorStart], [doorEnd, CELL_ROOM.D / 2]] as const) {
        if (end - start < 0.02) continue;
        partyWalls.push({
          w: 0.08,
          h: CELL_ROOM.H,
          d: end - start,
          x,
          y: y + CELL_ROOM.H / 2,
          z: (start + end) / 2,
        });
      }
      partyWalls.push({
        w: 0.08,
        h: CELL_ROOM.H - doorHeight,
        d: doorWidth,
        x,
        y: y + doorHeight + (CELL_ROOM.H - doorHeight) / 2,
        z: doorZ,
      });
      partitionTrim.push(
        { w: 0.06, h: doorHeight, d: 0.045, x, y: y + doorHeight / 2, z: doorStart },
        { w: 0.06, h: doorHeight, d: 0.045, x, y: y + doorHeight / 2, z: doorEnd },
        { w: 0.06, h: 0.07, d: doorWidth + 0.08, x, y: y + doorHeight, z: doorZ }
      );
      partyCuts.push(
        { w: 0.026, h: doorHeight, d: 0.028, x, y: y + doorHeight / 2, z: doorStart },
        { w: 0.026, h: doorHeight, d: 0.028, x, y: y + doorHeight / 2, z: doorEnd }
      );
    }
  }
  mergedBoxes(group, partyWalls, PALETTE.plaster);
  mergedBoxes(group, partyCuts, PALETTE.ink, true);
  mergedBoxes(group, partitionTrim, PALETTE.woodDark);

  const pilasters: BoxSpec[] = [];
  for (const x of [-BUILDING_WIDTH / 2, BUILDING_WIDTH / 2]) {
    for (let floor = -1; floor <= 8; floor += 1) {
      pilasters.push({
        w: 0.18,
        h: CELL_ROOM.H,
        d: 0.16,
        x,
        y: floor * SECTION_PITCH.y + CELL_ROOM.H / 2,
        z: FRONT_Z + 0.06,
      });
    }
  }
  mergedBoxes(group, pilasters, PALETTE.woodDark);

  const stairTreads: BoxSpec[] = [];
  const stairRails: BoxSpec[] = [];
  const stairCell = CELLS.find((cell) => cell.apartmentId === 'STAIRS' && cell.col === 6);
  if (stairCell) {
    const [stairX] = cellOrigin3d(stairCell.id);
    for (let floor = 1; floor <= 6; floor += 1) {
      const y = floor * SECTION_PITCH.y;
      for (let step = 0; step < 7; step += 1) {
        stairTreads.push({
          w: 1.28,
          h: 0.075,
          d: 0.48,
          x: stairX + (floor % 2 ? -0.55 : 0.55) + (floor % 2 ? step : -step) * 0.12,
          y: y + 0.12 + step * 0.23,
          z: -0.86 + step * 0.17,
        });
      }
    }
    stairRails.push(
      { w: 0.055, h: 19.2, d: 0.055, x: stairX - 1.2, y: 12.84, z: -0.63 },
      { w: 0.055, h: 19.2, d: 0.055, x: stairX + 1.2, y: 12.84, z: -0.63 }
    );
  }
  mergedBoxes(group, stairTreads, PALETTE.wood);
  mergedBoxes(group, stairRails, PALETTE.brass);

  const liftCell = CELLS.find((cell) => cell.apartmentId === 'STAIRS' && cell.col === 7);
  const liftX = liftCell ? cellOrigin3d(liftCell.id)[0] : cellOrigin3d('0:7')[0];
  const liftBottom = -SECTION_PITCH.y;
  const liftTop = 8 * SECTION_PITCH.y + CELL_ROOM.H;
  const liftHeight = liftTop - liftBottom;
  const liftCenter = (liftTop + liftBottom) / 2;
  const liftRails: BoxSpec[] = [
    { w: 0.07, h: liftHeight, d: 0.07, x: liftX - 0.52, y: liftCenter, z: -0.96 },
    { w: 0.07, h: liftHeight, d: 0.07, x: liftX + 0.52, y: liftCenter, z: -0.96 },
    { w: 0.04, h: liftHeight, d: 0.04, x: liftX, y: liftCenter, z: -1.06 },
  ];
  mergedBoxes(group, liftRails, PALETTE.woodDark);
  const elevatorNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.09, 0.09),
    toonMaterial(PALETTE.brass)
  );
  elevatorNeedle.position.set(liftX, 1.3, CELL_ROOM.D / 2 + 0.22);
  elevatorNeedle.name = 'elevator-needle';
  elevatorNeedle.castShadow = true;
  group.add(elevatorNeedle);
  const elevatorCage = new THREE.Group();
  elevatorCage.name = 'elevator-cage';
  elevatorCage.position.set(liftX, 0, CELL_ROOM.D / 2 + 0.12);
  const ironwork: BoxSpec[] = [
    { w: 0.88, h: 0.08, d: 0.82, x: 0, y: 0.04, z: 0 },
    { w: 0.88, h: 0.055, d: 0.055, x: 0, y: 2.52, z: 0.38 },
    { w: 0.055, h: 2.48, d: 0.055, x: -0.42, y: 1.27, z: 0.38 },
    { w: 0.055, h: 2.48, d: 0.055, x: 0.42, y: 1.27, z: 0.38 },
    { w: 0.055, h: 2.48, d: 0.055, x: -0.42, y: 1.27, z: -0.38 },
    { w: 0.055, h: 2.48, d: 0.055, x: 0.42, y: 1.27, z: -0.38 },
    { w: 0.045, h: 2.42, d: 0.045, x: -0.3, y: 1.27, z: 0.38 },
    { w: 0.045, h: 2.42, d: 0.045, x: 0.3, y: 1.27, z: 0.38 },
    { w: 0.88, h: 0.045, d: 0.045, x: 0, y: 0.24, z: 0.38 },
    { w: 0.88, h: 0.045, d: 0.045, x: 0, y: 2.3, z: 0.38 },
  ];
  mergedBoxes(elevatorCage, ironwork, PALETTE.ink, true);
  const brasswork: BoxSpec[] = [
    { w: 0.94, h: 0.07, d: 0.07, x: 0, y: 0.12, z: 0.42 },
    { w: 0.94, h: 0.07, d: 0.07, x: 0, y: 2.42, z: 0.42 },
    { w: 0.035, h: 2.2, d: 0.05, x: 0, y: 1.27, z: 0.43 },
  ];
  mergedBoxes(elevatorCage, brasswork, PALETTE.brass);
  group.add(elevatorCage);

  addRoof(group);
  addStreet(group);
  const pavement = [
    { w: BUILDING_WIDTH + 1.2, h: 0.16, d: 1.1, x: 0, y: -0.31, z: FRONT_Z + 0.5 },
    { w: BUILDING_WIDTH + 1.2, h: 0.035, d: 1.14, x: 0, y: -0.22, z: FRONT_Z + 0.5 },
  ];
  mergedBoxes(group, pavement, PALETTE.paperDeep);
  const earth: BoxSpec[] = [
    { w: BUILDING_WIDTH + 4.6, h: 1.1, d: 0.13, x: 0, y: -3.82, z: FRONT_Z + 0.12 },
  ];
  const foundationLines: BoxSpec[] = [];
  for (let x = -BUILDING_WIDTH / 2 - 2.2; x < BUILDING_WIDTH / 2 + 2.2; x += 1.2) {
    foundationLines.push({
      w: 0.035,
      h: 1.08,
      d: 0.035,
      x,
      y: -3.82,
      z: FRONT_Z + 0.2,
    });
  }
  const hatch: BoxSpec[] = [];
  for (let x = -BUILDING_WIDTH / 2 - 2.2; x < BUILDING_WIDTH / 2 + 2.2; x += 0.7) {
    hatch.push({
      w: 0.035,
      h: 1.25,
      d: 0.04,
      x,
      y: -3.82,
      z: FRONT_Z + 0.22,
      rotationZ: 0.42,
    });
  }
  mergedBoxes(group, earth, PALETTE.castWallStone);
  mergedBoxes(group, foundationLines, PALETTE.castFloorTaupe, true);
  mergedBoxes(group, hatch, PALETTE.castFloorTaupe, true);
  addClinamen(group);

  return { group, elevatorNeedle, elevatorCage };
}
