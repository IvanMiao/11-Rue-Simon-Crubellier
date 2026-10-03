import * as THREE from 'three';
import { PALETTE, TOON_STEPS } from './palette';

let gradient: THREE.DataTexture | null = null;

/** Three hard cel bands shared by every surface, so light reads as printed tone, not as a gradient. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array(TOON_STEPS.length * 4);
  TOON_STEPS.forEach((v, i) => {
    const b = Math.round(v * 255);
    data.set([b, b, b, 255], i * 4);
  });
  gradient = new THREE.DataTexture(data, TOON_STEPS.length, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial(color: string, opts: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

/** Section cut faces (walls, slabs) are solid ink, unlit — the poché of an architectural section. */
export const inkMaterial = () => new THREE.MeshBasicMaterial({ color: PALETTE.ink });

/** Box with the +z face drawn as a section cut. */
export function sectionBox(w: number, h: number, d: number, face: THREE.Material): THREE.Mesh {
  const ink = inkMaterial();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [face, face, face, face, ink, face]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
