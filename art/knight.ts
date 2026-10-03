import * as THREE from 'three';
import { PALETTE } from './palette';
import { toonMaterial } from './materials';

/** The player: a lacquered Staunton knight, the only thing in the building allowed to move. */
export function knightPiece(height = 0.62): THREE.Group {
  const g = new THREE.Group();
  const lacquer = toonMaterial('#2c2926');
  const base = new THREE.LatheGeometry(
    [
      [0, 0], [0.3, 0], [0.31, 0.03], [0.3, 0.07], [0.25, 0.1], [0.23, 0.15], [0.27, 0.18], [0.26, 0.21], [0.19, 0.23], [0, 0.23],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40
  );
  const baseMesh = new THREE.Mesh(base, lacquer);
  g.add(baseMesh);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 40), toonMaterial(PALETTE.brass));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.165;
  g.add(collar);

  const profile = new THREE.Shape();
  profile.moveTo(-0.17, 0.22);
  profile.lineTo(0.19, 0.22);
  profile.splineThru(
    [
      [0.2, 0.36], [0.23, 0.52], [0.19, 0.7], [0.1, 0.84], [0.07, 0.97], [0.01, 0.9], [-0.08, 0.86], [-0.2, 0.74], [-0.28, 0.6], [-0.27, 0.54], [-0.2, 0.52], [-0.09, 0.5], [-0.12, 0.38], [-0.17, 0.22],
    ].map(([x, y]) => new THREE.Vector2(x, y))
  );
  const head = new THREE.ExtrudeGeometry(profile, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 3,
    curveSegments: 24,
  });
  head.translate(0, 0, -0.08);
  const headMesh = new THREE.Mesh(head, lacquer);
  g.add(headMesh);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), toonMaterial(PALETTE.brass));
  eye.position.set(-0.1, 0.72, 0.115);
  g.add(eye);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.scale.setScalar(height);
  return g;
}
