import * as THREE from 'three';
import { InkRenderer } from './inkPass';
import { buildBuilding } from './room';
import { skylineTexture } from './textures';
import { LIGHT_2000, PALETTE, RESIDENTS } from './palette';

type ViewName = 'room' | 'section';
interface View { center: THREE.Vector3; height: number; title: string; meta: string }

async function main() {
  await document.fonts.ready;
  const params = new URLSearchParams(location.search);
  const isStatic = params.has('static');
  const stage = document.getElementById('stage')!;

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const building = buildBuilding();
  scene.add(building.group);
  const motes: THREE.PointsMaterial[] = [];
  building.group.traverse((o) => {
    if ((o as THREE.Points).isPoints) motes.push((o as THREE.Points).material as THREE.PointsMaterial);
  });

  const b = building.bounds;
  const size = b.getSize(new THREE.Vector3());
  const center = b.getCenter(new THREE.Vector3());
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x - 0.4, size.y - 1.2),
    new THREE.MeshBasicMaterial({ map: skylineTexture(size.x, size.y - 1.2) })
  );
  sky.position.set(center.x, center.y - 0.6, b.min.z - 1.2);
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(LIGHT_2000.hemiSky, LIGHT_2000.hemiGround, LIGHT_2000.hemiIntensity));
  const dir = new THREE.Vector3(...LIGHT_2000.sunDir).normalize();
  const sun = new THREE.DirectionalLight(LIGHT_2000.sunColor, LIGHT_2000.sunIntensity);
  sun.position.copy(center).addScaledVector(dir, -30);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(LIGHT_2000.fillColor, LIGHT_2000.fillIntensity);
  fill.position.set(-8, 6, 20);
  scene.add(fill);
  renderer.shadowMap.needsUpdate = true;

  const views: Record<ViewName, View> = {
    room: { center: building.focus.clone(), height: 4.9, title: 'III · 巴特尔布思的工作室', meta: '1975 年 6 月 23 日 · 20:00 · 时间静止' },
    section: { center: new THREE.Vector3(center.x, center.y + 0.15, 0), height: size.y + 2.6, title: '剖面 · 二至四层', meta: '九个房间 · 同一秒钟 · 骑士在 III 层' },
  };
  let current: ViewName = params.get('view') === 'section' ? 'section' : 'room';
  const live = { center: views[current].center.clone(), height: views[current].height };

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 90);
  const ink = new InkRenderer(renderer, scene, camera);
  const viewDir = new THREE.Vector3(0.16, 0.25, 1).normalize();
  const pointer = new THREE.Vector2();
  const tilt = new THREE.Vector2();

  const titleEl = document.getElementById('title')!;
  const metaEl = document.getElementById('meta')!;
  const setView = (v: ViewName) => {
    current = v;
    titleEl.textContent = views[v].title;
    metaEl.textContent = views[v].meta;
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((el) => el.classList.toggle('on', el.dataset.view === v));
  };
  setView(current);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((el) => el.addEventListener('click', () => setView(el.dataset.view as ViewName)));
  window.addEventListener('keydown', (e) => {
    if (e.key === '1') setView('room');
    if (e.key === '2') setView('section');
  });
  window.addEventListener('pointermove', (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));

  const legend = document.getElementById('legend')!;
  const chips: [string, string][] = [
    ['墨线', PALETTE.ink], ['纸', PALETTE.paper], ['墙', PALETTE.wall], ['地板', PALETTE.floor], ['20:00 光', PALETTE.light], ['天', PALETTE.sky],
    ...Object.values(RESIDENTS).map((r) => [r.name, r.coat] as [string, string]),
  ];
  legend.innerHTML = chips.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('');

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    ink.setSize(innerWidth, innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  const frame = () => {
    const target = views[current];
    const k = isStatic ? 1 : 0.075;
    live.center.lerp(target.center, k);
    live.height += (target.height - live.height) * k;
    if (!isStatic) tilt.lerp(pointer, 0.05);
    const aspect = innerWidth / innerHeight;
    camera.left = (-live.height * aspect) / 2;
    camera.right = (live.height * aspect) / 2;
    camera.top = live.height / 2;
    camera.bottom = -live.height / 2;
    camera.updateProjectionMatrix();
    const d = viewDir.clone().add(new THREE.Vector3(tilt.x * 0.06, -tilt.y * 0.04, 0)).normalize();
    camera.position.copy(live.center).addScaledVector(d, 40);
    camera.lookAt(live.center);
    const moteSize = 5 * Math.min(1, views.room.height / live.height) * renderer.getPixelRatio() / 2;
    motes.forEach((m) => (m.size = Math.max(1.5, moteSize)));
    ink.render(live.height);
  };

  if (isStatic) {
    frame();
    (window as unknown as { __styleLabReady: boolean }).__styleLabReady = true;
    return;
  }
  const loop = () => {
    frame();
    (window as unknown as { __styleLabReady: boolean }).__styleLabReady = true;
    requestAnimationFrame(loop);
  };
  loop();
}

main();
