import * as THREE from 'three';
import { InkRenderer, type InkMode } from '../inkPass';
import { knightPiece } from '../knight';
import { HOUR_LIGHT, LIGHT_2000, PALETTE, TYPE } from '../palette';
import { CELLS, CELL_BY_ID } from '../../world/damier';
import { buildCellRoom } from './cellRooms';
import { buildBuildingSection } from './buildingSection';
import { CELL_ROOM, cellScene, anchorFor } from './cellScenes';
import { createFlatsAtlas } from './flatsAtlas';
import { disposeGroup } from './dispose';
import {
  cellAtPoint,
  cellOrigin3d,
  detailTier,
  flightPath,
  frameFor,
  SECTION_CELL_IDS,
  SECTION_PITCH,
  type FlightKind,
  type SectionView,
} from './sectionLayout';
import type { StageHotspot } from './types';

export type { StageHotspot } from './types';

export interface BuildingInput {
  current: string;
  focus: string;
  view: SectionView;
  hour: 20 | 21 | 22 | 23;
  mode: 'print' | 'blueprint';
  visited: string[];
  lamps: string[];
  changed: string[];
  targets: Record<string, { kind: FlightKind; minutes: number }>;
  hotspots: StageHotspot[];
  highlight: string | null;
  lastMove: { from: string; to: string; kind: FlightKind } | null;
}

export interface BuildingCallbacks {
  onPickHotspot(lineId: string): void;
  onPickCell(cellId: string): void;
  onHoverCell(cellId: string | null): void;
  onViewChange(view: SectionView): void;
}

export interface BuildingStats {
  renderCalls: number;
  drawCalls: number;
  firstReadyMs: number | null;
  roomBuildMs: number;
  lastRoomBuildMs: number;
  roomsBuilt: number;
  idle: boolean;
}

export interface BuildingHandle {
  update(input: BuildingInput): void;
  resize(width: number, height: number): void;
  dispose(): void;
  stats(): BuildingStats;
}

interface CameraPose {
  target: THREE.Vector3;
  viewHeight: number;
  yaw: number;
  pitch: number;
}

interface RoomEntry {
  group: THREE.Group;
}

interface CameraTween {
  from: CameraPose;
  to: CameraPose;
  started: number;
  duration: number;
}

interface CameraFlight {
  frames: CameraPose[];
  path: string[];
  started: number;
  duration: number;
  flightHeight: number;
}

const hotspotGlyph: Record<StageHotspot['kind'], string> = {
  look: '○',
  check: '◇',
  item: '◦',
  finale: '✕',
};
const statusGlyph: Partial<Record<StageHotspot['status'], string>> = {
  locked: '—',
  done: '✓',
  failed: '✗',
};
const VIEW_ORDER: SectionView[] = ['room', 'block', 'building'];
const FRONT_Z = 2.16;
const MAX_ROOMS = 12;

function toPose(
  frame: ReturnType<typeof frameFor>,
  viewHeight = frame.viewHeight
): CameraPose {
  return {
    target: new THREE.Vector3(...frame.target),
    viewHeight,
    yaw: frame.yaw,
    pitch: frame.pitch,
  };
}

function clonePose(pose: CameraPose): CameraPose {
  return {
    target: pose.target.clone(),
    viewHeight: pose.viewHeight,
    yaw: pose.yaw,
    pitch: pose.pitch,
  };
}

function tagTexture(hotspot: StageHotspot, highlighted: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.shadowColor = highlighted || hotspot.status === 'open' ? PALETTE.light : PALETTE.ink;
  ctx.shadowBlur = highlighted ? 32 : hotspot.status === 'open' ? 18 : 7;
  ctx.fillStyle = PALETTE.paper;
  ctx.strokeStyle = highlighted ? PALETTE.accent : PALETTE.ink;
  ctx.lineWidth = highlighted ? 8 : 5;
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(108, 19);
  ctx.lineTo(116, 106);
  ctx.lineTo(20, 114);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `900 ${highlighted ? 86 : 78}px ${TYPE.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusGlyph[hotspot.status] ?? hotspotGlyph[hotspot.kind], 66, 63);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spriteFor(
  texture: THREE.Texture,
  width: number,
  height: number,
  data: Record<string, unknown> = {}
): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  );
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 1000;
  sprite.userData.noInk = true;
  Object.assign(sprite.userData, data);
  return sprite;
}

function hotspotSprite(hotspot: StageHotspot, index: number, cellId: string, highlighted: boolean) {
  const sprite = spriteFor(tagTexture(hotspot, highlighted), 1, 1, {
    lineId: hotspot.lineId,
    hotspot,
    highlighted,
  });
  const [x, y, z] = anchorFor(cellId, hotspot.lineId, index);
  sprite.userData.anchor = new THREE.Vector3(...cellOrigin3d(cellId)).add(new THREE.Vector3(x, y, z));
  return sprite;
}

function moveTagTexture(
  target: BuildingInput['targets'][string]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 88;
  const ctx = canvas.getContext('2d')!;
  const fill = target.kind === 'knight' ? PALETTE.brass : target.kind === 'elevator' ? PALETTE.paperDeep : PALETTE.linen;
  ctx.fillStyle = fill;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(13, 7);
  ctx.lineTo(244, 11);
  ctx.lineTo(239, 77);
  ctx.lineTo(10, 81);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 42px ${TYPE.mono}`;
  const symbol = target.kind === 'knight' ? '♞' : target.kind === 'elevator' ? '⇅' : '·';
  ctx.fillText(`${symbol} ${target.minutes}′`, 128, 43);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function changedTagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PALETTE.paper;
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(48, 48, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `900 48px ${TYPE.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('新', 48, 49);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeGroupContents(group: THREE.Group) {
  disposeGroup(group);
}

export function mountBuilding(
  host: HTMLElement,
  initial: BuildingInput,
  callbacks: BuildingCallbacks
): BuildingHandle {
  const startedAt = performance.now();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  const root = new THREE.Group();
  root.name = 'building-world';
  scene.add(root);
  const overlayScene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  renderer.domElement.className = 'building-stage-canvas';
  renderer.domElement.setAttribute('aria-label', 'Valène 的整栋楼剖面');
  renderer.domElement.style.touchAction = 'none';
  host.replaceChildren(renderer.domElement);

  const ink = new InkRenderer(renderer, scene, camera);
  const section = buildBuildingSection();
  root.add(section.group);
  const visited = new Set(initial.visited);
  const lamps = new Set(initial.lamps);
  const atlas = createFlatsAtlas({
    focusCellId: initial.focus,
    visited,
    lamps,
    hour: initial.hour,
    builtRooms: new Set(),
  });
  root.add(atlas.mesh);

  const sun = new THREE.DirectionalLight(LIGHT_2000.sunColor, LIGHT_2000.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(LIGHT_2000.hemiSky, LIGHT_2000.hemiGround, LIGHT_2000.hemiIntensity);
  scene.add(hemi);

  const roomsRoot = new THREE.Group();
  roomsRoot.name = 'full-detail-rooms';
  root.add(roomsRoot);
  const rooms = new Map<string, RoomEntry>();
  let desiredRooms = new Set<string>();
  let roomQueue: string[] = [];
  const knight = knightPiece(0.62);
  knight.name = 'player-knight';
  root.add(knight);
  const hotspotGroup = new THREE.Group();
  hotspotGroup.name = 'building-hotspots';
  overlayScene.add(hotspotGroup);
  const moveGroup = new THREE.Group();
  moveGroup.name = 'building-move-tags';
  overlayScene.add(moveGroup);
  const changedGroup = new THREE.Group();
  changedGroup.name = 'building-changed-tags';
  overlayScene.add(changedGroup);
  const hoverGroup = new THREE.Group();
  hoverGroup.name = 'building-hover';
  overlayScene.add(hoverGroup);

  let currentInput: BuildingInput = initial;
  let disposed = false;
  let currentPose = toPose(frameFor(initial.view, initial.focus, 1));
  let cameraTween: CameraTween | null = null;
  let cameraFlight: CameraFlight | null = null;
  let firstReadyMs: number | null = null;
  let roomBuildMs = 0;
  let lastRoomBuildMs = 0;
  let roomsBuilt = 0;
  let frame = 0;
  let hoverCell: string | null = null;
  let hoveredHotspot: THREE.Sprite | null = null;
  let pendant: THREE.PointLight | null = null;
  let pendantCell: string | null = null;
  let lastMoveObject = initial.lastMove;
  let requestedView = initial.view;
  let suppressClickUntil = 0;
  const pointerPositions = new Map<number, THREE.Vector2>();
  let pinchStartDistance: number | null = null;
  let pinchStartChanged = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT_Z);
  const pickPoint = new THREE.Vector3();
  const size = { width: 1, height: 1 };
  const initialFrame = frameFor(initial.view, initial.focus, 1);
  currentPose = toPose(initialFrame, initialFrame.viewHeight * 2.2);
  applyCameraPose(currentPose);
  cameraTween = {
    from: clonePose(currentPose),
    to: toPose(initialFrame),
    started: performance.now(),
    duration: 700,
  };
  setKnightCell(initial.current);

  function setFrustum(viewHeight: number) {
    const aspect = size.width / Math.max(1, size.height);
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }

  function applyCameraPose(pose: CameraPose) {
    currentPose = clonePose(pose);
    setFrustum(pose.viewHeight);
    const distance = Math.max(32, pose.viewHeight * 2.6);
    const cosPitch = Math.cos(pose.pitch);
    camera.position.set(
      pose.target.x + Math.sin(pose.yaw) * cosPitch * distance,
      pose.target.y + Math.sin(pose.pitch) * distance,
      pose.target.z + Math.cos(pose.yaw) * cosPitch * distance
    );
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
  }

  function frameForCell(view: SectionView, cellId: string): CameraPose {
    return toPose(frameFor(view, cellId, size.width / Math.max(1, size.height)));
  }

  function setKnightCell(cellId: string) {
    const [x, y] = cellOrigin3d(cellId);
    knight.position.set(x, y + 0.03, 0.34);
  }

  function setPendant() {
    if (currentInput.hour === 23 && pendant && pendantCell === currentInput.current) return;
    if (pendant) {
      scene.remove(pendant);
      pendant = null;
      pendantCell = null;
    }
    if (currentInput.hour !== 23) return;
    const [x, y, z] = cellOrigin3d(currentInput.current);
    pendant = new THREE.PointLight(PALETTE.light, 2.4, 5.2);
    pendant.position.set(x, y + 2.35, z + 0.1);
    pendantCell = currentInput.current;
    scene.add(pendant);
  }

  function updateLighting(input: BuildingInput) {
    const light = HOUR_LIGHT[input.hour];
    const angle = ((light.angle - 112) * Math.PI) / 180;
    const direction = new THREE.Vector3(...LIGHT_2000.sunDir);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    const focus = cellOrigin3d(input.focus);
    sun.target.position.set(focus[0], focus[1] + CELL_ROOM.H / 2, focus[2]);
    sun.position.copy(sun.target.position).addScaledVector(direction, -60);
    sun.color.set(light.tint);
    sun.intensity = LIGHT_2000.sunIntensity * (1 - light.night * 1.5);
    hemi.intensity = LIGHT_2000.hemiIntensity * (1 - light.night);
    hemi.color.set(light.night > 0.3 ? PALETTE.roof : LIGHT_2000.hemiSky);
    for (const entry of rooms.values()) {
      const sky = entry.group.userData.windowMaterial as THREE.MeshBasicMaterial | undefined;
      sky?.color.set(input.hour === 23 ? PALETTE.roof : light.tint);
    }
    const currentCell = CELL_BY_ID[input.current];
    if (currentCell) {
      section.elevatorNeedle.position.y = currentCell.floor * SECTION_PITCH.y + 1.3;
    }
    setPendant();
    const shadowSpan = 3 * Math.max(SECTION_PITCH.x, SECTION_PITCH.y);
    sun.shadow.camera.left = -shadowSpan / 2;
    sun.shadow.camera.right = shadowSpan / 2;
    sun.shadow.camera.top = shadowSpan / 2;
    sun.shadow.camera.bottom = -shadowSpan / 2;
    sun.shadow.camera.updateProjectionMatrix();
  }

  function builtRoomIds(): Set<string> {
    return new Set(rooms.keys());
  }

  function refreshAtlas() {
    atlas.refresh({
      focusCellId: currentInput.focus,
      visited: new Set(currentInput.visited),
      lamps: new Set(currentInput.lamps),
      hour: currentInput.hour,
      builtRooms: builtRoomIds(),
    });
  }

  function evictRoom(cellId: string) {
    const entry = rooms.get(cellId);
    if (!entry) return;
    roomsRoot.remove(entry.group);
    disposeGroupContents(entry.group);
    rooms.delete(cellId);
    refreshAtlas();
  }

  function updateRoomDemand(input: BuildingInput) {
    const visitedSet = new Set(input.visited);
    desiredRooms = new Set(
      SECTION_CELL_IDS.filter((id) => detailTier(id, input.focus, visitedSet) === 'room')
    );
    for (const id of desiredRooms) {
      const entry = rooms.get(id);
      if (entry) {
        rooms.delete(id);
        rooms.set(id, entry);
      }
    }
    roomQueue = [...desiredRooms].filter((id) => !rooms.has(id));
    while (rooms.size + roomQueue.length > MAX_ROOMS) {
      const leastRecent = [...rooms.keys()].find((id) => !desiredRooms.has(id));
      if (!leastRecent) break;
      evictRoom(leastRecent);
      roomQueue = [...desiredRooms].filter((id) => !rooms.has(id));
    }
  }

  function buildOneRoom() {
    const cellId = roomQueue.shift();
    if (!cellId || rooms.has(cellId) || !desiredRooms.has(cellId)) return;
    const started = performance.now();
    const group = buildCellRoom(cellScene(cellId), cellId);
    const [x, y, z] = cellOrigin3d(cellId);
    group.position.set(x, y, z);
    roomsRoot.add(group);
    rooms.set(cellId, { group });
    lastRoomBuildMs = performance.now() - started;
    roomBuildMs += lastRoomBuildMs;
    roomsBuilt += 1;
    refreshAtlas();
    updateLighting(currentInput);
  }

  function addCameraTween(to: CameraPose, duration = 700) {
    cameraTween = {
      from: clonePose(currentPose),
      to: clonePose(to),
      started: performance.now(),
      duration,
    };
    cameraFlight = null;
  }

  function startFlight(input: BuildingInput) {
    const move = input.lastMove;
    if (!move) return;
    const path = flightPath(move.from, move.to, move.kind);
    if (path.length < 2) return;
    const frames = path.map((id) => frameForCell(input.view, id));
    const duration = move.kind === 'knight' ? 900 : 720;
    const flightHeight = Math.max(
      currentPose.viewHeight,
      frames[frames.length - 1].viewHeight * 1.75,
      input.view === 'room' ? frames[0].viewHeight * 2.05 : frames[0].viewHeight
    );
    setKnightCell(move.from);
    cameraFlight = {
      path,
      frames,
      started: performance.now(),
      duration,
      flightHeight,
    };
    cameraTween = null;
  }

  function interpolatePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
    return {
      target: from.target.clone().lerp(to.target, t),
      viewHeight: from.viewHeight + (to.viewHeight - from.viewHeight) * t,
      yaw: from.yaw + (to.yaw - from.yaw) * t,
      pitch: from.pitch + (to.pitch - from.pitch) * t,
    };
  }

  function updateCamera(now: number) {
    if (cameraFlight) {
      const flight = cameraFlight;
      const progress = Math.min(1, (now - flight.started) / flight.duration);
      const segmentCount = flight.path.length - 1;
      const scaled = progress * segmentCount;
      const segment = Math.min(segmentCount - 1, Math.floor(scaled));
      const segmentT = progress >= 1 ? 1 : scaled - segment;
      const fromFrame = flight.frames[segment];
      const toFrame = flight.frames[segment + 1];
      const eased = segmentT * segmentT * (3 - 2 * segmentT);
      const moving = interpolatePose(fromFrame, toFrame, eased);
      moving.viewHeight = flight.flightHeight;
      applyCameraPose(moving);

      const startId = flight.path[segment];
      const endId = flight.path[segment + 1];
      const [x1, y1] = cellOrigin3d(startId);
      const [x2, y2] = cellOrigin3d(endId);
      const hop = Math.sin(Math.PI * segmentT) * 0.52;
      knight.position.set(x1 + (x2 - x1) * eased, y1 + (y2 - y1) * eased + hop + 0.03, 0.34);

      if (progress >= 1) {
        cameraFlight = null;
        setKnightCell(flight.path[flight.path.length - 1]);
        addCameraTween(frameForCell(currentInput.view, currentInput.focus), 700);
      }
      return;
    }
    if (cameraTween) {
      const tween = cameraTween;
      const t = Math.min(1, (now - tween.started) / tween.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      applyCameraPose(interpolatePose(tween.from, tween.to, eased));
      if (t >= 1) cameraTween = null;
    }
  }

  function clearOverlay(group: THREE.Group) {
    disposeGroupContents(group);
  }

  function makeOutline(cellId: string) {
    const cell = CELL_BY_ID[cellId];
    if (!cell) return;
    const [x, y] = cellOrigin3d(cellId);
    const x0 = x - CELL_ROOM.W / 2;
    const x1 = x + CELL_ROOM.W / 2;
    const y0 = y;
    const y1 = y + CELL_ROOM.H;
    const points = [
      new THREE.Vector3(x0, y0, FRONT_Z + 0.08),
      new THREE.Vector3(x1, y0, FRONT_Z + 0.08),
      new THREE.Vector3(x1, y1, FRONT_Z + 0.08),
      new THREE.Vector3(x0, y1, FRONT_Z + 0.08),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: PALETTE.accent, linewidth: 2 });
    const line = new THREE.LineLoop(geometry, material);
    line.renderOrder = 1100;
    hoverGroup.add(line);
  }

  function screenPoint(point: THREE.Vector3): THREE.Vector3 {
    camera.updateMatrixWorld();
    return point.clone().project(camera);
  }

  function isVisible(point: THREE.Vector3): boolean {
    const projected = screenPoint(point);
    return projected.x >= -1.08 && projected.x <= 1.08 && projected.y >= -1.08 && projected.y <= 1.08 && projected.z >= -1 && projected.z <= 1;
  }

  function layoutHotspots() {
    const worldPerPixel = currentPose.viewHeight / Math.max(1, size.height);
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    const placed: Array<{ x: number; y: number; size: number }> = [];
    for (const object of hotspotGroup.children) {
      const sprite = object as THREE.Sprite;
      const anchor = sprite.userData.anchor as THREE.Vector3;
      const tagSize = 30 * (sprite.userData.highlighted ? 1.3 : 1);
      let offset = 0;
      let candidate = anchor.clone();
      let projected = screenPoint(candidate);
      let x = ((projected.x + 1) * size.width) / 2;
      let y = ((1 - projected.y) * size.height) / 2;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        candidate = anchor.clone().addScaledVector(screenUp, offset * worldPerPixel);
        projected = screenPoint(candidate);
        x = ((projected.x + 1) * size.width) / 2;
        y = ((1 - projected.y) * size.height) / 2;
        const overlaps = placed.some(
          (other) =>
            Math.abs(x - other.x) < (tagSize + other.size) / 2 + 4 &&
            Math.abs(y - other.y) < (tagSize + other.size) / 2 + 4
        );
        if (!overlaps) break;
        offset += tagSize + 4;
      }
      sprite.position.copy(candidate);
      sprite.scale.set(tagSize * worldPerPixel, tagSize * worldPerPixel, 1);
      placed.push({ x, y, size: tagSize });
    }
  }

  function refreshHotspots(input: BuildingInput) {
    clearOverlay(hotspotGroup);
    input.hotspots.forEach((hotspot, index) => {
      const sprite = hotspotSprite(
        hotspot,
        index,
        input.focus,
        input.highlight === hotspot.lineId
      );
      hotspotGroup.add(sprite);
    });
  }

  function refreshMoveTags(input: BuildingInput) {
    clearOverlay(moveGroup);
    for (const [cellId, target] of Object.entries(input.targets)) {
      const [x, y] = cellOrigin3d(cellId);
      const sprite = spriteFor(moveTagTexture(target), 1, 1, { cellId, kind: target.kind });
      sprite.position.set(x, y + CELL_ROOM.H - 0.18, FRONT_Z + 0.12);
      sprite.userData.desiredPixels = { width: 72, height: 25 };
      moveGroup.add(sprite);
    }
  }

  function refreshChangedTags(input: BuildingInput) {
    clearOverlay(changedGroup);
    for (const cellId of input.changed) {
      const [x, y] = cellOrigin3d(cellId);
      const sprite = spriteFor(changedTagTexture(), 1, 1, { cellId });
      sprite.position.set(x - 1.22, y + 0.32, FRONT_Z + 0.12);
      sprite.userData.desiredPixels = { width: 25, height: 25 };
      changedGroup.add(sprite);
    }
  }

  function layoutCellSprites(group: THREE.Group, pixels: { width: number; height: number }) {
    const worldPerPixel = currentPose.viewHeight / Math.max(1, size.height);
    for (const child of group.children) {
      const sprite = child as THREE.Sprite;
      const cellId = sprite.userData.cellId as string | undefined;
      if (currentInput.view === 'room' && cellId) {
        sprite.visible = isVisible(sprite.position);
      } else {
        sprite.visible = true;
      }
      const desired = sprite.userData.desiredPixels as { width: number; height: number } | undefined;
      const width = desired?.width ?? pixels.width;
      const height = desired?.height ?? pixels.height;
      sprite.scale.set(width * worldPerPixel, height * worldPerPixel, 1);
    }
  }

  function refreshHover() {
    clearOverlay(hoverGroup);
    if (hoverCell) makeOutline(hoverCell);
  }

  function updateOverlays(input: BuildingInput) {
    refreshHotspots(input);
    refreshMoveTags(input);
    refreshChangedTags(input);
    refreshHover();
  }

  function pickedHotspot(event: PointerEvent): THREE.Sprite | undefined {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(hotspotGroup.children, false)[0]?.object as THREE.Sprite | undefined;
  }

  function pickedCell(event: PointerEvent): string | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(pickPlane, pickPoint)) return null;
    return cellAtPoint(pickPoint.x, pickPoint.y);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      pointerPositions.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      if (pointerPositions.size >= 2) {
        const [first, second] = [...pointerPositions.values()];
        const distance = first.distanceTo(second);
        if (pinchStartDistance !== null && Math.abs(distance - pinchStartDistance) > 38 && !pinchStartChanged) {
          stepView(distance > pinchStartDistance ? -1 : 1);
          pinchStartChanged = true;
          suppressClickUntil = performance.now() + 600;
        }
        if (pinchStartDistance === null) pinchStartDistance = distance;
      }
      return;
    }
    const hotspot = pickedHotspot(event);
    hoveredHotspot = hotspot ?? null;
    const nextCell = hotspot ? null : pickedCell(event);
    if (nextCell !== hoverCell) {
      hoverCell = nextCell;
      callbacks.onHoverCell(nextCell);
      refreshHover();
    }
    renderer.domElement.style.cursor = hotspot || nextCell ? 'pointer' : 'default';
  }

  function onPointerLeave() {
    hoveredHotspot = null;
    hoverCell = null;
    callbacks.onHoverCell(null);
    refreshHover();
    renderer.domElement.style.cursor = 'default';
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return;
    pointerPositions.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    if (pointerPositions.size >= 2) {
      const [first, second] = [...pointerPositions.values()];
      pinchStartDistance = first.distanceTo(second);
      pinchStartChanged = false;
    }
  }

  function onPointerUp(event: PointerEvent) {
    pointerPositions.delete(event.pointerId);
    if (pointerPositions.size < 2) {
      pinchStartDistance = null;
      pinchStartChanged = false;
    }
  }

  function onClick(event: MouseEvent) {
    if (performance.now() < suppressClickUntil) return;
    const pointerEvent = event as PointerEvent;
    const hotspot = pickedHotspot(pointerEvent);
    const lineId = hotspot?.userData.lineId;
    if (typeof lineId === 'string') {
      callbacks.onPickHotspot(lineId);
      return;
    }
    const cellId = pickedCell(pointerEvent);
    if (cellId) callbacks.onPickCell(cellId);
  }

  function stepView(direction: number) {
    const index = VIEW_ORDER.indexOf(requestedView);
    const next = VIEW_ORDER[Math.max(0, Math.min(VIEW_ORDER.length - 1, index + direction))];
    if (next === requestedView) return;
    requestedView = next;
    callbacks.onViewChange(next);
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    if (Math.abs(event.deltaY) < 2) return;
    stepView(event.deltaY > 0 ? 1 : -1);
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  function applyInput(input: BuildingInput, animate: boolean) {
    const previous = currentInput;
    currentInput = input;
    requestedView = input.view;
    ink.setMode(input.mode as InkMode);
    const visitedChanged = JSON.stringify(previous.visited) !== JSON.stringify(input.visited);
    const lampsChanged = JSON.stringify(previous.lamps) !== JSON.stringify(input.lamps);
    const demandChanged = previous.focus !== input.focus || visitedChanged;
    if (demandChanged) updateRoomDemand(input);
    if (demandChanged || lampsChanged || previous.hour !== input.hour) refreshAtlas();
    if (
      previous.focus !== input.focus ||
      previous.current !== input.current ||
      previous.hour !== input.hour
    ) {
      updateLighting(input);
    }
    if (previous.current !== input.current && input.lastMove === null) setKnightCell(input.current);
    if (animate) addCameraTween(frameForCell(input.view, input.focus));
  }

  refreshHotspots(initial);
  refreshMoveTags(initial);
  refreshChangedTags(initial);
  updateLighting(initial);
  updateRoomDemand(initial);
  refreshAtlas();
  ink.setMode(initial.mode);

  const resizeObserver = new ResizeObserver(() => {
    handle.resize(host.clientWidth, host.clientHeight);
  });
  resizeObserver.observe(host);

  function draw() {
    if (disposed) return;
    const now = performance.now();
    if (roomQueue.length > 0) buildOneRoom();
    updateCamera(now);
    camera.updateMatrixWorld();
    layoutHotspots();
    layoutCellSprites(moveGroup, { width: 72, height: 25 });
    layoutCellSprites(changedGroup, { width: 25, height: 25 });
    if (hoveredHotspot) renderer.domElement.style.cursor = 'pointer';

    renderer.info.reset();
    ink.render(currentPose.viewHeight);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(overlayScene, camera);
    renderer.autoClear = autoClear;

    const idle = roomQueue.length === 0 && !cameraTween && !cameraFlight;
    if (idle && firstReadyMs === null) firstReadyMs = performance.now() - startedAt;
    frame = requestAnimationFrame(draw);
  }

  const handle: BuildingHandle = {
    update(input) {
      const old = currentInput;
      const movementStarted = input.lastMove !== null && input.lastMove !== lastMoveObject;
      const changedFocus = input.focus !== old.focus || input.view !== old.view;
      const hotspotChanged =
        JSON.stringify(input.hotspots) !== JSON.stringify(old.hotspots) ||
        input.focus !== old.focus ||
        input.highlight !== old.highlight;
      const tagsChanged =
        JSON.stringify(input.targets) !== JSON.stringify(old.targets) ||
        JSON.stringify(input.changed) !== JSON.stringify(old.changed);
      currentInput = input;
      requestedView = input.view;
      if (movementStarted) {
        lastMoveObject = input.lastMove;
        applyInput(input, false);
        startFlight(input);
      } else {
        applyInput(input, false);
        if (changedFocus) addCameraTween(frameForCell(input.view, input.focus));
      }
      if (hotspotChanged || tagsChanged) updateOverlays(input);
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      size.width = width;
      size.height = height;
      renderer.setSize(width, height, false);
      ink.setSize(width, height);
      setFrustum(currentPose.viewHeight);
      camera.updateMatrixWorld();
      const framePose = frameForCell(currentInput.view, currentInput.focus);
      if (!cameraFlight) addCameraTween(framePose, 700);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      clearOverlay(hotspotGroup);
      clearOverlay(moveGroup);
      clearOverlay(changedGroup);
      clearOverlay(hoverGroup);
      disposeGroupContents(root);
      ink.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      host.replaceChildren();
    },
    stats() {
      const idle = roomQueue.length === 0 && !cameraTween && !cameraFlight;
      return {
        renderCalls: renderer.info.render.calls,
        drawCalls: renderer.info.render.calls,
        firstReadyMs,
        roomBuildMs,
        lastRoomBuildMs,
        roomsBuilt,
        idle,
      };
    },
  };

  handle.resize(host.clientWidth || 900, host.clientHeight || 620);
  frame = requestAnimationFrame(draw);
  return handle;
}
