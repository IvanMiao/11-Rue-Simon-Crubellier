import * as THREE from 'three';
import { LINE, PALETTE, PRINT } from './palette';
import { paperTexture } from './textures';

const cutoutNormalVS = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const cutoutNormalFS = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec3 vN;
void main() {
  if (texture2D(map, vUv).a < 0.5) discard;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}`;

const quadVS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const compositeFS = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform sampler2D tPaper;
uniform vec2 res;
uniform float px;
uniform float camNear;
uniform float camFar;
uniform vec3 ink;
uniform float depthTh;
uniform float normalTh;
uniform float grain;
uniform float vignette;
uniform float halftone;
uniform float cell;
varying vec2 vUv;

float viewZ(vec2 uv) { return camNear + texture2D(tDepth, uv).x * (camFar - camNear); }
vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec2 o = px / res;
  float z = viewZ(vUv);
  vec3 n = nrm(vUv);
  float e = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * o;
    float dz = abs(viewZ(uv) - z);
    e = max(e, smoothstep(depthTh * 0.6, depthTh * 1.4, dz));
    float dn = 1.0 - dot(n, nrm(uv));
    e = max(e, smoothstep(normalTh * 0.6, normalTh * 1.4, dn));
  }
  vec3 col = toSRGB(texture2D(tColor, vUv).rgb);
  float p = texture2D(tPaper, vUv * res / 512.0).r;
  col *= 1.0 + (p - 0.89) * grain * 6.0;
  float vig = length((vUv - 0.5) * vec2(res.x / res.y, 1.0));
  col *= 1.0 - vignette * smoothstep(0.35, 1.05, vig);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (vUv * res) / cell;
  float dotR = length(fract(g) - 0.5);
  float coverage = smoothstep(0.42, 0.12, lum);
  float screen = smoothstep(coverage * 0.62, coverage * 0.62 - 0.08, dotR);
  col *= 1.0 - halftone * screen;
  vec3 inkc = ink * (0.8 + 0.4 * p);
  gl_FragColor = vec4(mix(col, inkc, e * 0.95), 1.0);
}`;

/**
 * Renders the scene in clear-line style: colour pass + view-space normal/depth pass, then a
 * composite that draws constant-width ink where depth or normals break, on a printed-paper substrate.
 */
export class InkRenderer {
  private colorRT: THREE.WebGLRenderTarget;
  private normalRT: THREE.WebGLRenderTarget;
  private normalMat = new THREE.MeshNormalMaterial();
  private cutoutMats = new Map<THREE.Texture, THREE.ShaderMaterial>();
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private composite: THREE.ShaderMaterial;
  private paperColor = new THREE.Color(PALETTE.paper);

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.OrthographicCamera
  ) {
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: compositeFS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.colorRT.texture },
        tNormal: { value: this.normalRT.texture },
        tDepth: { value: this.normalRT.depthTexture },
        tPaper: { value: paperTexture() },
        res: { value: new THREE.Vector2(1, 1) },
        px: { value: 1 },
        camNear: { value: camera.near },
        camFar: { value: camera.far },
        ink: { value: new THREE.Color(PALETTE.ink).convertLinearToSRGB() },
        depthTh: { value: LINE.depthThreshold },
        normalTh: { value: LINE.normalThreshold },
        grain: { value: PRINT.grain },
        vignette: { value: PRINT.vignette },
        halftone: { value: PRINT.halftone },
        cell: { value: PRINT.halftoneCell },
      },
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composite));
  }

  setSize(w: number, h: number) {
    const pr = this.renderer.getPixelRatio();
    const W = Math.floor(w * pr);
    const H = Math.floor(h * pr);
    this.colorRT.setSize(W, H);
    this.normalRT.setSize(W, H);
    this.composite.uniforms.res.value.set(W, H);
    this.composite.uniforms.px.value = (LINE.widthPx * pr) / 2;
    this.composite.uniforms.cell.value = PRINT.halftoneCell * pr;
  }

  /** `viewHeight` is the ortho frustum height; depth threshold scales with it so zooming out doesn't hatch floors. */
  render(viewHeight: number) {
    const { renderer, scene, camera } = this;
    const u = this.composite.uniforms;
    u.camNear.value = camera.near;
    u.camFar.value = camera.far;
    u.depthTh.value = LINE.depthThreshold * Math.max(1, viewHeight / 4.6);

    renderer.setClearColor(this.paperColor, 1);
    renderer.setRenderTarget(this.colorRT);
    renderer.render(scene, camera);

    const restore: (() => void)[] = [];
    scene.traverse((o) => {
      if (o.userData.noInk && o.visible) {
        o.visible = false;
        restore.push(() => (o.visible = true));
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const prev = mesh.material;
      mesh.material = mesh.userData.cutout ? this.cutoutNormal(mesh.userData.cutout) : this.normalMat;
      restore.push(() => (mesh.material = prev));
    });
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x8080ff, 1);
    renderer.setRenderTarget(this.normalRT);
    renderer.render(scene, camera);
    restore.forEach((f) => f());
    renderer.shadowMap.autoUpdate = shadows;

    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
  }

  private cutoutNormal(map: THREE.Texture) {
    let m = this.cutoutMats.get(map);
    if (!m) {
      m = new THREE.ShaderMaterial({
        vertexShader: cutoutNormalVS,
        fragmentShader: cutoutNormalFS,
        uniforms: { map: { value: map } },
        side: THREE.DoubleSide,
      });
      this.cutoutMats.set(map, m);
    }
    return m;
  }
}
