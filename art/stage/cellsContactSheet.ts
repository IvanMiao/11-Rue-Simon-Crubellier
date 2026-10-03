import * as THREE from 'three';
import { CASE_ROOM_IDS } from '../../case/buildCase';
import { PALETTE, HOUR_LIGHT, LIGHT_2000 } from '../palette';
import { applyCssTokens } from '../cssTokens';
import { CELLS, CLINAMEN_CELL } from '../../world/damier';
import { InkRenderer } from '../inkPass';
import { buildCellRoom } from './cellRooms';
import { cellScene } from './cellScenes';

const KIND_LABEL: Record<string, string> = {
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

function paperLabel(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "600 27px 'Noto Serif SC', 'Noto Serif CJK SC', serif";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return new THREE.CanvasTexture(canvas);
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
      return { cellId, scene, label: `${cellId} · ${KIND_LABEL[scene.kind]}` };
    }),
    ...emptyCells.map((cell, index) => {
      const seed = emptySeeds[index] ?? 1;
      const scene = { ...cellScene(cell.id), seed };
      return { cellId: cell.id, scene, label: `${cell.id} · 空房 · 种子 ${scene.seed}` };
    }),
    {
      cellId: CLINAMEN_CELL,
      scene: cellScene(CLINAMEN_CELL),
      label: `${CLINAMEN_CELL} · ${KIND_LABEL.clinamen}`,
    },
  ];
  const columns = 5;
  const rows = Math.ceil(samples.length / columns);
  const spacingX = 4.25;
  const spacingZ = 4.35;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 90);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('cells-stage')!.appendChild(renderer.domElement);

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

  const centerX = ((columns - 1) * spacingX) / 2;
  const centerZ = ((rows - 1) * spacingZ) / 2;
  samples.forEach(({ cellId, scene: data, label: labelText }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * spacingX - centerX;
    const z = row * spacingZ - centerZ;
    const room = buildCellRoom(data, cellId);
    room.position.set(x, 0, z);
    scene.add(room);
    const labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: paperLabel(labelText), depthTest: false })
    );
    labelSprite.position.set(x, -0.26, z + 1.82);
    labelSprite.scale.set(3.25, 0.48, 1);
    labelSprite.userData.noInk = true;
    scene.add(labelSprite);
    if (hour === 23 && room.userData.hasPendant) {
      const pendant = new THREE.PointLight(PALETTE.light, 2.4, 5.2);
      pendant.position.set(x, 2.35, z);
      scene.add(pendant);
    }
  });

  const hourLight = HOUR_LIGHT[hour];
  const angle = ((hourLight.angle - 112) * Math.PI) / 180;
  const direction = new THREE.Vector3(...LIGHT_2000.sunDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
  sun.position.copy(direction).multiplyScalar(-28);
  sun.target.position.set(0, 0.8, 0);
  sun.color.set(hourLight.tint);
  sun.intensity = LIGHT_2000.sunIntensity * (1 - hourLight.night * 1.5);
  hemi.intensity = LIGHT_2000.hemiIntensity * (1 - hourLight.night);
  hemi.color.set(hourLight.night > 0.3 ? PALETTE.roof : LIGHT_2000.hemiSky);
  scene.traverse((object) => {
    if (object.userData.cellId) {
      const sky = object.userData.windowMaterial as THREE.MeshBasicMaterial | null;
      sky?.color.set(hour === 23 ? PALETTE.roof : hourLight.tint);
    }
  });

  const ink = new InkRenderer(renderer, scene, camera);
  ink.setMode(mode);
  const host = document.getElementById('cells-stage')!;
  const render = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    ink.setSize(width, height);
    const viewHeight = rows * spacingZ + 4.4;
    const aspect = width / height;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    camera.position.set(0, 16, 28);
    camera.lookAt(0, 0.85, 0);
    ink.render(viewHeight);
  };
  render();
  window.addEventListener('resize', render);
  (window as Window & { __cellsReady?: boolean }).__cellsReady = true;
}

void main();
