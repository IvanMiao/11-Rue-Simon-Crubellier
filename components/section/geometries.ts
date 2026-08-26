import * as THREE from 'three';

const lathe = (pairs: [number, number][], segs = 18) =>
  new THREE.LatheGeometry(pairs.map(([x, y]) => new THREE.Vector2(x, y)), segs);

export const lampStemGeo = lathe([
  [0.0, 0],
  [0.048, 0],
  [0.05, 0.016],
  [0.018, 0.022],
  [0.014, 0.12],
  [0.02, 0.138],
  [0.0, 0.138],
]);

export const lampShadeGeo = lathe(
  [
    [0.0, 0],
    [0.09, 0],
    [0.055, 0.07],
    [0.0, 0.07],
  ],
  20
);

export const bottleGeo = lathe(
  [
    [0.0, 0],
    [0.022, 0],
    [0.024, 0.055],
    [0.012, 0.08],
    [0.01, 0.12],
    [0.014, 0.128],
    [0.0, 0.128],
  ],
  12
);

export const barrelGeo = lathe(
  [
    [0.0, 0],
    [0.08, 0],
    [0.1, 0.04],
    [0.108, 0.1],
    [0.1, 0.16],
    [0.08, 0.2],
    [0.0, 0.2],
  ],
  16
);

export const vaseGeo = lathe(
  [
    [0.0, 0],
    [0.03, 0],
    [0.04, 0.03],
    [0.028, 0.07],
    [0.022, 0.1],
    [0.032, 0.11],
    [0.0, 0.11],
  ],
  14
);

export const knightBaseGeo = lathe(
  [
    [0.0, 0],
    [0.07, 0],
    [0.072, 0.018],
    [0.048, 0.028],
    [0.04, 0.055],
    [0.05, 0.062],
    [0.032, 0.09],
    [0.028, 0.12],
    [0.0, 0.12],
  ],
  20
);

export const urnGeo = lathe(
  [
    [0.0, 0],
    [0.055, 0],
    [0.06, 0.02],
    [0.04, 0.08],
    [0.05, 0.11],
    [0.0, 0.11],
  ],
  12
);
