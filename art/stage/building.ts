import * as THREE from 'three';
import { InkRenderer, type InkMode } from '../inkPass';
import { knightPiece } from '../knight';
import { CHARCOAL, HOUR_LIGHT, LIGHT_2000, PALETTE, TYPE } from '../palette';
import { toonMaterial } from '../materials';
import { drawCardArt } from '../draw/cardArt';
import { CELLS, CELL_BY_ID } from '../../world/damier';
import { buildCellRoom } from './cellRooms';
import { buildBuildingSection } from './buildingSection';
import { CELL_ROOM, cellScene, anchorFor, playerSpot } from './cellScenes';
import { createFlatsAtlas } from './flatsAtlas';
import { disposeGroup } from './dispose';
import { mechanismFor, restPose } from './mechanisms';
import { moveTimeline, type Key } from './motion';
import { lockReasonText } from '../../engine/selectors';
import type { Cue } from '../../audio/cues';
import {
  cellAtPoint,
  cellOrigin3d,
  detailTier,
  flightPath,
  frameFor,
  clampFrameTarget,
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
  elevatorFloor: number;
  view: SectionView;
  closeUp: string | null;
  hour: 20 | 21 | 22 | 23;
  mode: 'print' | 'blueprint';
  visited: string[];
  lamps: string[];
  changed: string[];
  targets: Record<string, { kind: FlightKind; minutes: number }>;
  hotspots: StageHotspot[];
  poseHotspots: StageHotspot[];
  poseHotspotsByCell: Record<string, StageHotspot[]>;
  highlight: string | null;
  armedLineId: string | null;
  previewMechanism?: { lineId: string; progress: number };
  previewLockLine?: string | null;
  previewParallax?: number;
  lastMove: { from: string; to: string; kind: FlightKind } | null;
  ambient: boolean;
  reducedMotion: boolean;
  clockMode?: 'realtime' | 'manual';
  pinCamera?: boolean;
}

export interface BuildingCallbacks {
  onAudioCue?(cue: Cue, key?: string, delayMs?: number): void;
  onPickHotspot(lineId: string): void;
  onPickCell(cellId: string): void;
  onHoverCell(cellId: string | null): void;
  onHoverLine(lineId: string | null): void;
  onCloseUp(lineId: string): void;
  onExitCloseUp(): void;
  getNotebookRect(): DOMRect | null;
  onViewChange(view: SectionView): void;
  onAmbientSimplified(): void;
}

export interface BuildingStats {
  renderCalls: number;
  drawCalls: number;
  firstReadyMs: number | null;
  firstInkRenderMs: number | null;
  inkRenderMs: number;
  rendererInitMs: number;
  mountSetupMs: number;
  roomBuildMs: number;
  lastRoomBuildMs: number;
  sketchMaterialSwapMs: number;
  shadowUpdateMs: number;
  atlasDrawMs: number;
  atlasPendingTiles: number;
  roomsBuilt: number;
  ambientOnMedianMs: number | null;
  ambientOffMedianMs: number | null;
  idle: boolean;
}

export interface BuildingHandle {
  update(input: BuildingInput): void;
  resize(width: number, height: number): void;
  advance(ms: number): Promise<void>;
  now(): number;
  partAt(clientX: number, clientY: number): string | null;
  notebookAnchor(rect: DOMRect): THREE.Vector3;
  wobblePart(lineId: string): void;
  animateCards(
    lineId: string,
    cardIds: string[],
    rect: DOMRect,
    onArrive: (cardId: string, from: { x: number; y: number }) => void
  ): void;
  dispose(): void;
  stats(): BuildingStats;
}

interface CameraPose {
  target: THREE.Vector3;
  viewHeight: number;
  yaw: number;
  pitch: number;
}

interface StageClock {
  manual: boolean;
  now(): number;
  advance(ms: number): void;
}

function createStageClock(manual: boolean): StageClock {
  let time = 0;
  return {
    manual,
    now: () => (manual ? time : performance.now()),
    advance(ms) {
      if (!manual) throw new Error('The stage clock is not in manual mode.');
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError('Manual clock advances must be finite and non-negative.');
      }
      time += ms;
    },
  };
}

interface RoomEntry {
  group: THREE.Group;
}

interface RoomInteraction {
  hotspot: StageHotspot;
  spec: ReturnType<typeof mechanismFor>;
  object: THREE.Object3D | null;
  cellId: string;
  anchor: THREE.Vector3;
}

interface MechanismTween {
  target: RoomInteraction;
  from: number;
  to: number;
  started: number;
  duration: number;
  onComplete?: () => void;
}

interface ActiveDrag {
  target: RoomInteraction;
  startX: number;
  startY: number;
  base: number;
  progress: number;
  moved: boolean;
}

interface ObjectFlight {
  target: RoomInteraction;
  from: THREE.Vector3;
  to: THREE.Vector3;
  startScale: THREE.Vector3;
  startRotation: THREE.Euler;
  targetRect: DOMRect;
  started: number;
  duration: number;
  onComplete: () => void;
}

interface CardFlight {
  cardId: string;
  mesh: THREE.Sprite;
  from: THREE.Vector3;
  to: THREE.Vector3;
  started: number;
  duration: number;
  targetRect: DOMRect;
  arrivalFrom: { x: number; y: number };
  onArrive: (cardId: string, from: { x: number; y: number }) => void;
}

interface CameraTween {
  from: CameraPose;
  to: CameraPose;
  started: number;
  duration: number;
}

interface CameraFlight {
  keys: Key[];
  from: string;
  to: string;
  started: number;
  duration: number;
  flightHeight: number;
  followOffset: THREE.Vector3;
  followVelocity: THREE.Vector3;
  followTarget: THREE.Vector3;
  lastTime: number;
  fromYaw: number;
  fromPitch: number;
  toYaw: number;
  toPitch: number;
}

interface ArrivalFade {
  started: number;
  duration: number;
  opacity: { value: number };
  overlay: THREE.Group | null;
  materials: Set<THREE.ShaderMaterial>;
  lineMaterial: THREE.LineBasicMaterial | null;
}

interface HourTransition {
  fromHour: BuildingInput['hour'];
  toHour: BuildingInput['hour'];
  started: number;
  duration: number;
  fromLamps: Set<string>;
  targetLamps: Set<string>;
  lampOrder: string[];
  lastLampKey: string;
  reducedMotion: boolean;
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
let ambientSimplifiedForSession = false;

function cellHash(cellId: string): number {
  let hash = 2166136261;
  for (const character of cellId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function medianMs(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const sketchPaperMaterial = toonMaterial(PALETTE.linen);
sketchPaperMaterial.userData.shared = true;
const sketchWindowMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.paper });
sketchWindowMaterial.userData.shared = true;
const sketchWindowLitMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.light });
sketchWindowLitMaterial.userData.shared = true;
const sketchLampOffMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.paperDeep });
sketchLampOffMaterial.userData.shared = true;
const sketchLampOnMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.light });
sketchLampOnMaterial.userData.shared = true;

function applySketchMode(group: THREE.Group, on: boolean) {
  if (group.userData.sketchMode === on) return;
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!('sketchOriginalMaterial' in mesh.userData)) {
      mesh.userData.sketchOriginalMaterial = mesh.material;
    }
    const original = mesh.userData.sketchOriginalMaterial as THREE.Material | THREE.Material[];
    if (!on) {
      mesh.material = original;
      return;
    }
    if (mesh.userData.sketchLamp) {
      mesh.material = sketchLampOffMaterial;
      return;
    }
    if (mesh.userData.sketchWindow) {
      mesh.material = sketchWindowMaterial;
      return;
    }
    const figureCutout = mesh.userData.cutout as THREE.Texture | undefined;
    const isFigure = Boolean(figureCutout || mesh.parent?.userData.sketchFigure);
    if (!isFigure) {
      mesh.material = sketchPaperMaterial;
      return;
    }
    let silhouette = mesh.userData.sketchSilhouetteMaterial as THREE.MeshBasicMaterial | undefined;
    if (!silhouette) {
      const sourceMaterial = Array.isArray(original) ? original[0] : original;
      silhouette = new THREE.MeshBasicMaterial({
        map: figureCutout ?? null,
        color: CHARCOAL.faint,
        transparent: true,
        opacity: 0.52,
        alphaTest: figureCutout ? sourceMaterial.alphaTest || 0.25 : 0,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      mesh.userData.sketchSilhouetteMaterial = silhouette;
    }
    mesh.material = silhouette;
  });
  group.userData.sketchMode = on;
}

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
  if (highlighted) {
    ctx.font = `bold 21px ${TYPE.mono}`;
    ctx.fillText(mechanismFor(hotspot.lineId, '').hint, 66, 105);
  }
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

function preferredHandLine(hotspots: StageHotspot[], hour: BuildingInput['hour']) {
  const open = hotspots.find((hotspot) => hotspot.status === 'open');
  if (open) return open;
  if (hour >= 22) {
    const lateLocked = hotspots.find(
      (hotspot) => hotspot.lineId === 'ev-bb-hand-late' && hotspot.status === 'locked'
    );
    if (lateLocked) return lateLocked;
  }
  return (
    hotspots.find((hotspot) => hotspot.status === 'locked') ??
    hotspots.find((hotspot) => hotspot.status === 'failed') ??
    hotspots.find((hotspot) => hotspot.status === 'done')
  );
}

function handRestLine(hotspots: StageHotspot[], hour: BuildingInput['hour']) {
  return (
    hotspots.find((hotspot) => hotspot.status === 'done') ??
    hotspots.find((hotspot) => hotspot.status === 'failed') ??
    hotspots.find((hotspot) => hotspot.status === 'open') ??
    preferredHandLine(hotspots, hour)
  );
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
  const animationClock = createStageClock(initial.clockMode === 'manual');
  const animationNow = () => animationClock.now();
  const startedAt = performance.now();
  const rendererStartedAt = performance.now();
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
  const rendererInitMs = performance.now() - rendererStartedAt;
  const renderPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(renderPixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  renderer.domElement.className = 'building-stage-canvas';
  renderer.domElement.setAttribute('aria-label', 'Valène 的整栋楼剖面');
  renderer.domElement.style.touchAction = 'none';
  host.replaceChildren(renderer.domElement);
  let shadowUpdateMs = 0;
  const renderShadowMap = renderer.shadowMap.render.bind(renderer.shadowMap);
  renderer.shadowMap.render = (lights, shadowScene, shadowCamera) => {
    const started = performance.now();
    renderShadowMap(lights, shadowScene, shadowCamera);
    shadowUpdateMs += performance.now() - started;
  };

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
    view: initial.view,
    builtRooms: new Set(),
  });
  root.add(atlas.mesh);

  const sun = new THREE.DirectionalLight(LIGHT_2000.sunColor, LIGHT_2000.sunIntensity);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = false;
  sun.shadow.mapSize.set(512, 512);
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
  const knight = knightPiece(0.45);
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
  const partHoverGroup = new THREE.Group();
  partHoverGroup.name = 'building-part-hover';
  scene.add(partHoverGroup);
  const lockTagGroup = new THREE.Group();
  lockTagGroup.name = 'building-lock-tags';
  overlayScene.add(lockTagGroup);
  const cardFlyGroup = new THREE.Group();
  cardFlyGroup.name = 'building-card-flights';
  overlayScene.add(cardFlyGroup);

  let currentInput: BuildingInput = initial;
  let focusRoomRequired =
    detailTier(initial.focus, initial.focus, new Set(initial.visited), initial.view) === 'room';
  let disposed = false;
  let currentPose = toPose(frameFor(initial.view, initial.focus, 1));
  let cameraTween: CameraTween | null = null;
  let cameraFlight: CameraFlight | null = null;
  let pendingArrivalFade: { cellId: string; duration: number } | null = null;
  const arrivalFades = new Map<string, ArrivalFade>();
  let hourTransition: HourTransition | null = null;
  let firstReadyMs: number | null = null;
  let firstInkRenderMs: number | null = null;
  let inkRenderMs = 0;
  let mountSetupMs = 0;
  let roomBuildMs = 0;
  let lastRoomBuildMs = 0;
  let sketchMaterialSwapMs = 0;
  let roomsBuilt = 0;
  let atlasRefreshPending = false;
  let shadowDirty = true;
  let frame = 0;
  let flightTimer: number | null = null;
  let flightRenderMode = false;
  function setFlightRenderMode(enabled: boolean) {
    if (flightRenderMode === enabled) return;
    flightRenderMode = enabled;
    renderer.setPixelRatio(enabled ? Math.min(renderPixelRatio, 0.5) : renderPixelRatio);
    renderer.setSize(size.width, size.height, false);
    ink.setSize(size.width, size.height);
  }
  let hoverCell: string | null = null;
  let hoveredHotspot: THREE.Sprite | null = null;
  let hoveredPart: RoomInteraction | null = null;
  let warmedPart: THREE.Object3D | null = null;
  let activeDrag: ActiveDrag | null = null;
  let parallaxStart: { x: number; y: number; pose: CameraPose } | null = null;
  const mechanismTweens = new Map<string, MechanismTween>();
  const objectFlights = new Map<string, ObjectFlight>();
  const cardFlights = new Set<CardFlight>();
  let lockTagTimeout: number | null = null;
  let lockTagHideAt: number | null = null;
  let previewLockTriggered = false;
  const lampLights = new Map<string, THREE.PointLight>();
  let lastMoveObject = initial.lastMove;
  let requestedView = initial.view;
  let ambientSuppressed = ambientSimplifiedForSession;
  let ambientWasActive = false;
  let lastAmbientUpdate = 0;
  let pendantLanding: { cellId: string; started: number } | null = null;
  let pausedAt: number | null = null;
  const ambientOnFrames: number[] = [];
  const ambientOffFrames: number[] = [];
  let suppressClickUntil = 0;
  const pointerPositions = new Map<number, THREE.Vector2>();
  let pinchStartDistance: number | null = null;
  let pinchStartChanged = false;
  const raycaster = new THREE.Raycaster();
  const brassRimMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.brass,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const pointer = new THREE.Vector2();
  const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT_Z);
  const pickPoint = new THREE.Vector3();
  const size = { width: 1, height: 1 };
  function updateSketchMode(group: THREE.Group, on: boolean) {
    const started = performance.now();
    applySketchMode(group, on);
    sketchMaterialSwapMs += performance.now() - started;
  }
  const initialFrame = frameFor(initial.view, initial.focus, 1);
  currentPose = animationClock.manual
    ? toPose(initialFrame)
    : toPose(initialFrame, initialFrame.viewHeight * 2.2);
  applyCameraPose(currentPose);
  cameraTween = animationClock.manual
    ? null
    : {
        from: clonePose(currentPose),
        to: toPose(initialFrame),
        started: animationNow(),
        duration: 600,
      };
  setKnightCell(initial.current);
  knight.visible = !initial.closeUp;

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

  function frameForInput(input: BuildingInput): CameraPose {
    const pose = frameForCell(input.view, input.focus);
    if (input.closeUp && input.view === 'room' && input.focus === input.current) {
      const target = interactionForLine(input.closeUp);
      if (target) pose.target.copy(target.anchor);
      pose.viewHeight = 1.2;
      pose.pitch += 0.055;
      if (input.closeUp === 'ev-bb-puzzle') pose.yaw -= 0.2;
    }
    const clamped = clampFrameTarget(
      { target: [pose.target.x, pose.target.y, pose.target.z], viewHeight: pose.viewHeight, yaw: pose.yaw, pitch: pose.pitch },
      size.width / Math.max(1, size.height)
    );
    pose.target.set(...clamped.target);
    if (input.previewParallax !== undefined && input.view === 'room') {
      const offset = THREE.MathUtils.clamp(input.previewParallax, -20, 20);
      pose.yaw += THREE.MathUtils.degToRad(offset);
      pose.pitch += THREE.MathUtils.degToRad((offset / 20) * 6);
    }
    return pose;
  }
  currentPose = frameForInput(initial);
  applyCameraPose(currentPose);
  cameraTween = null;

  function setKnightCell(cellId: string) {
    const [x, y, z] = cellOrigin3d(cellId);
    const [spotX, spotY, spotZ] = playerSpot(cellId);
    knight.position.set(x + spotX, y + spotY, z + spotZ);
  }

  function syncCloseUpProps(group: THREE.Group, input: BuildingInput) {
    const tablePiece = group.getObjectByName('bb-puzzle-piece');
    if (tablePiece) tablePiece.visible = !(input.closeUp && group.userData.cellId === '3:1');
  }

  function currentRoomInteractions(): RoomInteraction[] {
    if (currentInput.view !== 'room' || currentInput.focus !== currentInput.current) return [];
    const cellId = currentInput.current;
    const room = rooms.get(cellId);
    if (!room) return [];
    const handLines = currentInput.hotspots.filter(
      (hotspot) => hotspot.lineId === 'ev-bb-hand' || hotspot.lineId === 'ev-bb-hand-late'
    );
    const effectiveHand = preferredHandLine(handLines, currentInput.hour);
    const hotspots = currentInput.hotspots.filter(
      (hotspot) =>
        hotspot.lineId !== 'ev-bb-hand' &&
        hotspot.lineId !== 'ev-bb-hand-late'
    );
    if (effectiveHand) hotspots.push(effectiveHand);
    return hotspots.map((hotspot, index) => {
      const spec = mechanismFor(hotspot.lineId, cellId);
      const anchor = new THREE.Vector3(...cellOrigin3d(cellId)).add(
        new THREE.Vector3(...anchorFor(cellId, hotspot.lineId, index))
      );
      let object = spec.part ? room.group.getObjectByName(spec.part) ?? null : null;
      if (!object && spec.kind === 'generic') {
        const origin = new THREE.Vector3(...cellOrigin3d(cellId));
        const localAnchor = new THREE.Vector3(...anchorFor(cellId, hotspot.lineId, index));
        let nearestDistance = 0.45;
        room.group.updateMatrixWorld(true);
        room.group.traverse((candidate) => {
          const mesh = candidate as THREE.Mesh;
          if (!mesh.isMesh || !mesh.visible || mesh.userData.noInteract) return;
          const bounds = new THREE.Box3().setFromObject(mesh);
          if (bounds.isEmpty()) return;
          const center = bounds.getCenter(new THREE.Vector3()).sub(origin);
          const distance = center.distanceTo(localAnchor);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            object = mesh;
          }
        });
      }
      return { hotspot, spec, object, cellId, anchor };
    });
  }

  function interactionForLine(lineId: string): RoomInteraction | null {
    const interactions = currentRoomInteractions();
    const direct = interactions.find((interaction) => interaction.hotspot.lineId === lineId);
    if (direct) return direct;
    if (lineId === 'ev-bb-hand' || lineId === 'ev-bb-hand-late') {
      return interactions.find((interaction) => interaction.spec.part === 'bb-hand') ?? null;
    }
    return null;
  }

  function interactionForObject(object: THREE.Object3D): RoomInteraction | null {
    const interactions = currentRoomInteractions();
    for (const interaction of interactions) {
      if (!interaction.object) continue;
      if (interaction.object === object || interaction.object.getObjectById(object.id)) return interaction;
    }
    return null;
  }

  function applyInteractionPose(target: RoomInteraction, progress: number) {
    const object = target.object;
    if (!object) return;
    const pose = THREE.MathUtils.clamp(progress, 0, 1);
    object.userData.mechanismProgress = pose;
    if (!object.userData.restPosition) object.userData.restPosition = object.position.toArray();
    if (!object.userData.restRotation) object.userData.restRotation = object.rotation.toArray();
    if (!object.userData.restScale) object.userData.restScale = object.scale.toArray();
    const [baseX, baseY, baseZ] = object.userData.restPosition as [number, number, number];
    const [rotX, rotY, rotZ] = object.userData.restRotation as [number, number, number, string];
    object.visible =
      Boolean(object.userData.inFlight) ||
      !(target.hotspot.status === 'done' && (target.spec.kind === 'lift' || target.spec.kind === 'pickup'));
    object.position.set(baseX, baseY, baseZ);
    object.rotation.set(rotX, rotY, rotZ);
    object.scale.set(...(object.userData.restScale as [number, number, number]));
    if (target.spec.kind === 'lift') {
      const leftHinge = object.userData.leftHinge as THREE.Group | undefined;
      const rightHinge = object.userData.rightHinge as THREE.Group | undefined;
      object.position.y += pose * 0.5;
      object.rotation.z += Math.sin(pose * Math.PI) * 0.035;
      object.scale.multiplyScalar(1 - pose * 0.04);
      if (leftHinge) leftHinge.rotation.z = -pose * 1.42;
      if (rightHinge) rightHinge.rotation.z = pose * 1.42;
    } else if (target.spec.kind === 'flip') {
      const hinge = object.userData.coverHinge as THREE.Group | undefined;
      if (hinge) hinge.rotation.z = pose * 1.55 + Math.sin(pose * Math.PI) * 0.035;
      const page = object.getObjectByName('wk-notes-page-fan') as THREE.Object3D | undefined;
      if (page) page.rotation.z = pose * 0.18;
      object.rotation.z += Math.sin(pose * Math.PI) * 0.018;
    } else if (target.spec.kind === 'pry') {
      const state = pose < 0.2 ? 'closed' : pose < 0.72 ? 'half' : 'open';
      for (const child of object.children) {
        child.visible = child.userData.handPose === state;
      }
      object.rotation.z += Math.sin(pose * Math.PI) * 0.045;
    } else if (target.spec.kind === 'lean') {
      const trace = object.getObjectByName('bb-puzzle-trace') as THREE.Mesh | undefined;
      if (trace) {
        trace.visible = pose > 0.01;
        const material = trace.material as THREE.LineBasicMaterial;
        material.transparent = true;
        material.opacity = 0.96;
        const geometry = trace.geometry;
        const indexCount = geometry.index?.count ?? geometry.getAttribute('position').count;
        const indicesPerTubeSegment = 8 * 6;
        geometry.setDrawRange(
          0,
          Math.floor((indexCount * pose) / indicesPerTubeSegment) * indicesPerTubeSegment
        );
      }
    } else if (target.spec.kind === 'pickup') {
      object.position.y += pose * 0.3;
      object.rotation.y += pose * Math.PI * 2;
    }
    shadowDirty = true;
  }

  function applyRestPoses(group: THREE.Group, input: BuildingInput, cellId: string) {
    const hotspots = input.poseHotspotsByCell[cellId] ?? (cellId === input.focus ? input.poseHotspots : []);
    const handLines = hotspots.filter(
      (hotspot) => hotspot.lineId === 'ev-bb-hand' || hotspot.lineId === 'ev-bb-hand-late'
    );
    const effectiveHand = handRestLine(handLines, input.hour);
    for (const [index, hotspot] of hotspots.entries()) {
      if ((hotspot.lineId === 'ev-bb-hand' || hotspot.lineId === 'ev-bb-hand-late') && hotspot !== effectiveHand) continue;
      const spec = mechanismFor(hotspot.lineId, cellId);
      if (spec.kind === 'generic') continue;
      const object = group.getObjectByName(spec.part);
      if (!object) continue;
      const target = {
        hotspot,
        spec,
        object,
        cellId,
        anchor: new THREE.Vector3(...cellOrigin3d(cellId)).add(
          new THREE.Vector3(...anchorFor(cellId, hotspot.lineId, index))
        ),
      };
      const previewProgress =
        input.previewMechanism?.lineId === hotspot.lineId
          ? THREE.MathUtils.clamp(input.previewMechanism.progress, 0, 1)
          : null;
      applyInteractionPose(
        target,
        previewProgress ??
          (input.armedLineId === hotspot.lineId
            ? 1
            : restPose(hotspot.lineId, hotspot.status, input.hour))
      );
    }
  }

  function easeSpring(progress: number) {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    const omega = 7;
    const end = 1 - (1 + omega) * Math.exp(-omega);
    return (1 - (1 + omega * t) * Math.exp(-omega * t)) / end;
  }

  function animateMechanism(
    target: RoomInteraction,
    to: number,
    duration = 340,
    onComplete?: () => void,
    fromOverride?: number
  ) {
    const key = `${target.cellId}:${target.hotspot.lineId}`;
    const from =
      fromOverride ??
      (typeof target.object?.userData.mechanismProgress === 'number'
        ? target.object.userData.mechanismProgress
        : restPose(target.hotspot.lineId, target.hotspot.status, currentInput.hour));
    mechanismTweens.set(key, { target, from, to, started: animationNow(), duration, onComplete });
  }

  function notebookAnchor(rect: DOMRect): THREE.Vector3 {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const x =
      ((rect.left + rect.width / 2 - canvasRect.left) / Math.max(1, canvasRect.width)) * 2 - 1;
    const y =
      1 - ((rect.top + rect.height / 2 - canvasRect.top) / Math.max(1, canvasRect.height)) * 2;
    return new THREE.Vector3(x, y, -0.96).unproject(camera);
  }

  function animateCards(
    lineId: string,
    cardIds: string[],
    rect: DOMRect,
    onArrive: (cardId: string, from: { x: number; y: number }) => void
  ) {
    const target = interactionForLine(lineId);
    target?.object?.updateWorldMatrix(true, false);
    const bounds = target?.object ? new THREE.Box3().setFromObject(target.object) : null;
    const source =
      bounds && !bounds.isEmpty()
        ? bounds.getCenter(new THREE.Vector3())
        : target?.anchor.clone() ??
          new THREE.Vector3(...cellOrigin3d(currentInput.current)).add(
            new THREE.Vector3(...anchorFor(currentInput.current, lineId, 0))
          );
    const destination = notebookAnchor(rect);
    const arrivalFrom = { x: rect.width / 2, y: rect.height / 2 };
    cardIds.forEach((cardId, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 288;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = PALETTE.linen;
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawCardArt(context, cardId, 192);
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 6;
      context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Sprite(material);
      mesh.scale.set(0.42, 0.63, 1);
      mesh.renderOrder = 1300;
      mesh.position.copy(source).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), -0.13);
      mesh.rotation.z = (index % 2 ? 1 : -1) * 0.08;
      cardFlyGroup.add(mesh);
      cardFlights.add({
        cardId,
        mesh,
        from: mesh.position.clone(),
        to: destination.clone(),
        started: animationNow() + index * 120,
        duration: 680,
        targetRect: rect,
        arrivalFrom,
        onArrive,
      });
    });
  }

  function flyObjectToNotebook(target: RoomInteraction, onComplete: () => void) {
    const object = target.object;
    const rect = callbacks.getNotebookRect();
    if (!object || !object.parent || !rect) {
      onComplete();
      return;
    }
    object.updateWorldMatrix(true, false);
    const end = notebookAnchor(rect);
    const endLocal = object.parent.worldToLocal(end);
    object.userData.inFlight = true;
    objectFlights.set(`${target.cellId}:${target.hotspot.lineId}`, {
      target,
      from: object.position.clone(),
      to: endLocal,
      startScale: object.scale.clone(),
      startRotation: object.rotation.clone(),
      targetRect: rect,
      started: animationNow(),
      duration: 640,
      onComplete,
    });
  }

  function updateMechanisms(now: number) {
    for (const [key, tween] of mechanismTweens) {
      const t = Math.min(1, (now - tween.started) / tween.duration);
      const eased = easeSpring(t);
      applyInteractionPose(tween.target, tween.from + (tween.to - tween.from) * eased);
      if (t >= 1) {
        mechanismTweens.delete(key);
        tween.onComplete?.();
      }
    }
    for (const [key, flight] of objectFlights) {
      const object = flight.target.object;
      if (!object?.parent) {
        objectFlights.delete(key);
        flight.onComplete();
        continue;
      }
      const t = Math.min(1, (now - flight.started) / flight.duration);
      const eased = easeSpring(t);
      flight.to.copy(object.parent.worldToLocal(notebookAnchor(flight.targetRect)));
      object.position.lerpVectors(flight.from, flight.to, eased);
      object.scale.copy(flight.startScale).multiplyScalar(1 - eased * 0.82);
      object.rotation.copy(flight.startRotation);
      object.rotation.y += eased * Math.PI * 2;
      object.position.y += Math.sin(t * Math.PI) * 0.3;
      shadowDirty = true;
      if (t >= 1) {
        objectFlights.delete(key);
        object.visible = false;
        object.userData.inFlight = false;
        flight.onComplete();
      }
    }
    for (const flight of cardFlights) {
      const t = (now - flight.started) / flight.duration;
      if (t < 0) {
        flight.mesh.visible = false;
        continue;
      }
      flight.mesh.visible = true;
      const progress = Math.min(1, t);
      const eased = easeSpring(progress);
      flight.to.copy(notebookAnchor(flight.targetRect));
      flight.mesh.position.lerpVectors(flight.from, flight.to, eased);
      flight.mesh.position.addScaledVector(camera.up, Math.sin(progress * Math.PI) * 0.42);
      const material = flight.mesh.material as THREE.SpriteMaterial;
      material.rotation = Math.sin(progress * Math.PI) * 0.28;
      const curl = 0.72 + Math.abs(Math.sin(progress * Math.PI * 2)) * 0.28;
      flight.mesh.scale.set(0.42 * curl * (1 - eased * 0.45), 0.63 * (1 - eased * 0.45), 1);
      if (progress >= 1) {
        cardFlights.delete(flight);
        cardFlyGroup.remove(flight.mesh);
        material.map?.dispose();
        material.dispose();
        flight.onArrive(flight.cardId, flight.arrivalFrom);
      }
    }
    for (const target of currentRoomInteractions()) {
      const wobble = target.object?.userData.wobble as
        | { started: number; duration: number; base: number; amplitude: number }
        | undefined;
      if (!target.object || !wobble) continue;
      const t = (now - wobble.started) / wobble.duration;
      if (t >= 1) {
        target.object.rotation.z = wobble.base;
        delete target.object.userData.wobble;
      } else {
        target.object.rotation.z = wobble.base + Math.sin(t * Math.PI * 8) * (1 - t) * wobble.amplitude;
      }
    }
  }

  function wobble(target: RoomInteraction, amplitude: number, duration: number) {
    if (!target.object) return;
    target.object.userData.wobble = {
      started: animationNow(),
      duration,
      base: target.object.rotation.z,
      amplitude,
    };
  }

  function showLockTag(target: RoomInteraction, autoHide = true) {
    if (!target.hotspot.lock) return;
    if (lockTagTimeout !== null) window.clearTimeout(lockTagTimeout);
    lockTagTimeout = null;
    lockTagHideAt = null;
    disposeGroupContents(lockTagGroup);
    const message = lockReasonText(target.hotspot.lock);
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = PALETTE.linen;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(12, 10);
    ctx.lineTo(408, 14);
    ctx.lineTo(402, 108);
    ctx.lineTo(9, 104);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 26px ${TYPE.mono}`;
    ctx.fillText(message, 210, 59, 370);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    target.object?.updateWorldMatrix(true, false);
    const bounds = target.object ? new THREE.Box3().setFromObject(target.object) : null;
    const center = bounds && !bounds.isEmpty() ? bounds.getCenter(new THREE.Vector3()) : target.anchor.clone();
    const offset = currentInput.closeUp === target.hotspot.lineId
      ? new THREE.Vector3(0.45, 0.42, 0.3)
      : new THREE.Vector3(1.1, 0.35, 0.45);
    const tagPosition = center.clone().add(offset);
    const thread = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([center, tagPosition]),
      new THREE.LineBasicMaterial({ color: PALETTE.ink })
    );
    thread.renderOrder = 1200;
    lockTagGroup.add(thread);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.39),
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
    );
    tag.renderOrder = 1201;
    tag.position.copy(tagPosition);
    lockTagGroup.add(tag);
    wobble(target, 0.11, 360);
    if (autoHide) {
      lockTagHideAt = animationNow() + 2400;
      if (!animationClock.manual) {
        lockTagTimeout = window.setTimeout(() => {
          disposeGroupContents(lockTagGroup);
          lockTagHideAt = null;
          lockTagTimeout = null;
        }, 2400);
      }
    }
  }

  function feedbackFor(target: RoomInteraction) {
    if (target.hotspot.status === 'done') {
      wobble(target, 0.035, 190);
      return;
    }
    if (target.hotspot.status === 'locked' || target.hotspot.status === 'failed') {
      showLockTag(target);
      if (!target.hotspot.lock) wobble(target, 0.11, 360);
    }
  }

  function refreshPartHover() {
    if (warmedPart) {
      warmedPart.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !('hoverOriginalMaterial' in mesh.userData)) return;
        mesh.material = mesh.userData.hoverOriginalMaterial as THREE.Material | THREE.Material[];
        delete mesh.userData.hoverOriginalMaterial;
      });
      warmedPart = null;
    }
    for (const child of [...partHoverGroup.children]) partHoverGroup.remove(child);
    const target = hoveredPart ?? (currentInput.highlight ? interactionForLine(currentInput.highlight) : null);
    if (!target?.object) return;
    target.object.updateWorldMatrix(true, true);
    target.object.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      if (!('hoverOriginalMaterial' in mesh.userData)) {
        const original = mesh.material;
        mesh.userData.hoverOriginalMaterial = original;
        const warm = (material: THREE.Material) => {
          const clone = material.clone();
          if ('emissive' in clone) {
            const emissive = (clone as THREE.MeshToonMaterial).emissive;
            emissive.set(PALETTE.brass);
            (clone as THREE.MeshToonMaterial).emissiveIntensity = 0.18;
          } else if ('color' in clone) {
            (clone as THREE.MeshBasicMaterial).color.lerp(new THREE.Color(PALETTE.brass), 0.11);
          }
          return clone;
        };
        mesh.material = Array.isArray(original) ? original.map(warm) : warm(original);
      }
      const hull = new THREE.Mesh(mesh.geometry, brassRimMaterial);
      hull.position.copy(mesh.getWorldPosition(new THREE.Vector3()));
      hull.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));
      hull.scale.copy(mesh.getWorldScale(new THREE.Vector3())).multiplyScalar(1.035);
      hull.renderOrder = 20;
      hull.frustumCulled = false;
      partHoverGroup.add(hull);
    });
    warmedPart = target.object;
  }

  function syncLiftDials(floor: number, moving = false, now = animationNow()) {
    const angle = -0.48 + floor * 0.12 + (moving ? Math.sin(now * 0.006) * 0.022 : 0);
    section.elevatorCage.position.y = floor * SECTION_PITCH.y;
    section.elevatorNeedle.position.y = floor * SECTION_PITCH.y + 1.3;
    section.elevatorCage.position.z = CELL_ROOM.D / 2 + 0.12;
    section.elevatorNeedle.position.z = CELL_ROOM.D / 2 + 0.22;
    section.elevatorNeedle.rotation.z = angle;
    for (const entry of rooms.values()) {
      const needle = entry.group.getObjectByName('lift-dial-needle') as THREE.Mesh | undefined;
      if (needle) {
        needle.userData.ambientBaseRotation = angle;
        needle.rotation.z = angle;
      }
    }
  }

  function ambientIsActive() {
    return (
      currentInput.ambient &&
      !currentInput.reducedMotion &&
      !ambientSuppressed &&
      !currentInput.closeUp &&
      (currentInput.view === 'room' || currentInput.view === 'block')
    );
  }

  function resetAmbient() {
    for (const entry of rooms.values()) resetAmbientEntry(entry);
    ambientWasActive = false;
  }

  function resetAmbientEntry(entry: RoomEntry) {
    entry.group.traverse((object) => {
      if (object.userData.ambientFigure || object.name === 'ambient-second-hand') {
        object.rotation.z = 0;
      }
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name === 'ambient-boiler-fire') {
        mesh.scale.y = 1;
        const material = (mesh.userData.sketchOriginalMaterial ?? mesh.material) as THREE.MeshBasicMaterial;
        material.color.set(PALETTE.accent);
        material.opacity = 0.76;
      }
      if (mesh.name === 'lift-dial-needle') {
        mesh.rotation.z = Number(mesh.userData.ambientBaseRotation ?? -0.48);
      }
      if (mesh.userData.ambientMote !== undefined) {
        const base = mesh.userData.basePosition as [number, number, number];
        mesh.position.set(...base);
      }
    });
    const curtains = entry.group.getObjectByName('ambient-curtains');
    curtains?.children.forEach((panel) => {
      panel.rotation.z = 0;
      panel.rotation.y = 0;
    });
    const pendant = entry.group.getObjectByName('ambient-pendant');
    if (pendant) pendant.rotation.z = 0;
    const dust = entry.group.getObjectByName('ambient-dust');
    if (dust) dust.visible = false;
    const fireLight = entry.group.getObjectByName('ambient-fire-light') as THREE.PointLight | undefined;
    if (fireLight) fireLight.intensity = 1.4;
  }

  function updateAmbient(now: number) {
    if (!ambientIsActive()) {
      if (ambientWasActive) resetAmbient();
      return;
    }
    if (now - lastAmbientUpdate < 1000 / 30) return;
    lastAmbientUpdate = now;
    ambientWasActive = true;
    for (const [cellId, entry] of rooms) {
      if (
        !entry.group.visible ||
        !desiredRooms.has(cellId) ||
        entry.group.userData.sketchMode
      ) continue;
      const phase = (cellHash(cellId) % 628319) / 100000;
      entry.group.traverse((object) => {
        if (object.userData.ambientFigure) {
          object.rotation.z = Math.sin(now * 0.0012 + phase) * 0.010472;
        }
        if (object.name === 'ambient-second-hand') {
          object.rotation.z = -(((now / 1000 + phase * 7) % 60) / 60) * Math.PI * 2;
        }
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.name === 'ambient-boiler-fire') {
          const flicker =
            0.5 +
            Math.sin(now * 0.019 + phase) * 0.28 +
            Math.sin(now * 0.031 + phase * 1.7) * 0.16;
          mesh.scale.y = 0.88 + flicker * 0.3;
          const material = mesh.material as THREE.MeshBasicMaterial;
          material.color.set(PALETTE.paperDeep).lerp(new THREE.Color(PALETTE.accent), flicker);
          material.opacity = 0.58 + flicker * 0.24;
          const fireLight = entry.group.getObjectByName('ambient-fire-light') as THREE.PointLight | undefined;
          if (fireLight) fireLight.intensity = 0.95 + flicker * 1.05;
        }
        if (mesh.userData.ambientMote !== undefined) {
          const base = mesh.userData.basePosition as [number, number, number];
          const index = Number(mesh.userData.ambientMote);
          const drift = now * 0.00018 + phase + index * 1.7;
          mesh.position.set(
            base[0] + Math.sin(drift) * 0.045,
            base[1] + Math.sin(drift * 0.35) * 0.21,
            base[2] + Math.cos(drift * 0.7) * 0.025
          );
        }
      });
      const curtains = entry.group.getObjectByName('ambient-curtains');
      curtains?.children.forEach((panel, index) => {
        const panelPhase = phase + index * 0.8;
        panel.rotation.z = Math.sin(now * 0.0009 + panelPhase) * 0.026;
        panel.rotation.y = Math.sin(now * 0.0007 + panelPhase) * 0.018;
      });
      const needle = entry.group.getObjectByName('lift-dial-needle') as THREE.Mesh | undefined;
      if (needle && cellId === '0:7') {
        const base = Number(needle.userData.ambientBaseRotation ?? needle.rotation.z);
        needle.rotation.z = base + Math.sin(now * 0.006 + phase) * 0.008;
      }
      const dust = entry.group.getObjectByName('ambient-dust');
      if (dust) dust.visible = cellId === currentInput.current;
      const pendant = entry.group.getObjectByName('ambient-pendant');
      if (pendant) {
        const elapsed =
          pendantLanding?.cellId === cellId ? now - pendantLanding.started : Number.POSITIVE_INFINITY;
        pendant.rotation.z =
          elapsed >= 0 && elapsed < 2000
            ? Math.sin(elapsed * 0.016 + phase) * 0.058 * Math.exp(-elapsed / 760)
            : 0;
      }
    }
    if (pendantLanding && now - pendantLanding.started >= 2000) pendantLanding = null;
  }

  function targetLampCells(input: BuildingInput): Set<string> {
    const cells = new Set(input.hour >= 21 ? input.lamps : []);
    if (input.hour === 23) cells.add(input.current);
    return cells;
  }

  function lampCellsAt(input: BuildingInput, now: number): Set<string> {
    const transition = hourTransition;
    const target = transition?.targetLamps ?? targetLampCells(input);
    if (!transition || transition.reducedMotion || transition.lampOrder.length === 0) return target;
    const cells = new Set([...target].filter((cellId) => transition.fromLamps.has(cellId)));
    const lastIndex = Math.max(1, transition.lampOrder.length - 1);
    transition.lampOrder.forEach((cellId, index) => {
      const started =
        transition.started + (index / lastIndex) * 1500;
      if (now < started) return;
      const flicker = now - started;
      const on =
        flicker >= 150 ||
        flicker < 38 ||
        (flicker >= 72 && flicker < 112);
      if (on) cells.add(cellId);
    });
    return cells;
  }

  function blendedHour(now: number) {
    if (!hourTransition) {
      const light = HOUR_LIGHT[currentInput.hour];
      return {
        ...light,
        tint: new THREE.Color(light.tint),
        shade: new THREE.Color(light.shade),
      };
    }
    const progress = Math.min(
      1,
      Math.max(0, (now - hourTransition.started) / hourTransition.duration)
    );
    const eased = progress * progress * (3 - 2 * progress);
    const from = HOUR_LIGHT[hourTransition.fromHour];
    const to = HOUR_LIGHT[hourTransition.toHour];
    return {
      tint: new THREE.Color(from.tint).lerp(new THREE.Color(to.tint), eased),
      shade: new THREE.Color(from.shade).lerp(new THREE.Color(to.shade), eased),
      angle: from.angle + (to.angle - from.angle) * eased,
      strength: from.strength + (to.strength - from.strength) * eased,
      night: from.night + (to.night - from.night) * eased,
    };
  }

  function updateLampLights(input: BuildingInput, now = animationNow()) {
    const litCells = lampCellsAt(input, now);
    for (const [cellId, pointLight] of lampLights) {
      if (litCells.has(cellId) && rooms.get(cellId)?.group.visible) continue;
      scene.remove(pointLight);
      lampLights.delete(cellId);
    }
    for (const cellId of litCells) {
      const entry = rooms.get(cellId);
      if (!entry?.group.visible || !entry.group.userData.hasPendant || lampLights.has(cellId)) continue;
      const [x, y, z] = cellOrigin3d(cellId);
      const pointLight = new THREE.PointLight(PALETTE.light, 1.8, 5.2);
      pointLight.position.set(x, y + 2.45, z);
      lampLights.set(cellId, pointLight);
      scene.add(pointLight);
    }
    for (const [cellId, entry] of rooms) {
      const lit = litCells.has(cellId);
      const bulb = entry.group.getObjectByName('pendant-bulb') as THREE.Mesh | undefined;
      if (entry.group.userData.sketchMode && bulb) {
        bulb.material = lit ? sketchLampOnMaterial : sketchLampOffMaterial;
        continue;
      }
      const material = bulb?.material as THREE.MeshBasicMaterial | undefined;
      material?.color.set(lit ? PALETTE.light : PALETTE.paperDeep);
    }
  }

  function updateHourLighting(input: BuildingInput, now = animationNow()) {
    const light = blendedHour(now);
    const angle = ((light.angle - 112) * Math.PI) / 180;
    const direction = new THREE.Vector3(...LIGHT_2000.sunDir);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    const focus = cellOrigin3d(input.focus);
    sun.target.position.set(focus[0], focus[1] + CELL_ROOM.H / 2, focus[2]);
    sun.position.copy(sun.target.position).addScaledVector(direction, -60);
    sun.color.copy(light.tint);
    sun.intensity = LIGHT_2000.sunIntensity * (1 - light.night * 1.5);
    hemi.intensity = Math.max(1.08, LIGHT_2000.hemiIntensity * (1 - light.night * 0.35));
    hemi.color.set(LIGHT_2000.hemiSky).lerp(new THREE.Color(PALETTE.linen), light.night);
    const sky = scene.background;
    if (sky instanceof THREE.Color) {
      sky.set(PALETTE.paper).lerp(light.tint, 0.025 + light.night * 0.05);
    }
    atlas.mesh.material.color
      .set('#ffffff')
      .lerp(light.tint, 0.045 + light.strength * 0.04)
      .lerp(light.shade, light.night * 0.03);
    const litCells = lampCellsAt(input, now);
    for (const [cellId, entry] of rooms) {
      const sky = entry.group.userData.windowMaterial as THREE.MeshBasicMaterial | undefined;
      const lit = litCells.has(cellId);
      sky?.color.copy(lit ? new THREE.Color(PALETTE.light) : light.tint);
      if (entry.group.userData.sketchMode) {
        entry.group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh && mesh.userData.sketchWindow) {
            mesh.material = lit ? sketchWindowLitMaterial : sketchWindowMaterial;
          }
        });
      }
    }
  }

  function updateLighting(input: BuildingInput, shadowChanged = false) {
    updateHourLighting(input);
    syncLiftDials(input.elevatorFloor);
    updateLampLights(input);
    const shadowSpan = 3 * Math.max(SECTION_PITCH.x, SECTION_PITCH.y);
    sun.shadow.camera.left = -shadowSpan / 2;
    sun.shadow.camera.right = shadowSpan / 2;
    sun.shadow.camera.top = shadowSpan / 2;
    sun.shadow.camera.bottom = -shadowSpan / 2;
    sun.shadow.camera.updateProjectionMatrix();
    if (shadowChanged) {
      shadowDirty = true;
    }
  }

  function updateHourTransition(now: number) {
    const transition = hourTransition;
    if (!transition) return;
    updateHourLighting(currentInput, now);
    updateLampLights(currentInput, now);
    const litCells = lampCellsAt(currentInput, now);
    const lampKey = [...litCells].sort().join('|');
    if (lampKey !== transition.lastLampKey) {
      transition.lastLampKey = lampKey;
      refreshAtlas(undefined, litCells);
    }
    if (now - transition.started < (transition.reducedMotion ? transition.duration : 1500)) return;
    hourTransition = null;
    updateHourLighting(currentInput, now);
    updateLampLights(currentInput, now);
    refreshAtlas();
  }

  function builtRoomIds(): Set<string> {
    if (!roomsRoot.visible || cameraFlight) return new Set();
    return new Set([...rooms].filter(([, entry]) => entry.group.visible).map(([id]) => id));
  }

  function refreshAtlas(
    priorityCellIds?: ReadonlySet<string>,
    lampsOverride?: ReadonlySet<string>
  ) {
    atlas.refresh({
      focusCellId: currentInput.focus,
      visited: new Set(currentInput.visited),
      lamps: lampsOverride ?? lampCellsAt(currentInput, animationNow()),
      hour: currentInput.hour,
      view: currentInput.view,
      builtRooms: builtRoomIds(),
      priorityCellIds,
    });
  }

  function clearArrivalFade(cellId: string) {
    const fade = arrivalFades.get(cellId);
    if (!fade) return;
    if (fade.overlay) {
      roomsRoot.remove(fade.overlay);
      fade.overlay.traverse((object) => {
        const lines = object as THREE.LineSegments;
        if (lines.isLineSegments) lines.geometry.dispose();
      });
    }
    fade.materials.forEach((material) => material.dispose());
    fade.lineMaterial?.dispose();
    arrivalFades.delete(cellId);
  }

  function attachSketchFade(cellId: string, source: THREE.Group, fade: ArrivalFade) {
    if (fade.overlay) return;
    const sourceMeshes: THREE.Mesh[] = [];
    source.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) sourceMeshes.push(mesh);
    });
    const overlay = source.clone(true);
    overlay.name = `sketch-fade-${cellId}`;
    overlay.position.copy(source.position);
    overlay.position.z += 0.004;
    overlay.userData.noInk = true;
    const lineMaterial = new THREE.LineBasicMaterial({
      color: CHARCOAL.line,
      transparent: true,
      opacity: fade.opacity.value,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    fade.lineMaterial = lineMaterial;
    const overlayMeshes: THREE.Mesh[] = [];
    overlay.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) overlayMeshes.push(mesh);
    });
    const materials = new Map<string, THREE.ShaderMaterial>();
    sourceMeshes.forEach((sourceMesh, index) => {
      const target = overlayMeshes[index];
      if (!target) return;
      const texture = sourceMesh.userData.cutout as THREE.Texture | undefined;
      const isFigure = Boolean(texture || sourceMesh.parent?.userData.sketchFigure);
      const color = isFigure
        ? CHARCOAL.faint
        : sourceMesh.userData.sketchWindow
          ? PALETTE.paper
          : sourceMesh.userData.sketchLamp
            ? PALETTE.paperDeep
            : PALETTE.linen;
      const key = `${texture?.uuid ?? 'paper'}:${color}`;
      let material = materials.get(key);
      if (!material) {
        material = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: texture ?? null },
            hasMap: { value: texture ? 1 : 0 },
            color: { value: new THREE.Color(color) },
            opacity: fade.opacity,
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D map;
            uniform float hasMap;
            uniform float opacity;
            uniform vec3 color;
            varying vec2 vUv;
            void main() {
              vec4 texel = vec4(1.0);
              if (hasMap > 0.5) {
                texel = texture2D(map, vUv);
                if (texel.a < 0.2) discard;
              }
              gl_FragColor = vec4(color * texel.rgb, opacity * texel.a);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        });
        materials.set(key, material);
        fade.materials.add(material);
      }
      target.material = material;
      target.castShadow = false;
      target.receiveShadow = false;
      target.userData.noInk = true;
      target.renderOrder += 10;
      if (!sourceMesh.userData.cutout && !sourceMesh.userData.noInk && target.visible) {
        const edges = new THREE.EdgesGeometry(target.geometry, 28);
        if (edges.getAttribute('position').count > 0) {
          const lines = new THREE.LineSegments(edges, lineMaterial);
          lines.name = 'arrival-sketch-edges';
          lines.position.copy(target.position);
          lines.position.z += 0.004;
          lines.quaternion.copy(target.quaternion);
          lines.scale.copy(target.scale);
          lines.renderOrder = target.renderOrder + 2;
          lines.frustumCulled = false;
          target.parent?.add(lines);
        } else {
          edges.dispose();
        }
      }
    });
    fade.overlay = overlay;
    roomsRoot.add(overlay);
  }

  function beginArrivalFade(cellId: string, started: number, duration: number) {
    const fade: ArrivalFade = {
      started,
      duration,
      opacity: { value: 1 },
      overlay: null,
      materials: new Set(),
      lineMaterial: null,
    };
    clearArrivalFade(cellId);
    arrivalFades.set(cellId, fade);
    atlas.fadeTile(cellId, started, duration);
    const entry = rooms.get(cellId);
    if (entry) attachSketchFade(cellId, entry.group, fade);
  }

  function updateArrivalFades(now: number) {
    for (const [cellId, fade] of arrivalFades) {
      const entry = rooms.get(cellId);
      if (!fade.overlay && entry) attachSketchFade(cellId, entry.group, fade);
      const progress = Math.min(1, Math.max(0, (now - fade.started) / fade.duration));
      fade.opacity.value = 1 - progress;
      if (fade.lineMaterial) fade.lineMaterial.opacity = fade.opacity.value;
      if (progress >= 1) {
        clearArrivalFade(cellId);
      }
    }
  }

  function evictRoom(cellId: string) {
    const entry = rooms.get(cellId);
    if (!entry) return;
    clearArrivalFade(cellId);
    roomsRoot.remove(entry.group);
    disposeGroupContents(entry.group);
    rooms.delete(cellId);
    shadowDirty = true;
    updateLampLights(currentInput);
    if (!atlasRefreshPending) refreshAtlas();
  }

  function updateRoomDemand(input: BuildingInput) {
    const visitedSet = new Set(input.visited);
    desiredRooms = new Set(
      SECTION_CELL_IDS.filter((id) => detailTier(id, input.focus, visitedSet, input.view) === 'room')
    );
    for (const [id, entry] of rooms) {
      entry.group.visible = desiredRooms.has(id);
      syncCloseUpProps(entry.group, input);
      const sketchMode = id !== input.current && !visitedSet.has(id);
      updateSketchMode(entry.group, sketchMode);
      if (sketchMode) resetAmbientEntry(entry);
    }
    for (const id of desiredRooms) {
      const entry = rooms.get(id);
      if (entry) {
        rooms.delete(id);
        rooms.set(id, entry);
      }
    }
    const queuedRooms = () =>
      [...desiredRooms]
        .filter((id) => !rooms.has(id))
        .sort((a, b) => Number(b === input.focus) - Number(a === input.focus));
    roomQueue = queuedRooms();
    while (rooms.size + roomQueue.length > MAX_ROOMS) {
      const leastRecent = [...rooms.keys()].find((id) => !desiredRooms.has(id));
      if (!leastRecent) break;
      evictRoom(leastRecent);
      roomQueue = queuedRooms();
    }
  }

  function buildOneRoom() {
    const cellId = roomQueue.shift();
    if (!cellId || rooms.has(cellId) || !desiredRooms.has(cellId)) return;
    const started = performance.now();
    const group = buildCellRoom(cellScene(cellId), cellId);
    const [x, y, z] = cellOrigin3d(cellId);
    group.position.set(x, y, z);
    group.visible = desiredRooms.has(cellId);
    syncCloseUpProps(group, currentInput);
    updateSketchMode(group, cellId !== currentInput.current && !currentInput.visited.includes(cellId));
    roomsRoot.add(group);
    rooms.set(cellId, { group });
    applyRestPoses(group, currentInput, cellId);
    const arrivalFade = arrivalFades.get(cellId);
    if (arrivalFade && animationNow() - arrivalFade.started < arrivalFade.duration) {
      attachSketchFade(cellId, group, arrivalFade);
    }
    const previewLockLine = currentInput.previewLockLine;
    if (
      previewLockLine &&
      mechanismFor(previewLockLine, cellId).cellId === cellId &&
      !previewLockTriggered
    ) {
      const target = interactionForLine(previewLockLine);
      if (target) {
        showLockTag(target, false);
        wobble(target, 0.1, 350);
        previewLockTriggered = true;
      }
    }
    if (cellId === currentInput.focus && currentInput.closeUp) {
      addCameraTween(frameForInput(currentInput));
    }
    lastRoomBuildMs = performance.now() - started;
    roomBuildMs += lastRoomBuildMs;
    roomsBuilt += 1;
    shadowDirty = true;
    atlasRefreshPending = true;
    updateLighting(currentInput);
  }

  function addCameraTween(to: CameraPose, duration = 700) {
    cameraTween = {
      from: clonePose(currentPose),
      to: clonePose(to),
      started: animationNow(),
      duration,
    };
    cameraFlight = null;
  }

  function startFlight(input: BuildingInput) {
    const move = input.lastMove;
    if (!move) return;
    const timeline = moveTimeline([move.from, move.to], move.kind);
    if (timeline.keys.length < 2) return;
    const startPose = frameForInput({ ...input, focus: move.from, closeUp: null });
    const endPose = frameForInput({ ...input, focus: move.to, view: 'room', closeUp: null });
    const flightHeight = Math.max(
      currentPose.viewHeight,
      endPose.viewHeight * 1.75,
      input.view === 'room' ? startPose.viewHeight * 2.05 : startPose.viewHeight
    );
    setKnightCell(move.from);
    if (!input.pinCamera) setFlightRenderMode(true);
    cameraFlight = {
      keys: timeline.keys,
      from: move.from,
      to: move.to,
      started: animationNow(),
      duration: timeline.duration,
      flightHeight,
      followOffset: startPose.target.clone().sub(new THREE.Vector3(...timeline.keys[0].pos)),
      followVelocity: new THREE.Vector3(),
      followTarget: startPose.target.clone(),
      lastTime: animationNow(),
      fromYaw: startPose.yaw,
      fromPitch: startPose.pitch,
      toYaw: endPose.yaw,
      toPitch: endPose.pitch,
    };
    cameraTween = null;
    refreshAtlas(new Set(SECTION_CELL_IDS));
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (flightTimer !== null) window.clearTimeout(flightTimer);
    flightTimer = null;
    if (!animationClock.manual) draw();
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
      const elapsed = Math.min(flight.duration, now - flight.started);
      const progress = flight.duration === 0 ? 1 : elapsed / flight.duration;
      let lower = 0;
      while (lower < flight.keys.length - 2 && elapsed > flight.keys[lower + 1].t) lower += 1;
      const fromKey = flight.keys[lower];
      const toKey = flight.keys[lower + 1];
      const keyT = Math.min(1, Math.max(0, (elapsed - fromKey.t) / (toKey.t - fromKey.t)));
      const position: [number, number, number] = [
        fromKey.pos[0] + (toKey.pos[0] - fromKey.pos[0]) * keyT,
        fromKey.pos[1] + (toKey.pos[1] - fromKey.pos[1]) * keyT,
        fromKey.pos[2] + (toKey.pos[2] - fromKey.pos[2]) * keyT,
      ];
      const hop = (fromKey.hop ?? 0) + ((toKey.hop ?? 0) - (fromKey.hop ?? 0)) * keyT;
      knight.position.set(position[0], position[1] + hop, position[2]);

      if (currentInput.lastMove?.kind === 'elevator') {
        const floor = position[1] / SECTION_PITCH.y;
        syncLiftDials(floor, true, now);
      }

      const desiredTarget = new THREE.Vector3(...position).add(flight.followOffset);
      const deltaSeconds = Math.min(0.1, Math.max(0, (now - flight.lastTime) / 1000));
      if (deltaSeconds > 0) {
        const omega = 2 / 0.16;
        const decay = Math.exp(-omega * deltaSeconds);
        for (const axis of ['x', 'y', 'z'] as const) {
          const displacement = flight.followTarget[axis] - desiredTarget[axis];
          const temp = (flight.followVelocity[axis] + omega * displacement) * deltaSeconds;
          flight.followVelocity[axis] =
            (flight.followVelocity[axis] - omega * temp) * decay;
          flight.followTarget[axis] =
            desiredTarget[axis] + (displacement + temp) * decay;
        }
      }
      flight.lastTime = now;
      const eased = progress * progress * (3 - 2 * progress);
      if (!currentInput.pinCamera) {
        applyCameraPose({
          target: flight.followTarget,
          viewHeight: flight.flightHeight,
          yaw: flight.fromYaw + (flight.toYaw - flight.fromYaw) * eased,
          pitch: flight.fromPitch + (flight.toPitch - flight.fromPitch) * eased,
        });
      }

      if (progress >= 1) {
        if (pendingArrivalFade?.cellId === flight.to) {
          beginArrivalFade(flight.to, now, pendingArrivalFade.duration);
          pendingArrivalFade = null;
        }
        cameraFlight = null;
        setKnightCell(flight.to);
        pendantLanding = { cellId: flight.to, started: now };
        syncLiftDials(currentInput.elevatorFloor);
        if (!currentInput.pinCamera) {
          addCameraTween(
            frameForInput({ ...currentInput, focus: flight.to, view: 'room', closeUp: null }),
            450
          );
        }
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
      if (currentInput.closeUp === 'ev-bb-puzzle' && sprite.userData.lineId === 'ev-bb-puzzle') {
        const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        candidate.addScaledVector(screenRight, 0.56);
        candidate.addScaledVector(screenUp, 0.3);
      }
      let projected = screenPoint(candidate);
      let x = ((projected.x + 1) * size.width) / 2;
      let y = ((1 - projected.y) * size.height) / 2;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const base = anchor.clone();
        if (currentInput.closeUp === 'ev-bb-puzzle' && sprite.userData.lineId === 'ev-bb-puzzle') {
          const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
          base.addScaledVector(screenRight, 0.56);
          base.addScaledVector(screenUp, 0.3);
        }
        candidate = base.addScaledVector(screenUp, offset * worldPerPixel);
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
    const handLines = input.hotspots.filter(
      (hotspot) => hotspot.lineId === 'ev-bb-hand' || hotspot.lineId === 'ev-bb-hand-late'
    );
    const effectiveHand = preferredHandLine(handLines, input.hour);
    const visibleHotspots = input.hotspots.filter(
      (hotspot) =>
        hotspot.lineId !== 'ev-bb-hand' &&
        hotspot.lineId !== 'ev-bb-hand-late'
    );
    if (effectiveHand) visibleHotspots.push(effectiveHand);
    visibleHotspots.forEach((hotspot, index) => {
      const sprite = hotspotSprite(
        hotspot,
        index,
        input.focus,
        input.highlight === hotspot.lineId ||
          hoveredPart?.hotspot.lineId === hotspot.lineId ||
          hoveredHotspot?.userData.lineId === hotspot.lineId
      );
      hotspotGroup.add(sprite);
    });
  }

  function refreshMoveTags(input: BuildingInput) {
    clearOverlay(moveGroup);
    for (const [cellId, target] of Object.entries(input.targets)) {
      const [x, y] = cellOrigin3d(cellId);
      const sprite = spriteFor(moveTagTexture(target), 1, 1, { cellId, kind: target.kind });
      sprite.position.set(x + CELL_ROOM.W / 2 - 0.6, y + CELL_ROOM.H - 0.2, FRONT_Z + 0.12);
      sprite.userData.desiredPixels = { width: 72, height: 25 };
      sprite.userData.tagCorner = 'top-right';
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
      if (sprite.userData.tagCorner === 'top-right' && cellId) {
        const [x, y] = cellOrigin3d(cellId);
        sprite.position.set(
          x + CELL_ROOM.W / 2 - (width * worldPerPixel) / 2 - 0.05,
          y + CELL_ROOM.H - (height * worldPerPixel) / 2 - 0.05,
          FRONT_Z + 0.12
        );
      }
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
    refreshPartHover();
  }

  function setPointerFromClient(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
  }

  function pickedHotspot(clientX: number, clientY: number): THREE.Sprite | undefined {
    setPointerFromClient(clientX, clientY);
    return raycaster.intersectObjects(hotspotGroup.children, false)[0]?.object as THREE.Sprite | undefined;
  }

  function pickedCell(clientX: number, clientY: number): string | null {
    setPointerFromClient(clientX, clientY);
    if (!raycaster.ray.intersectPlane(pickPlane, pickPoint)) return null;
    return cellAtPoint(pickPoint.x, pickPoint.y);
  }

  function pickedInteraction(clientX: number, clientY: number): RoomInteraction | null {
    if (currentInput.view !== 'room' || currentInput.current !== currentInput.focus) return null;
    const canvasRect = renderer.domElement.getBoundingClientRect();
    if (
      clientX < canvasRect.left ||
      clientX > canvasRect.right ||
      clientY < canvasRect.top ||
      clientY > canvasRect.bottom
    ) {
      return null;
    }
    const room = rooms.get(currentInput.current);
    if (!room?.group.visible) return null;
    setPointerFromClient(clientX, clientY);
    for (const hit of raycaster.intersectObjects(room.group.children, true)) {
      const interaction = interactionForObject(hit.object);
      if (interaction) return interaction;
    }
    return null;
  }

  function activateInteraction(target: RoomInteraction, fromProgress?: number) {
    if (target.hotspot.status !== 'open') {
      callbacks.onAudioCue?.('lock.rattle', target.hotspot.lineId);
      feedbackFor(target);
      return;
    }
    if (target.hotspot.lineId === 'ev-stair-notebook') {
      callbacks.onAudioCue?.('book.open', target.hotspot.lineId);
    } else if (target.spec.kind === 'flip') {
      callbacks.onAudioCue?.('paper.flip', target.hotspot.lineId);
    } else if (target.spec.kind === 'lift' || target.spec.kind === 'pickup') {
      callbacks.onAudioCue?.('cloth.lift', target.hotspot.lineId);
    }
    if (target.spec.kind === 'lean') callbacks.onCloseUp(target.hotspot.lineId);
    const duration =
      target.spec.kind === 'lean'
        ? 500
        : target.spec.kind === 'lift' || target.spec.kind === 'flip'
          ? 410
          : 330;
    animateMechanism(target, 1, duration, () => finishInteraction(target), fromProgress);
  }

  function finishInteraction(target: RoomInteraction) {
    if (target.spec.kind === 'lift' || target.spec.kind === 'pickup') {
      flyObjectToNotebook(target, () => callbacks.onPickHotspot(target.hotspot.lineId));
    } else {
      callbacks.onPickHotspot(target.hotspot.lineId);
    }
  }

  function finishParallax() {
    if (!parallaxStart) return;
    cameraTween = {
      from: currentPose,
      to: parallaxStart.pose,
      started: animationNow(),
      duration: 450,
    };
    parallaxStart = null;
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
          suppressClickUntil = animationNow() + 600;
        }
        if (pinchStartDistance === null) pinchStartDistance = distance;
      }
      return;
    }
    if (activeDrag) {
      const dx = event.clientX - activeDrag.startX;
      const dy = event.clientY - activeDrag.startY;
      const distance =
        activeDrag.target.spec.dragAxis === 'right'
          ? dx
          : activeDrag.target.spec.dragAxis === 'left'
            ? -dx
            : -dy;
      activeDrag.progress = THREE.MathUtils.clamp(activeDrag.base + distance / 120, 0, 1);
      activeDrag.moved ||= Math.abs(dx) + Math.abs(dy) > 4;
      applyInteractionPose(activeDrag.target, activeDrag.progress);
      renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if (parallaxStart) {
      const rect = renderer.domElement.getBoundingClientRect();
      const dx = (event.clientX - parallaxStart.x) / Math.max(1, rect.width);
      const dy = (event.clientY - parallaxStart.y) / Math.max(1, rect.height);
      const pose: CameraPose = {
        ...parallaxStart.pose,
        target: parallaxStart.pose.target.clone(),
        yaw: parallaxStart.pose.yaw + THREE.MathUtils.clamp(dx * 0.7, -THREE.MathUtils.degToRad(20), THREE.MathUtils.degToRad(20)),
        pitch:
          parallaxStart.pose.pitch +
          THREE.MathUtils.clamp(-dy * 0.22, -THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(6)),
      };
      cameraTween = null;
      cameraFlight = null;
      currentPose = pose;
      applyCameraPose(pose);
      return;
    }
    const interaction = pickedInteraction(event.clientX, event.clientY);
    const hotspot = interaction ? undefined : pickedHotspot(event.clientX, event.clientY);
    const previousLine = hoveredPart?.hotspot.lineId ?? hoveredHotspot?.userData.lineId ?? null;
    hoveredPart = interaction;
    hoveredHotspot = hotspot ?? null;
    const nextLine = interaction?.hotspot.lineId ?? hotspot?.userData.lineId ?? null;
    if (previousLine !== nextLine) {
      callbacks.onHoverLine(typeof nextLine === 'string' ? nextLine : null);
      refreshPartHover();
      refreshHotspots(currentInput);
    }
    const nextCell = interaction || hotspot ? null : pickedCell(event.clientX, event.clientY);
    if (nextCell !== hoverCell) {
      hoverCell = nextCell;
      callbacks.onHoverCell(nextCell);
      refreshHover();
    }
    const hoveredHotspotData = hoveredHotspot?.userData.hotspot as StageHotspot | undefined;
    const hoveredStatus = interaction?.hotspot.status ?? hoveredHotspotData?.status;
    const blocked = hoveredStatus === 'locked' || hoveredStatus === 'failed';
    renderer.domElement.style.cursor = interaction
      ? blocked
        ? 'not-allowed'
        : interaction.spec.gesture === 'drag'
          ? 'grab'
          : 'pointer'
      : hotspot
        ? blocked
          ? 'not-allowed'
          : mechanismFor(
              String(hotspot.userData.lineId ?? ''),
              currentInput.focus
            ).gesture === 'drag'
            ? 'grab'
            : 'pointer'
        : nextCell
          ? 'pointer'
        : currentInput.closeUp
          ? 'zoom-out'
          : 'default';
  }

  function onPointerLeave() {
    if (activeDrag) return;
    if (parallaxStart) finishParallax();
    hoveredHotspot = null;
    hoveredPart = null;
    hoverCell = null;
    callbacks.onHoverCell(null);
    callbacks.onHoverLine(null);
    refreshHover();
    refreshPartHover();
    renderer.domElement.style.cursor = 'default';
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      pointerPositions.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      if (pointerPositions.size >= 2) {
        const [first, second] = [...pointerPositions.values()];
        pinchStartDistance = first.distanceTo(second);
        pinchStartChanged = false;
      }
      return;
    }
    const interaction = pickedInteraction(event.clientX, event.clientY);
    const hotspot = interaction ? undefined : pickedHotspot(event.clientX, event.clientY);
    if (interaction?.spec.gesture === 'drag' && interaction.hotspot.status === 'open') {
      activeDrag = {
        target: interaction,
        startX: event.clientX,
        startY: event.clientY,
        base: restPose(interaction.hotspot.lineId, interaction.hotspot.status, currentInput.hour),
        progress: restPose(interaction.hotspot.lineId, interaction.hotspot.status, currentInput.hour),
        moved: false,
      };
      renderer.domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (!interaction && !hotspot && currentInput.view === 'room') {
      parallaxStart = {
        x: event.clientX,
        y: event.clientY,
        pose: { ...currentPose, target: currentPose.target.clone() },
      };
    }
  }

  function onPointerUp(event: PointerEvent) {
    pointerPositions.delete(event.pointerId);
    if (pointerPositions.size < 2) {
      pinchStartDistance = null;
      pinchStartChanged = false;
    }
    if (activeDrag) {
      const drag = activeDrag;
      activeDrag = null;
      if (drag.moved) {
        suppressClickUntil = animationNow() + 450;
        if (drag.progress >= 0.8) {
          animateMechanism(
            drag.target,
            1,
            260,
            () => finishInteraction(drag.target),
            drag.progress
          );
        } else {
          animateMechanism(drag.target, drag.base, 320, undefined, drag.progress);
        }
      }
    }
    if (parallaxStart) {
      const moved = Math.hypot(event.clientX - parallaxStart.x, event.clientY - parallaxStart.y) > 4;
      if (moved) suppressClickUntil = animationNow() + 350;
      finishParallax();
    }
  }

  function onClick(event: MouseEvent) {
    if (animationNow() < suppressClickUntil) return;
    if (event.detail > 1) {
      suppressClickUntil = animationNow() + 420;
      return;
    }
    const interaction = pickedInteraction(event.clientX, event.clientY);
    if (interaction) {
      activateInteraction(interaction);
      return;
    }
    if (currentInput.closeUp) {
      callbacks.onExitCloseUp();
      return;
    }
    const hotspot = pickedHotspot(event.clientX, event.clientY);
    const lineId = hotspot?.userData.lineId;
    if (typeof lineId === 'string') {
      const target = interactionForLine(lineId);
      if (target) activateInteraction(target);
      else callbacks.onPickHotspot(lineId);
      return;
    }
    const cellId = pickedCell(event.clientX, event.clientY);
    if (cellId) callbacks.onPickCell(cellId);
  }

  function onDoubleClick(event: MouseEvent) {
    const target =
      pickedInteraction(event.clientX, event.clientY) ??
      (() => {
        const lineId = pickedHotspot(event.clientX, event.clientY)?.userData.lineId;
        return typeof lineId === 'string' ? interactionForLine(lineId) : null;
      })();
    if (!target) return;
    suppressClickUntil = animationNow() + 400;
    callbacks.onCloseUp(target.hotspot.lineId);
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
  renderer.domElement.addEventListener('dblclick', onDoubleClick);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  function applyInput(input: BuildingInput, animate: boolean, deferAtlas = false) {
    const previous = currentInput;
    const previousLamps = lampCellsAt(previous, animationNow());
    currentInput = input;
    if (previous.hour !== input.hour) {
      const targetLamps = targetLampCells(input);
      const lampOrder = [...targetLamps]
        .filter((cellId) => !previousLamps.has(cellId))
        .sort((a, b) => cellHash(a) - cellHash(b));
      hourTransition = {
        fromHour: previous.hour,
        toHour: input.hour,
        started: animationNow(),
        duration: input.reducedMotion ? 250 : 1200,
        fromLamps: previousLamps,
        targetLamps,
        lampOrder,
        lastLampKey: [...previousLamps].sort().join('|'),
        reducedMotion: input.reducedMotion,
      };
    }
    if (input.lastMove && input.lastMove !== previous.lastMove) {
      pendingArrivalFade =
        input.visited.includes(input.current) && !previous.visited.includes(input.current)
          ? { cellId: input.current, duration: input.reducedMotion ? 250 : 600 }
          : null;
    }
    if (previous.previewLockLine !== input.previewLockLine) previewLockTriggered = false;
    focusRoomRequired =
      detailTier(input.focus, input.focus, new Set(input.visited), input.view) === 'room';
    requestedView = input.view;
    ink.setMode(input.mode as InkMode);
    const closeUpChanged = previous.closeUp !== input.closeUp;
    const visitedChanged = JSON.stringify(previous.visited) !== JSON.stringify(input.visited);
    const lampsChanged = JSON.stringify(previous.lamps) !== JSON.stringify(input.lamps);
    const demandChanged =
      previous.focus !== input.focus ||
      previous.current !== input.current ||
      previous.view !== input.view ||
      visitedChanged ||
      previous.elevatorFloor !== input.elevatorFloor;
    if (
      deferAtlas &&
      (demandChanged || lampsChanged || previous.hour !== input.hour)
    ) {
      atlasRefreshPending = true;
    }
    if (demandChanged) updateRoomDemand(input);
    for (const [cellId, entry] of rooms) applyRestPoses(entry.group, input, cellId);
    for (const [, entry] of rooms) syncCloseUpProps(entry.group, input);
    knight.visible = !input.closeUp;
    knight.castShadow = !input.closeUp;
    if (closeUpChanged) {
      shadowDirty = true;
      renderer.shadowMap.needsUpdate = true;
      sun.shadow.needsUpdate = true;
    }
    if (demandChanged || lampsChanged || previous.hour !== input.hour) {
      if (!deferAtlas) refreshAtlas();
    }
    if (demandChanged || lampsChanged || previous.hour !== input.hour) {
      updateLighting(
        input,
        demandChanged || previous.hour !== input.hour || previous.focus !== input.focus
      );
    }
    if (previous.current !== input.current && input.lastMove === null) setKnightCell(input.current);
    if (animate) addCameraTween(frameForInput(input));
  }

  refreshHotspots(initial);
  refreshMoveTags(initial);
  refreshChangedTags(initial);
  updateLighting(initial, true);
  updateRoomDemand(initial);
  refreshAtlas();
  ink.setMode(initial.mode);

  const resizeObserver = new ResizeObserver(() => {
    handle.resize(host.clientWidth, host.clientHeight);
  });
  resizeObserver.observe(host);

  function shiftAnimationStarts(delta: number) {
    if (cameraFlight) {
      cameraFlight.started += delta;
      cameraFlight.lastTime += delta;
    }
    if (cameraTween) cameraTween.started += delta;
    if (hourTransition) hourTransition.started += delta;
    if (pendantLanding) pendantLanding.started += delta;
    mechanismTweens.forEach((tween) => (tween.started += delta));
    objectFlights.forEach((flight) => (flight.started += delta));
    cardFlights.forEach((flight) => (flight.started += delta));
    arrivalFades.forEach((fade) => (fade.started += delta));
  }

  function onVisibilityChange() {
    if (document.hidden) {
      pausedAt = animationNow();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (flightTimer !== null) window.clearTimeout(flightTimer);
      flightTimer = null;
      return;
    }
    if (pausedAt !== null) {
      shiftAnimationStarts(animationNow() - pausedAt);
      pausedAt = null;
      lastAmbientUpdate = animationNow();
    }
    if (!animationClock.manual && !disposed && !frame && flightTimer === null) {
      frame = requestAnimationFrame(draw);
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  if (document.hidden) onVisibilityChange();

  function draw() {
    if (disposed) return;
    if (document.hidden) {
      frame = 0;
      flightTimer = null;
      return;
    }
    const frameStarted = performance.now();
    frame = 0;
    flightTimer = null;
    const now = animationNow();
    if (roomQueue.length > 0) buildOneRoom();
    const movementFrame = cameraFlight !== null || cameraTween !== null;
    updateHourTransition(now);
    updateArrivalFades(now);
    atlas.updateFades(now);
    updateMechanisms(now);
    if (lockTagHideAt !== null && now >= lockTagHideAt) {
      disposeGroupContents(lockTagGroup);
      lockTagHideAt = null;
      if (lockTagTimeout !== null) window.clearTimeout(lockTagTimeout);
      lockTagTimeout = null;
    }
    updateCamera(now);
    updateAmbient(now);
    if (!cameraFlight && !cameraTween && flightRenderMode) setFlightRenderMode(false);
    camera.updateMatrixWorld();
    layoutHotspots();
    layoutCellSprites(moveGroup, { width: 72, height: 25 });
    layoutCellSprites(changedGroup, { width: 25, height: 25 });

    renderer.info.reset();
    const focusRoomReady = !focusRoomRequired || rooms.has(currentInput.focus);
    const cameraMoving = cameraTween !== null || cameraFlight !== null;
    const visibleReady = focusRoomReady;
    const loading =
      !visibleReady ||
      (firstReadyMs !== null && (roomQueue.length > 0 || cameraMoving));
    const flightActive = cameraFlight !== null;
    section.group.visible = true;
    atlas.mesh.visible = true;
    roomsRoot.visible = !cameraFlight && (focusRoomReady || firstReadyMs !== null);
    if (!cameraFlight && atlasRefreshPending) {
      refreshAtlas();
      atlasRefreshPending = false;
    }
    renderer.shadowMap.enabled = !flightActive;
    if (!loading && shadowDirty && firstInkRenderMs !== null) {
      renderer.shadowMap.needsUpdate = true;
      sun.shadow.needsUpdate = true;
      shadowDirty = false;
    }
    let rendered = false;
    if (loading) {
      if (cameraMoving || animationClock.manual) {
        renderer.render(scene, camera);
        rendered = true;
      }
    } else if (firstReadyMs === null) {
      const sectionVisible = section.group.visible;
      const atlasVisible = atlas.mesh.visible;
      const roomsVisible = roomsRoot.visible;
      const knightVisible = knight.visible;
      section.group.visible = true;
      atlas.mesh.visible = false;
      roomsRoot.visible = false;
      knight.visible = false;
      renderer.render(scene, camera);
      section.group.visible = sectionVisible;
      atlas.mesh.visible = atlasVisible;
      roomsRoot.visible = roomsVisible;
      knight.visible = knightVisible;
      if (firstReadyMs === null) firstReadyMs = performance.now() - startedAt;
      rendered = true;
    } else {
      const inkStarted = performance.now();
      ink.render(currentPose.viewHeight);
      inkRenderMs += performance.now() - inkStarted;
      if (firstInkRenderMs === null) firstInkRenderMs = performance.now() - inkStarted;
      rendered = true;
    }
    if (rendered && !movementFrame) {
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(overlayScene, camera);
      renderer.autoClear = autoClear;
    }

    const idle =
      roomQueue.length === 0 &&
      atlas.stats().pendingTiles === 0 &&
      !shadowDirty &&
      !cameraTween &&
      !cameraFlight &&
      !hourTransition &&
      arrivalFades.size === 0 &&
      !atlas.hasFades();
    const frameTime = performance.now() - frameStarted;
    const ambientSample =
      currentInput.ambient &&
      !currentInput.reducedMotion &&
      !ambientSuppressed &&
      !currentInput.closeUp &&
      (currentInput.view === 'room' || currentInput.view === 'block');
    const samples = ambientSample ? ambientOnFrames : ambientOffFrames;
    samples.push(frameTime);
    if (samples.length > 60) samples.shift();
    if (ambientSample && ambientOnFrames.length >= 20) {
      const recentMedian = medianMs(ambientOnFrames.slice(-20));
      if (recentMedian !== null && recentMedian > 60) {
        ambientSuppressed = true;
        ambientSimplifiedForSession = true;
        resetAmbient();
        callbacks.onAmbientSimplified();
      }
    }
    const transitionsActive =
      cameraFlight !== null ||
      cameraTween !== null ||
      mechanismTweens.size > 0 ||
      objectFlights.size > 0 ||
      cardFlights.size > 0 ||
      hourTransition !== null ||
      arrivalFades.size > 0 ||
      atlas.hasFades() ||
      roomQueue.length > 0 ||
      atlas.stats().pendingTiles > 0 ||
      shadowDirty ||
      firstReadyMs === null;
    if (animationClock.manual) return;
    if (transitionsActive) {
      flightTimer = window.setTimeout(draw, 16);
    } else if (ambientIsActive()) {
      flightTimer = window.setTimeout(draw, 1000 / 30);
    } else {
      frame = requestAnimationFrame(draw);
    }
  }

  const handle: BuildingHandle = {
    update(input) {
      const old = currentInput;
      const movementStarted = input.lastMove !== null && input.lastMove !== lastMoveObject;
      const changedFocus =
        input.focus !== old.focus || input.view !== old.view || input.closeUp !== old.closeUp;
      const hotspotChanged =
        JSON.stringify(input.hotspots) !== JSON.stringify(old.hotspots) ||
        input.focus !== old.focus ||
        input.highlight !== old.highlight;
      const tagsChanged =
        JSON.stringify(input.targets) !== JSON.stringify(old.targets) ||
        JSON.stringify(input.changed) !== JSON.stringify(old.changed);
      requestedView = input.view;
      if (movementStarted) {
        lastMoveObject = input.lastMove;
        applyInput(input, false, true);
        startFlight(input);
      } else {
        applyInput(input, false);
        if (changedFocus) addCameraTween(frameForInput(input));
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
      const framePose = frameForInput(currentInput);
      if (!cameraFlight) {
        if (animationClock.manual) applyCameraPose(framePose);
        else addCameraTween(framePose, 600);
      }
    },
    async advance(ms) {
      if (!animationClock.manual) throw new Error('Manual stepping requires clock=manual.');
      if (disposed) throw new Error('The stage has been disposed.');
      if (document.hidden) throw new Error('Cannot advance the stage while the document is hidden.');
      animationClock.advance(ms);
      draw();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    now() {
      return animationNow();
    },
    partAt(clientX, clientY) {
      const target = pickedInteraction(clientX, clientY);
      suppressClickUntil = animationNow() + 420;
      const previousLine = hoveredPart?.hotspot.lineId ?? null;
      hoveredPart = target;
      const lineId = target?.hotspot.lineId ?? null;
      if (previousLine !== lineId) {
        callbacks.onHoverLine(lineId);
        refreshPartHover();
        refreshHotspots(currentInput);
      }
      return lineId;
    },
    notebookAnchor,
    wobblePart(lineId) {
      const target = interactionForLine(lineId);
      if (target) wobble(target, 0.1, 350);
    },
    animateCards,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      if (flightTimer !== null) window.clearTimeout(flightTimer);
      resizeObserver.disconnect();
      if (lockTagTimeout !== null) window.clearTimeout(lockTagTimeout);
      lockTagTimeout = null;
      mechanismTweens.clear();
      objectFlights.clear();
      cardFlights.clear();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearOverlay(hotspotGroup);
      clearOverlay(moveGroup);
      clearOverlay(changedGroup);
      clearOverlay(hoverGroup);
      for (const cellId of arrivalFades.keys()) clearArrivalFade(cellId);
      if (warmedPart) {
        warmedPart.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || !('hoverOriginalMaterial' in mesh.userData)) return;
          mesh.material = mesh.userData.hoverOriginalMaterial as THREE.Material | THREE.Material[];
          delete mesh.userData.hoverOriginalMaterial;
        });
        warmedPart = null;
      }
      partHoverGroup.clear();
      brassRimMaterial.dispose();
      atlas.dispose();
      root.remove(atlas.mesh);
      disposeGroupContents(root);
      ink.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      host.replaceChildren();
    },
    stats() {
      const atlasStats = atlas.stats();
      const idle =
        roomQueue.length === 0 &&
        atlasStats.pendingTiles === 0 &&
        !shadowDirty &&
        !cameraTween &&
        !cameraFlight &&
        !hourTransition &&
        arrivalFades.size === 0 &&
        !atlas.hasFades();
      return {
        renderCalls: renderer.info.render.calls,
        drawCalls: renderer.info.render.calls,
        firstReadyMs,
        firstInkRenderMs,
        inkRenderMs,
        rendererInitMs,
        mountSetupMs,
        roomBuildMs,
        lastRoomBuildMs,
        sketchMaterialSwapMs,
        shadowUpdateMs,
        atlasDrawMs: atlasStats.drawMs,
        atlasPendingTiles: atlasStats.pendingTiles,
        roomsBuilt,
        ambientOnMedianMs: medianMs(ambientOnFrames),
        ambientOffMedianMs: medianMs(ambientOffFrames),
        idle,
      };
    },
  };

  handle.resize(host.clientWidth || 900, host.clientHeight || 620);
  mountSetupMs = performance.now() - startedAt;
  if (!document.hidden && !animationClock.manual) frame = requestAnimationFrame(draw);
  return handle;
}
