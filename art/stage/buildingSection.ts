import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawDamier, damierSize } from '../draw/damier';
import { PALETTE } from '../palette';
import { CELLS, CLINAMEN_CELL } from '../../world/damier';
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

  const dormers: BoxSpec[] = [];
  const dormerWindows: BoxSpec[] = [];
  for (const x of [-12.3, -6.15, 0, 6.15, 12.3]) {
    dormers.push(
      { w: 1.35, h: 1.08, d: 0.25, x, y: baseY + 0.82, z: FRONT_Z - 0.02 },
      { w: 1.6, h: 0.14, d: 0.42, x, y: baseY + 1.38, z: FRONT_Z - 0.02 }
    );
    dormerWindows.push(
      { w: 0.76, h: 0.56, d: 0.04, x, y: baseY + 0.83, z: FRONT_Z + 0.14 }
    );
  }
  mergedBoxes(parent, dormers, PALETTE.roof);
  mergedBoxes(parent, dormerWindows, PALETTE.linen, true);

  const chimneys: BoxSpec[] = [];
  for (const x of [-15.7, -8.1, 8.1, 15.7]) {
    chimneys.push(
      { w: 0.42, h: 1.5, d: 0.48, x, y: baseY + 1.9, z: -0.55 },
      { w: 0.62, h: 0.16, d: 0.58, x, y: baseY + 2.68, z: -0.55 }
    );
  }
  mergedBoxes(parent, chimneys, PALETTE.woodDark);
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
}

export function buildBuildingSection(): BuildingSection {
  const group = new THREE.Group();
  group.name = 'building-section';
  addBackdrop(group);

  const slabs: BoxSpec[] = [];
  const floorCuts: BoxSpec[] = [];
  for (let floor = -1; floor <= 8; floor += 1) {
    const y = floor * SECTION_PITCH.y;
    slabs.push({ w: BUILDING_WIDTH + 0.25, h: 0.24, d: 0.2, x: 0, y: y - 0.12, z: FRONT_Z + 0.08 });
    floorCuts.push({ w: BUILDING_WIDTH + 0.25, h: 0.025, d: 0.035, x: 0, y: y - 0.12, z: FRONT_Z + 0.2 });
  }
  mergedBoxes(group, slabs, PALETTE.paperDeep);
  mergedBoxes(group, floorCuts, PALETTE.ink, true);

  const partyWalls: BoxSpec[] = [];
  const partyCuts: BoxSpec[] = [];
  for (let floor = -1; floor <= 8; floor += 1) {
    const y = floor * SECTION_PITCH.y;
    for (let boundary = 0; boundary <= 10; boundary += 1) {
      const x = (boundary - 5) * SECTION_PITCH.x;
      partyWalls.push({ w: 0.12, h: CELL_ROOM.H, d: CELL_ROOM.D, x, y: y + CELL_ROOM.H / 2, z: 0 });
      partyCuts.push({ w: 0.026, h: CELL_ROOM.H, d: 0.028, x, y: y + CELL_ROOM.H / 2, z: FRONT_Z + 0.05 });
    }
  }
  mergedBoxes(group, partyWalls, PALETTE.plaster);
  mergedBoxes(group, partyCuts, PALETTE.ink, true);

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
      stairRails.push(
        { w: 0.055, h: 1.8, d: 0.055, x: stairX - 1.2, y: y + 1.32, z: -0.63 },
        { w: 0.055, h: 1.8, d: 0.055, x: stairX + 1.2, y: y + 1.32, z: -0.63 }
      );
    }
  }
  mergedBoxes(group, stairTreads, PALETTE.wood);
  mergedBoxes(group, stairRails, PALETTE.brass);

  const liftCell = CELLS.find((cell) => cell.apartmentId === 'STAIRS' && cell.col === 7);
  const liftX = liftCell ? cellOrigin3d(liftCell.id)[0] : cellOrigin3d('0:7')[0];
  const liftRails: BoxSpec[] = [
    { w: 0.07, h: 23, d: 0.07, x: liftX - 0.52, y: 8, z: -0.96 },
    { w: 0.07, h: 23, d: 0.07, x: liftX + 0.52, y: 8, z: -0.96 },
    { w: 0.04, h: 23, d: 0.04, x: liftX, y: 8, z: -1.06 },
  ];
  mergedBoxes(group, liftRails, PALETTE.woodDark);
  const elevatorNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.09, 0.09),
    toonMaterial(PALETTE.brass)
  );
  elevatorNeedle.position.set(liftX, 1.3, -0.76);
  elevatorNeedle.name = 'elevator-needle';
  elevatorNeedle.castShadow = true;
  group.add(elevatorNeedle);

  addRoof(group);
  const pavement = [
    { w: BUILDING_WIDTH + 1.2, h: 0.16, d: 1.1, x: 0, y: -0.31, z: FRONT_Z + 0.5 },
    { w: BUILDING_WIDTH + 1.2, h: 0.035, d: 1.14, x: 0, y: -0.22, z: FRONT_Z + 0.5 },
  ];
  mergedBoxes(group, pavement, PALETTE.paperDeep);
  const earth: BoxSpec[] = [
    { w: BUILDING_WIDTH + 0.4, h: 1.1, d: 0.13, x: 0, y: -3.82, z: FRONT_Z + 0.12 },
  ];
  const hatch: BoxSpec[] = [];
  for (let x = -BUILDING_WIDTH / 2 - 0.2; x < BUILDING_WIDTH / 2; x += 0.7) {
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
  mergedBoxes(group, earth, PALETTE.woodDark);
  mergedBoxes(group, hatch, PALETTE.ink, true);
  addClinamen(group);

  return { group, elevatorNeedle };
}
