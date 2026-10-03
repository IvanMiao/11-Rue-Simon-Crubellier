import * as THREE from 'three';
import { CASE_ROOM_IDS } from '../../case/buildCase';
import { PALETTE, HOUR_LIGHT, LIGHT_2000 } from '../palette';
import { applyCssTokens } from '../cssTokens';
import { CELLS, cellTitle, CLINAMEN_CELL } from '../../world/damier';
import { InkRenderer } from '../inkPass';
import { configureStageCamera, STAGE_CAMERA } from './camera';
import { buildCellRoom } from './cellRooms';
import { cellScene } from './cellScenes';

const KIND_LABEL: Record<ReturnType<typeof cellScene>['kind'], string> = {
  stair: '楼梯',
  hall: '门厅',
  loge: '门房',
  atelier: '工作室',
  sill: '窗台',
  workshop: '作坊',
  servant: '仆役房',
  studio: '画室',
  lab: '实验室',
  boiler: '锅炉房',
  shop: '古董店',
  archive: '档案室',
  clinamen: '缺掉的一格',
  empty: '空房',
};

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

async function main() {
  await document.fonts.ready;
  applyCssTokens();
  const params = new URLSearchParams(location.search);
  const hour = Number(params.get('hour')) === 23 ? 23 : 20;
  const mode = params.get('mode') === 'blueprint' ? 'blueprint' : 'print';
  document.querySelector('h1')!.textContent = `章节房间 · ${hour}:00`;
  document.querySelector('footer')!.textContent = `A3 · ${mode === 'blueprint' ? '蓝图印刷' : '纸面印刷'} · ${hour}:00`;

  const emptyCells = CELLS.filter((cell) => cellScene(cell.id).kind === 'empty').slice(0, 3);
  if (emptyCells.length !== 3) throw new Error('The contact sheet requires three empty-room samples.');
  const emptySeeds = [3, 17, 42];
  const samples = [
    ...CASE_ROOM_IDS.map((cellId) => {
      const scene = cellScene(cellId);
      return { cellId, scene, label: `${cellId} · ${cellTitle(cellId)} · ${KIND_LABEL[scene.kind]}` };
    }),
    ...emptyCells.map((cell, index) => {
      const seed = emptySeeds[index] ?? 1;
      const scene = { ...cellScene(cell.id), seed };
      return {
        cellId: cell.id,
        scene,
        label: `${cell.id} · ${cellTitle(cell.id)} · ${KIND_LABEL.empty} · 种子 ${scene.seed}`,
      };
    }),
    {
      cellId: CLINAMEN_CELL,
      scene: cellScene(CLINAMEN_CELL),
      label: `${CLINAMEN_CELL} · 缺掉的一格 · ${KIND_LABEL.clinamen}`,
    },
  ];
  const tileWidth = 380;
  const tileHeight = 285;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const host = document.getElementById('cells-stage')!;
  host.replaceChildren();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(tileWidth, tileHeight, false);
  const ink = new InkRenderer(renderer, scene, camera);
  ink.setMode(mode);
  ink.setSize(tileWidth, tileHeight);
  configureStageCamera(camera, tileWidth, tileHeight);

  const sun = new THREE.DirectionalLight(LIGHT_2000.sunColor, LIGHT_2000.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(LIGHT_2000.hemiSky, LIGHT_2000.hemiGround, LIGHT_2000.hemiIntensity);
  scene.add(hemi);

  const hourLight = HOUR_LIGHT[hour];
  const angle = ((hourLight.angle - 112) * Math.PI) / 180;
  const direction = new THREE.Vector3(...LIGHT_2000.sunDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
  sun.position.copy(direction).multiplyScalar(-28);
  sun.target.position.set(0, 0.8, 0);
  sun.color.set(hourLight.tint);
  sun.intensity = LIGHT_2000.sunIntensity * (1 - hourLight.night * 1.5);
  hemi.intensity = LIGHT_2000.hemiIntensity * (1 - hourLight.night);
  hemi.color.set(hourLight.night > 0.3 ? PALETTE.roof : LIGHT_2000.hemiSky);

  for (const { cellId, scene: data, label } of samples) {
    const tile = document.createElement('article');
    tile.className = 'contact-tile';
    const image = document.createElement('canvas');
    image.width = Math.round(tileWidth * pixelRatio);
    image.height = Math.round(tileHeight * pixelRatio);
    image.setAttribute('aria-hidden', 'true');
    const labelNode = document.createElement('p');
    labelNode.className = 'contact-label';
    labelNode.textContent = label;
    tile.append(image, labelNode);
    host.append(tile);

    const room = buildCellRoom(data, cellId);
    scene.add(room);
    if (hour === 23 && room.userData.hasPendant) {
      const pendant = new THREE.PointLight(PALETTE.light, 2.4, 5.2);
      pendant.position.set(0, 2.35, 0);
      room.add(pendant);
    }
    const sky = room.userData.windowMaterial as THREE.MeshBasicMaterial | null;
    sky?.color.set(hour === 23 ? PALETTE.roof : hourLight.tint);
    configureStageCamera(camera, tileWidth, tileHeight);
    ink.render(STAGE_CAMERA.finalHeight);
    const context = image.getContext('2d');
    if (!context) throw new Error('Could not create a contact-sheet canvas context.');
    context.drawImage(renderer.domElement, 0, 0, image.width, image.height);
    scene.remove(room);
    disposeGroup(room);
  }

  ink.dispose();
  renderer.dispose();
  (window as Window & { __cellsReady?: boolean }).__cellsReady = true;
}

void main();
