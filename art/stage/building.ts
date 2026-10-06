import * as THREE from 'three';
import { InkRenderer, type InkMode } from '../inkPass';
import { knightPiece } from '../knight';
import { CHARCOAL, HOUR_LIGHT, LIGHT_2000, PALETTE, TYPE } from '../palette';
import { toonMaterial } from '../materials';
import { drawCardArt } from '../draw/cardArt';
import { CELLS, CELL_BY_ID } from '../../world/damier';
import { buildCellRoom } from './cellRooms';
import { buildBuildingSection } from './buildingSection';
import { CELL_ROOM, PLAYER_SPOT, cellScene, anchorFor } from './cellScenes';
import { createFlatsAtlas } from './flatsAtlas';
import { disposeGroup } from './dispose';
import { mechanismFor, restPose } from './mechanisms';
import { lockReasonText } from '../../engine/selectors';
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
}

export interface BuildingCallbacks {
  onPickHotspot(lineId: string): void;
  onPickCell(cellId: string): void;
  onHoverCell(cellId: string | null): void;
  onHoverLine(lineId: string | null): void;
  onCloseUp(lineId: string): void;
  onExitCloseUp(): void;
  getNotebookRect(): DOMRect | null;
  onViewChange(view: SectionView): void;
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
  idle: boolean;
}

export interface BuildingHandle {
  update(input: BuildingInput): void;
  resize(width: number, height: number): void;
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
  const knight = knightPiece(0.82);
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
  overlayScene.add(partHoverGroup);
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
  let activeDrag: ActiveDrag | null = null;
  let parallaxStart: { x: number; y: number; pose: CameraPose } | null = null;
  const mechanismTweens = new Map<string, MechanismTween>();
  const objectFlights = new Map<string, ObjectFlight>();
  const cardFlights = new Set<CardFlight>();
  let lockTagTimeout: number | null = null;
  let previewLockTriggered = false;
  const lampLights = new Map<string, THREE.PointLight>();
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
  function updateSketchMode(group: THREE.Group, on: boolean) {
    const started = performance.now();
    applySketchMode(group, on);
    sketchMaterialSwapMs += performance.now() - started;
  }
  const initialFrame = frameFor(initial.view, initial.focus, 1);
  currentPose = toPose(initialFrame, initialFrame.viewHeight * 2.2);
  applyCameraPose(currentPose);
  cameraTween = {
    from: clonePose(currentPose),
    to: toPose(initialFrame),
    started: performance.now(),
    duration: 600,
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

  function frameForInput(input: BuildingInput): CameraPose {
    const pose = frameForCell(input.view, input.focus);
    if (input.closeUp && input.view === 'room' && input.focus === input.current) {
      const target = interactionForLine(input.closeUp);
      if (target) pose.target.copy(target.anchor);
      pose.viewHeight = 1.2;
      pose.pitch += 0.055;
    }
    if (input.previewParallax !== undefined && input.view === 'room') {
      const offset = THREE.MathUtils.clamp(input.previewParallax, -20, 20);
      pose.yaw += THREE.MathUtils.degToRad(offset);
      pose.pitch += THREE.MathUtils.degToRad((offset / 20) * 6);
    }
    return pose;
  }
  cameraTween = {
    from: clonePose(currentPose),
    to: frameForInput(initial),
    started: performance.now(),
    duration: 600,
  };

  function setKnightCell(cellId: string) {
    const [x, y, z] = cellOrigin3d(cellId);
    const [spotX, spotY, spotZ] = PLAYER_SPOT[cellScene(cellId).kind];
    knight.position.set(x + spotX, y + spotY, z + spotZ);
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
      const trace = object.getObjectByName('bb-puzzle-trace') as THREE.Line | undefined;
      if (trace) {
        trace.visible = pose > 0.01;
        const material = trace.material as THREE.LineBasicMaterial;
        material.transparent = true;
        material.opacity = pose;
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
    mechanismTweens.set(key, { target, from, to, started: performance.now(), duration, onComplete });
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
        started: performance.now() + index * 120,
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
      started: performance.now(),
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
      started: performance.now(),
      duration,
      base: target.object.rotation.z,
      amplitude,
    };
  }

  function showLockTag(target: RoomInteraction, autoHide = true) {
    if (!target.hotspot.lock) return;
    if (lockTagTimeout !== null) window.clearTimeout(lockTagTimeout);
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
      lockTagTimeout = window.setTimeout(() => {
        disposeGroupContents(lockTagGroup);
        lockTagTimeout = null;
      }, 2400);
    } else {
      lockTagTimeout = null;
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
    disposeGroupContents(partHoverGroup);
    const target = hoveredPart ?? (currentInput.highlight ? interactionForLine(currentInput.highlight) : null);
    if (!target?.object) return;
    const bounds = new THREE.Box3().setFromObject(target.object);
    if (bounds.isEmpty()) return;
    const outline = new THREE.Box3Helper(bounds.expandByScalar(0.035), PALETTE.brass);
    outline.renderOrder = 1101;
    partHoverGroup.add(outline);
  }

  function updateLampLights(input: BuildingInput) {
    const litCells = new Set(input.hour >= 22 ? input.lamps : []);
    if (input.hour === 23) litCells.add(input.current);
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
      const lit =
        input.hour >= 22 &&
        (input.lamps.includes(cellId) || (input.hour === 23 && input.current === cellId));
      const bulb = entry.group.getObjectByName('pendant-bulb') as THREE.Mesh | undefined;
      if (entry.group.userData.sketchMode && bulb) {
        bulb.material = lit ? sketchLampOnMaterial : sketchLampOffMaterial;
        continue;
      }
      const material = bulb?.material as THREE.MeshBasicMaterial | undefined;
      material?.color.set(lit ? PALETTE.light : PALETTE.paperDeep);
    }
  }

  function updateLighting(input: BuildingInput, shadowChanged = false) {
    const light = HOUR_LIGHT[input.hour];
    const angle = ((light.angle - 112) * Math.PI) / 180;
    const direction = new THREE.Vector3(...LIGHT_2000.sunDir);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    const focus = cellOrigin3d(input.focus);
    sun.target.position.set(focus[0], focus[1] + CELL_ROOM.H / 2, focus[2]);
    sun.position.copy(sun.target.position).addScaledVector(direction, -60);
    sun.color.set(light.tint);
    sun.intensity = LIGHT_2000.sunIntensity * (1 - light.night * 1.5);
    hemi.intensity = Math.max(1.08, LIGHT_2000.hemiIntensity * (1 - light.night * 0.35));
    hemi.color.set(light.night > 0.3 ? PALETTE.linen : LIGHT_2000.hemiSky);
    for (const [cellId, entry] of rooms) {
      const sky = entry.group.userData.windowMaterial as THREE.MeshBasicMaterial | undefined;
      const lit =
        input.hour >= 22 &&
        (input.lamps.includes(cellId) || (input.hour === 23 && input.current === cellId));
      sky?.color.set(lit ? PALETTE.light : light.tint);
      if (entry.group.userData.sketchMode) {
        entry.group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh && mesh.userData.sketchWindow) {
            mesh.material = lit ? sketchWindowLitMaterial : sketchWindowMaterial;
          }
        });
      }
    }
    const currentCell = CELL_BY_ID[input.current];
    if (currentCell) {
      section.elevatorNeedle.position.y = currentCell.floor * SECTION_PITCH.y + 1.3;
    }
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

  function builtRoomIds(): Set<string> {
    if (!roomsRoot.visible || cameraFlight) return new Set();
    return new Set([...rooms].filter(([, entry]) => entry.group.visible).map(([id]) => id));
  }

  function refreshAtlas(priorityCellIds?: ReadonlySet<string>) {
    atlas.refresh({
      focusCellId: currentInput.focus,
      visited: new Set(currentInput.visited),
      lamps: new Set(currentInput.lamps),
      hour: currentInput.hour,
      view: currentInput.view,
      builtRooms: builtRoomIds(),
      priorityCellIds,
    });
  }

  function evictRoom(cellId: string) {
    const entry = rooms.get(cellId);
    if (!entry) return;
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
      updateSketchMode(entry.group, id !== input.current && !visitedSet.has(id));
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
    updateSketchMode(group, cellId !== currentInput.current && !currentInput.visited.includes(cellId));
    roomsRoot.add(group);
    rooms.set(cellId, { group });
    applyRestPoses(group, currentInput, cellId);
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
    const duration = move.kind === 'knight' ? 1200 : 720;
    const flightHeight = Math.max(
      currentPose.viewHeight,
      frames[frames.length - 1].viewHeight * 1.75,
      input.view === 'room' ? frames[0].viewHeight * 2.05 : frames[0].viewHeight
    );
    setKnightCell(move.from);
    setFlightRenderMode(true);
    cameraFlight = {
      path,
      frames,
      started: performance.now(),
      duration,
      flightHeight,
    };
    cameraTween = null;
    refreshAtlas(new Set(SECTION_CELL_IDS));
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (flightTimer !== null) window.clearTimeout(flightTimer);
    flightTimer = null;
    draw();
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
      const [x1, y1, z1] = cellOrigin3d(startId);
      const [x2, y2, z2] = cellOrigin3d(endId);
      const [sx1, sy1, sz1] = PLAYER_SPOT[cellScene(startId).kind];
      const [sx2, sy2, sz2] = PLAYER_SPOT[cellScene(endId).kind];
      const hop = Math.sin(Math.PI * segmentT) * 0.52;
      knight.position.set(
        x1 + sx1 + (x2 + sx2 - x1 - sx1) * eased,
        y1 + sy1 + (y2 + sy2 - y1 - sy1) * eased + hop,
        z1 + sz1 + (z2 + sz2 - z1 - sz1) * eased
      );

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
      feedbackFor(target);
      return;
    }
    if (target.spec.kind === 'lean') callbacks.onCloseUp(target.hotspot.lineId);
    const duration = target.spec.kind === 'lift' || target.spec.kind === 'flip' ? 410 : 330;
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
      started: performance.now(),
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
          suppressClickUntil = performance.now() + 600;
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
        suppressClickUntil = performance.now() + 450;
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
      if (moved) suppressClickUntil = performance.now() + 350;
      finishParallax();
    }
  }

  function onClick(event: MouseEvent) {
    if (performance.now() < suppressClickUntil) return;
    if (event.detail > 1) {
      suppressClickUntil = performance.now() + 420;
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
    suppressClickUntil = performance.now() + 400;
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
    currentInput = input;
    if (previous.previewLockLine !== input.previewLockLine) previewLockTriggered = false;
    focusRoomRequired =
      detailTier(input.focus, input.focus, new Set(input.visited), input.view) === 'room';
    requestedView = input.view;
    ink.setMode(input.mode as InkMode);
    const visitedChanged = JSON.stringify(previous.visited) !== JSON.stringify(input.visited);
    const lampsChanged = JSON.stringify(previous.lamps) !== JSON.stringify(input.lamps);
    const demandChanged =
      previous.focus !== input.focus ||
      previous.current !== input.current ||
      previous.view !== input.view ||
      visitedChanged;
    if (
      deferAtlas &&
      (demandChanged || lampsChanged || previous.hour !== input.hour)
    ) {
      atlasRefreshPending = true;
    }
    if (demandChanged) updateRoomDemand(input);
    for (const [cellId, entry] of rooms) applyRestPoses(entry.group, input, cellId);
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

  function draw() {
    if (disposed) return;
    flightTimer = null;
    const now = performance.now();
    if (roomQueue.length > 0) buildOneRoom();
    const movementFrame = cameraFlight !== null || cameraTween !== null;
    updateMechanisms(now);
    updateCamera(now);
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
    section.group.visible = !flightActive;
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
      if (cameraMoving) {
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
    if (rendered && cameraFlight) {
      const progress = Math.min(1, (now - cameraFlight.started) / cameraFlight.duration);
      renderer.domElement.dispatchEvent(
        new CustomEvent('buildingflightframe', { detail: { progress } })
      );
    }

    const idle =
      roomQueue.length === 0 &&
      atlas.stats().pendingTiles === 0 &&
      !shadowDirty &&
      !cameraTween &&
      !cameraFlight;
    if (cameraFlight || cameraTween) {
      flightTimer = window.setTimeout(draw, 16);
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
      if (!cameraFlight) addCameraTween(framePose, 600);
    },
    partAt(clientX, clientY) {
      const target = pickedInteraction(clientX, clientY);
      suppressClickUntil = performance.now() + 420;
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
      clearOverlay(hotspotGroup);
      clearOverlay(moveGroup);
      clearOverlay(changedGroup);
      clearOverlay(hoverGroup);
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
        !cameraFlight;
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
        idle,
      };
    },
  };

  handle.resize(host.clientWidth || 900, host.clientHeight || 620);
  mountSetupMs = performance.now() - startedAt;
  frame = requestAnimationFrame(draw);
  return handle;
}
