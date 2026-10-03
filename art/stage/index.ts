import * as THREE from 'three';
import { InkRenderer, type InkMode } from '../inkPass';
import { HOUR_LIGHT, LIGHT_2000, PALETTE, TYPE } from '../palette';
import { buildCellRoom } from './cellRooms';
import { anchorFor, cellScene, type CellScene } from './cellScenes';

export type { CellScene, CellRoomKind } from './cellScenes';
export { ANCHORS, CELL_ROOM, anchorFor, cellScene } from './cellScenes';

export interface StageInput {
  cellId: string;
  hour: 20 | 21 | 22 | 23;
  hotspots: StageHotspot[];
  highlight: string | null;
  mode: 'print' | 'blueprint';
}

export interface StageHotspot {
  lineId: string;
  status: 'open' | 'locked' | 'done' | 'failed';
  kind: 'look' | 'check' | 'item' | 'finale';
}

export interface StageHandle {
  update(input: StageInput): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

const tagGlyph: Record<StageHotspot['kind'], string> = {
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

function tagTexture(hotspot: StageHotspot, highlighted: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.shadowColor = hotspot.status === 'open' ? PALETTE.light : PALETTE.ink;
  ctx.shadowBlur = hotspot.status === 'open' ? 24 : 7;
  ctx.fillStyle = PALETTE.paper;
  ctx.strokeStyle = highlighted ? PALETTE.accent : PALETTE.ink;
  ctx.lineWidth = highlighted ? 7 : 4;
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(108, 19);
  ctx.lineTo(116, 106);
  ctx.lineTo(20, 114);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = hotspot.status === 'open' ? PALETTE.ink : PALETTE.woodDark;
  ctx.font = `bold ${highlighted ? 66 : 58}px ${TYPE.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusGlyph[hotspot.status] ?? tagGlyph[hotspot.kind], 66, 63);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeGroup(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  group.clear();
}

function disposeTagged(group: THREE.Group) {
  disposeGroup(group);
}

function makeTag(hotspot: StageHotspot, index: number, cellId: string, highlighted: boolean) {
  const group = new THREE.Group();
  group.userData.lineId = hotspot.lineId;
  const [x, y, z] = anchorFor(cellId, hotspot.lineId, index);
  group.position.set(x, y, z);
  group.userData.noInk = true;
  const map = tagTexture(hotspot, highlighted);
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: highlighted ? 1 : 0.92,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(highlighted ? 0.52 : 0.4, highlighted ? 0.52 : 0.4, 1);
  sprite.renderOrder = 1000;
  sprite.userData.lineId = hotspot.lineId;
  sprite.userData.hotspot = hotspot;
  sprite.userData.noInk = true;
  group.add(sprite);
  return { group, sprite };
}

export function mountStage(
  host: HTMLElement,
  initial: StageInput,
  onPick: (lineId: string) => void
): StageHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  const overlayScene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 80);
  const cameraTarget = new THREE.Vector3(4.8, 4.5, 6.8);
  const lookAt = new THREE.Vector3(0, 1.1, 0);
  camera.position.copy(cameraTarget);
  camera.lookAt(lookAt);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = 'room-stage-canvas';
  renderer.domElement.setAttribute('aria-label', '房间纸剧场');
  host.replaceChildren(renderer.domElement);

  const ink = new InkRenderer(renderer, scene, camera);
  const sun = new THREE.DirectionalLight(LIGHT_2000.sunColor, LIGHT_2000.sunIntensity);
  sun.position.set(...LIGHT_2000.sunDir).multiplyScalar(-5);
  sun.target.position.set(0, 0.8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(LIGHT_2000.hemiSky, LIGHT_2000.hemiGround, LIGHT_2000.hemiIntensity);
  scene.add(hemi);

  let room: THREE.Group | null = null;
  let tagGroup = new THREE.Group();
  scene.add(tagGroup);
  let pendantLight: THREE.PointLight | null = null;
  let currentInput = initial;
  let disposed = false;
  let hovered: THREE.Sprite | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const size = { w: 1, h: 1 };

  const pick = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(tagGroup.children.flatMap((group) => group.children), false)[0]?.object as THREE.Sprite | undefined;
  };
  const onMove = (event: PointerEvent) => {
    const sprite = pick(event);
    hovered = sprite ?? null;
    renderer.domElement.style.cursor = sprite ? 'pointer' : 'default';
  };
  const onLeave = () => {
    hovered = null;
    renderer.domElement.style.cursor = 'default';
  };
  const onClick = (event: PointerEvent) => {
    const sprite = pick(event);
    const lineId = sprite?.userData.lineId;
    if (typeof lineId === 'string') onPick(lineId);
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('click', onClick);

  function updateLighting(input: StageInput) {
    const light = HOUR_LIGHT[input.hour];
    const night = light.night;
    const angle = ((light.angle - 112) * Math.PI) / 180;
    const dir = new THREE.Vector3(...LIGHT_2000.sunDir);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    sun.position.copy(dir).multiplyScalar(-5);
    sun.color.set(light.tint);
    sun.intensity = LIGHT_2000.sunIntensity * (1 - night * 1.5);
    hemi.intensity = LIGHT_2000.hemiIntensity * (1 - night);
    hemi.color.set(night > 0.3 ? PALETTE.roof : LIGHT_2000.hemiSky);
    if (room) {
      const sky = room.userData.windowMaterial as THREE.MeshBasicMaterial | undefined;
      sky?.color.set(input.hour === 23 ? PALETTE.roof : light.tint);
      if (room.userData.hasPendant && input.hour === 23 && !pendantLight) {
        pendantLight = new THREE.PointLight(PALETTE.light, 2.4, 5.2);
        pendantLight.position.set(0, 2.35, 0);
        room.add(pendantLight);
      } else if (input.hour !== 23 && pendantLight) {
        room.remove(pendantLight);
        pendantLight = null;
      }
    }
  }

  function setRoom(cellId: string, animate: boolean) {
    if (room) {
      scene.remove(room);
      disposeGroup(room);
      pendantLight = null;
    }
    const data: CellScene = cellScene(cellId);
    room = buildCellRoom(data, cellId);
    scene.add(room);
    if (animate) {
      camera.zoom = 1;
      camera.left = -4.6;
      camera.right = 4.6;
      camera.top = 4.6;
      camera.bottom = -4.6;
      camera.updateProjectionMatrix();
      const finalHeight = 4.6;
      camera.userData = {
        started: performance.now(),
        duration: 700,
        startHeight: finalHeight * 2.2,
        endHeight: finalHeight,
      };
    }
    updateLighting(currentInput);
  }

  function setTags(input: StageInput) {
    scene.remove(tagGroup);
    disposeTagged(tagGroup);
    tagGroup = new THREE.Group();
    tagGroup.name = 'room-hotspots';
    input.hotspots.forEach((hotspot, index) => {
      const { group } = makeTag(hotspot, index, input.cellId, input.highlight === hotspot.lineId);
      tagGroup.add(group);
    });
    scene.add(tagGroup);
  }

  setRoom(initial.cellId, true);
  setTags(initial);
  ink.setMode(initial.mode as InkMode);
  updateLighting(initial);

  const resizeObserver = new ResizeObserver(() => {
    handle.resize(host.clientWidth, host.clientHeight);
  });
  resizeObserver.observe(host);

  let frame = 0;
  const draw = () => {
    if (disposed) return;
    const animation = camera.userData as { started?: number; duration?: number; startHeight?: number; endHeight?: number };
    if (animation.started !== undefined && animation.duration && animation.startHeight && animation.endHeight) {
      const t = Math.min(1, (performance.now() - animation.started) / animation.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const height = animation.startHeight + (animation.endHeight - animation.startHeight) * eased;
      const half = height / 2;
      const aspect = size.w / size.h;
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      if (t >= 1) camera.userData = {};
    }
    if (hovered) renderer.domElement.style.cursor = 'pointer';
    ink.render(camera.top - camera.bottom);
    if (tagGroup.children.length > 0) {
      const autoClear = renderer.autoClear;
      scene.remove(tagGroup);
      overlayScene.add(tagGroup);
      renderer.autoClear = false;
      try {
        renderer.clearDepth();
        renderer.render(overlayScene, camera);
      } finally {
        overlayScene.remove(tagGroup);
        scene.add(tagGroup);
        renderer.autoClear = autoClear;
      }
    }
    frame = requestAnimationFrame(draw);
  };
  const handle: StageHandle = {
    update(input) {
      const previousCell = currentInput.cellId;
      const changedTags = JSON.stringify(currentInput.hotspots) !== JSON.stringify(input.hotspots)
        || currentInput.highlight !== input.highlight
        || currentInput.cellId !== input.cellId;
      currentInput = input;
      ink.setMode(input.mode);
      if (input.cellId !== previousCell) {
        setRoom(input.cellId, true);
        setTags(input);
      } else if (changedTags) {
        setTags(input);
      }
      updateLighting(input);
    },
    resize(w, h) {
      if (w <= 0 || h <= 0) return;
      size.w = w;
      size.h = h;
      renderer.setSize(w, h, false);
      ink.setSize(w, h);
      const half = (camera.top - camera.bottom) / 2 || 2.3;
      camera.left = -half * (w / h);
      camera.right = half * (w / h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('click', onClick);
      if (room) {
        scene.remove(room);
        disposeGroup(room);
        room = null;
      }
      disposeTagged(tagGroup);
      scene.remove(tagGroup);
      ink.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      host.replaceChildren();
    },
  };
  handle.resize(host.clientWidth || 640, host.clientHeight || 480);
  frame = requestAnimationFrame(draw);
  return handle;
}
